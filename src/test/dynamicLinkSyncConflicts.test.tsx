import { webcrypto } from 'node:crypto';
import { setTimeout as realSleep } from 'node:timers/promises';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlockFormState } from '@/hooks/useBlockFormState';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { useWorkshop } from '@/hooks/useWorkshop';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { createDynamicSecret, decryptWorkshop, encryptWorkshop, type EncryptedWorkshopEnvelope } from '@/lib/dynamicLinkCrypto';
import { DEBOUNCE_TIMES, POLLING_INTERVALS, SERVER_PUT_RETRY_MS } from '@/lib/timing';
import type { WorkshopItem } from '@/types/workshop';
import { clearAllStorage, makeWorkshop } from './test-helpers';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

const key = 'A'.repeat(22);
const encryptionKey = createDynamicSecret();
const writeCapability = createDynamicSecret();

/** How the next PUT misbehaves. `lost`: committed, response never arrives. */
type PutFault = 'hold-response' | 'lost' | 'late-arrival' | 'refused' | number;

/** Same version semantics as backend/data/sessions.php. */
function createServer() {
  const s = {
    version: 1,
    envelope: null as EncryptedWorkshopEnvelope | null,
    deleted: false,
    puts: [] as { version: number; authorization?: string }[],
    gets: 0,
    faults: [] as PutFault[],
    heldResponses: [] as (() => void)[],
    lateArrivals: [] as (() => void)[],
    heldGets: [] as (() => void)[],
    holdGets: false,
    async foreignWrite(title: string) {
      s.envelope = await encryptWorkshop(makeWorkshop({ workshop: { ...makeWorkshop().workshop, title } }), key, encryptionKey);
      s.version += 1;
    },
    async title() {
      return (await decryptWorkshop(s.envelope!, key, encryptionKey)).workshop.title;
    },
  };
  const respond = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
  const stored = () => ({ ...s.envelope, _v: s.version });

  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      s.gets += 1;
      if (s.deleted) return respond(404, { error: 'Session not found.' });
      const response = respond(200, { data: stored() });
      if (!s.holdGets) return response;
      return new Promise((resolve) => s.heldGets.push(() => resolve(response)));
    }
    if (method === 'POST') {
      const body = JSON.parse(init!.body as string);
      s.envelope = body;
      return respond(201, { key: body.id, version: 1 });
    }

    const version = Number(new URL(url, 'http://x').searchParams.get('version'));
    s.puts.push({ version, authorization: (init?.headers as Record<string, string>).Authorization });
    if (s.deleted) return respond(404, { error: 'Session not found.' });
    const fault = s.faults.shift();
    if (typeof fault === 'number') return respond(fault, { error: 'fault' });
    const apply = () => {
      if (version !== s.version) return respond(409, { serverVersion: s.version, data: stored() });
      s.envelope = JSON.parse(init!.body as string);
      s.version += 1;
      return respond(200, { success: true, version: s.version });
    };
    if (fault === 'late-arrival') {
      s.lateArrivals.push(() => { apply(); });
      throw new DOMException('signal timed out', 'TimeoutError');
    }
    const response = apply();
    if (fault === 'lost') throw new TypeError('Failed to fetch');
    if (fault === 'hold-response') {
      return new Promise((resolve) => s.heldResponses.push(() => resolve(response)));
    }
    return response;
  }) as unknown as typeof fetch;
  return s;
}

/** Advances fake time. WebCrypto finishes on real time, hence the short sleep. */
const tick = (ms = 0) => act(async () => {
  await realSleep(10);
  await vi.advanceTimersByTimeAsync(ms);
  await realSleep(10);
});

const wrapper = (entry: string) => ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
);

describe('Dynamic Link sync', () => {
  const originalFetch = globalThis.fetch;
  let server: ReturnType<typeof createServer>;

  const openSession = async (hash = `#k=${encryptionKey}&w=${writeCapability}`) => {
    window.history.replaceState(null, '', `/?id=${key}${hash}`);
    const hook = renderHook(() => useWorkshop(), { wrapper: wrapper(`/?id=${key}`) });
    await tick();
    expect(hook.result.current.isServerSessionLoaded).toBe(true);
    return hook;
  };
  type Hook = Awaited<ReturnType<typeof openSession>>;
  const edit = (hook: Hook, title: string) => {
    act(() => hook.result.current.updateMetadata({ title }));
  };
  const hasConflict = (hook: Hook) => hook.result.current.incomingUpdate !== null;
  const localTitle = (hook: Hook) => hook.result.current.workshop.workshop.title;

  beforeEach(async () => {
    clearAllStorage();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    server = createServer();
    server.envelope = await encryptWorkshop(makeWorkshop(), key, encryptionKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  describe('working alone never shows a conflict', () => {
    it('saves an edit once after the debounce', async () => {
      const hook = await openSession();
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts).toHaveLength(1);
      expect(await server.title()).toBe('One');
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);
    });

    it('keeps the version when editing during a running PUT', async () => {
      const hook = await openSession();
      server.faults.push('hold-response');
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      edit(hook, 'Two');
      server.heldResponses.forEach((release) => release());
      await tick();
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts.map((put) => put.version)).toEqual([1, 2]);
      expect(hasConflict(hook)).toBe(false);
      expect(await server.title()).toBe('Two');
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);
    });

    it('runs one PUT at a time and merges edits made meanwhile into one follow-up', async () => {
      const hook = await openSession();
      server.faults.push('hold-response');
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      edit(hook, 'Two');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      edit(hook, 'Three');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts).toHaveLength(1);
      server.heldResponses.forEach((release) => release());
      await tick();
      expect(server.puts).toHaveLength(2);
      expect(await server.title()).toBe('Three');
      expect(hasConflict(hook)).toBe(false);
    });

    it('saves during continuous typing after the maximum wait at the latest', async () => {
      const hook = await openSession();
      const step = DEBOUNCE_TIMES.SERVER_PUT / 2;
      for (let elapsed = 0; elapsed < DEBOUNCE_TIMES.SERVER_PUT_MAX_WAIT - step; elapsed += step) {
        edit(hook, `Typing ${elapsed}`);
        await tick(step);
      }
      expect(server.puts).toHaveLength(0);
      edit(hook, 'Typing on');
      await tick(step);
      expect(server.puts).toHaveLength(1);
    });

    it('does not poll while a PUT runs or is due', async () => {
      const hook = await openSession();
      const getsBefore = server.gets;
      edit(hook, 'One');
      act(() => { window.dispatchEvent(new Event('focus')); });
      await tick();
      expect(server.gets).toBe(getsBefore);
      server.faults.push('hold-response');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      act(() => { window.dispatchEvent(new Event('focus')); });
      await tick();
      expect(server.gets).toBe(getsBefore);
      server.heldResponses.forEach((release) => release());
      await tick();
      expect(hasConflict(hook)).toBe(false);
    });

    it('ignores a poll result that already contains the own running PUT', async () => {
      const hook = await openSession();
      server.holdGets = true;
      act(() => { window.dispatchEvent(new Event('focus')); });
      await tick();
      server.holdGets = false;
      server.faults.push('hold-response');
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.version).toBe(2);
      server.heldGets.forEach((release) => release());
      await tick();
      expect(hasConflict(hook)).toBe(false);
      server.heldResponses.forEach((release) => release());
      await tick();
      expect(hasConflict(hook)).toBe(false);
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);
    });

    it('sends nothing when undo returns to the synced state', async () => {
      const hook = await openSession();
      edit(hook, 'One');
      act(() => { hook.result.current.undo(); });
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts).toHaveLength(0);
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);
    });
  });

  describe('network problems', () => {
    it('recognises an own PUT whose response got lost, without an extra PUT', async () => {
      const hook = await openSession();
      server.faults.push('lost');
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(hook.result.current.hasSyncError).toBe(false);
      await tick(SERVER_PUT_RETRY_MS);
      expect(server.puts.map((put) => put.version)).toEqual([1, 1]);
      expect(hasConflict(hook)).toBe(false);
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);
      expect(server.version).toBe(2);
      await tick(POLLING_INTERVALS.ACTIVE);
      expect(server.puts).toHaveLength(2);
    });

    it('sends newer edits after an own PUT whose response got lost', async () => {
      const hook = await openSession();
      server.faults.push('lost');
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      edit(hook, 'Two');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      await tick();
      expect(hasConflict(hook)).toBe(false);
      expect(await server.title()).toBe('Two');
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);
    });

    it('recognises an older lost PUT even if a newer one was rejected', async () => {
      const hook = await openSession();
      server.faults.push('lost', 'lost');
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      edit(hook, 'Two');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.version).toBe(2);
      await tick(SERVER_PUT_RETRY_MS * 2);
      expect(hasConflict(hook)).toBe(false);
      expect(await server.title()).toBe('Two');
    });

    it('lets the server reject a timed-out PUT that arrives after its retry', async () => {
      const hook = await openSession();
      server.faults.push('late-arrival');
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      edit(hook, 'Two');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(await server.title()).toBe('Two');
      server.lateArrivals.forEach((arrive) => arrive());
      await tick(POLLING_INTERVALS.ACTIVE);
      expect(await server.title()).toBe('Two');
      expect(hasConflict(hook)).toBe(false);
    });

    it('retries server errors with a growing delay and shows the banner from the second failure', async () => {
      const hook = await openSession();
      server.faults.push(503, 503, 429);
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts).toHaveLength(1);
      expect(hook.result.current.syncFailureReason).toBeNull();
      await tick(SERVER_PUT_RETRY_MS);
      expect(server.puts).toHaveLength(2);
      expect(hook.result.current.syncFailureReason).toBe('server');
      await tick(SERVER_PUT_RETRY_MS);
      expect(server.puts).toHaveLength(2);
      await tick(SERVER_PUT_RETRY_MS);
      expect(server.puts).toHaveLength(3);
      await tick(SERVER_PUT_RETRY_MS * 4);
      expect(server.puts).toHaveLength(4);
      expect(hook.result.current.syncFailureReason).toBeNull();
      expect(await server.title()).toBe('One');
    });

    it('sends nothing while offline and syncs when back online', async () => {
      const hook = await openSession();
      vi.stubGlobal('navigator', { ...navigator, onLine: false });
      const getsBefore = server.gets;
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      await tick(POLLING_INTERVALS.ACTIVE);
      expect(server.puts).toHaveLength(0);
      expect(server.gets).toBe(getsBefore);
      expect(hook.result.current.syncFailureReason).toBe('server');
      vi.unstubAllGlobals();
      act(() => { window.dispatchEvent(new Event('online')); });
      await tick();
      expect(server.puts).toHaveLength(1);
      expect(hook.result.current.syncFailureReason).toBeNull();
    });
  });

  describe('real conflicts are always detected', () => {
    it('applies a foreign change when nothing is pending', async () => {
      const hook = await openSession();
      await server.foreignWrite('Foreign');
      await tick(POLLING_INTERVALS.IDLE);
      expect(localTitle(hook)).toBe('Foreign');
      expect(hasConflict(hook)).toBe(false);
      expect(server.puts).toHaveLength(0);
    });

    it('raises a conflict instead of overwriting a foreign change', async () => {
      const hook = await openSession();
      edit(hook, 'Mine');
      await server.foreignWrite('Foreign');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(hasConflict(hook)).toBe(true);
      expect(localTitle(hook)).toBe('Mine');
      expect(await server.title()).toBe('Foreign');
      expect(hook.result.current.hasUnsyncedChanges).toBe(true);
    });

    it('raises a conflict when a foreign change lands on top of a lost own PUT', async () => {
      const hook = await openSession();
      server.faults.push('lost');
      edit(hook, 'Mine');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      await server.foreignWrite('Foreign');
      await tick(SERVER_PUT_RETRY_MS);
      expect(hasConflict(hook)).toBe(true);
      expect(await server.title()).toBe('Foreign');
    });

    it('raises a conflict when an edit starts during a poll that brings a foreign change', async () => {
      const hook = await openSession();
      await server.foreignWrite('Foreign');
      server.holdGets = true;
      act(() => { window.dispatchEvent(new Event('focus')); });
      await tick();
      edit(hook, 'Mine');
      server.heldGets.forEach((release) => release());
      await tick();
      expect(hasConflict(hook)).toBe(true);
      expect(localTitle(hook)).toBe('Mine');
    });

    it('freezes syncing during a conflict: no requests, local edits stay', async () => {
      const hook = await openSession();
      edit(hook, 'Mine');
      await server.foreignWrite('Foreign');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      const putsBefore = server.puts.length;
      const getsBefore = server.gets;

      edit(hook, 'Mine, continued');
      await server.foreignWrite('Foreign again');
      await tick(POLLING_INTERVALS.IDLE);

      expect(server.puts).toHaveLength(putsBefore);
      expect(server.gets).toBe(getsBefore);
      expect(localTitle(hook)).toBe('Mine, continued');
      expect(await server.title()).toBe('Foreign again');
    });

    it('loads the newest version on accept and keeps working from it', async () => {
      const hook = await openSession();
      edit(hook, 'Mine');
      await server.foreignWrite('Foreign');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      await server.foreignWrite('Foreign again');

      act(() => { hook.result.current.acceptIncomingUpdate(); });
      await tick();
      expect(hasConflict(hook)).toBe(false);
      expect(localTitle(hook)).toBe('Foreign again');

      edit(hook, 'Mine after accept');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(hasConflict(hook)).toBe(false);
      expect(await server.title()).toBe('Mine after accept');
    });

    it('does not lose unsaved dialog input to a foreign change', async () => {
      const hook = await openSession();
      act(() => hook.result.current.setHasPendingFormEdits(true));
      await server.foreignWrite('Foreign');
      await tick(POLLING_INTERVALS.IDLE);
      expect(hasConflict(hook)).toBe(true);
      expect(localTitle(hook)).not.toBe('Foreign');

      act(() => hook.result.current.setHasPendingFormEdits(false));
      act(() => { hook.result.current.acceptIncomingUpdate(); });
      await tick();
      expect(localTitle(hook)).toBe('Foreign');
    });
  });

  describe('links without write access', () => {
    it('applies foreign changes without local edits and never sends a PUT', async () => {
      const hook = await openSession(`#k=${encryptionKey}`);
      await server.foreignWrite('Foreign');
      await tick(POLLING_INTERVALS.IDLE);
      expect(localTitle(hook)).toBe('Foreign');
      expect(server.puts).toHaveLength(0);
    });

    it('keeps polling with local edits and shows a foreign change as a conflict', async () => {
      const hook = await openSession(`#k=${encryptionKey}`);
      edit(hook, 'Private');
      await server.foreignWrite('Foreign');
      await tick(POLLING_INTERVALS.ACTIVE);
      expect(hasConflict(hook)).toBe(true);
      expect(localTitle(hook)).toBe('Private');
      expect(server.puts).toHaveLength(0);
    });
  });

  describe('session lifecycle', () => {
    it('sends a pending edit when leaving the planner, with the stored secrets', async () => {
      const hook = await openSession();
      edit(hook, 'Last edit');
      window.history.replaceState(null, '', '/blog');
      hook.unmount();
      await tick();
      expect(server.puts).toHaveLength(1);
      expect(server.puts[0].authorization).toBe(`Bearer ${writeCapability}`);
      expect(await server.title()).toBe('Last edit');
    });

    it('voids a running PUT and any conflict state when switching sessions', async () => {
      const otherKey = 'B'.repeat(22);
      const otherSecret = createDynamicSecret();
      const hook = await openSession();
      edit(hook, 'Mine');
      await server.foreignWrite('Foreign');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(hasConflict(hook)).toBe(true);

      server.envelope = await encryptWorkshop(makeWorkshop(), otherKey, otherSecret);
      server.version = 7;
      const otherHash = `#k=${otherSecret}&w=${writeCapability}`;
      window.history.replaceState(null, '', `/?id=${otherKey}${otherHash}`);
      act(() => hook.result.current.loadSessionFromHistory({
        id: 'other', title: 'Other', createdAt: 0, updatedAt: 0, lastOpenedAt: 0, itemCount: 0, totalDuration: 0,
        type: 'dynamic', serverKey: otherKey, serverHash: otherHash,
      }));
      await tick();
      expect(hasConflict(hook)).toBe(false);
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);

      edit(hook, 'In the other session');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts.at(-1)?.version).toBe(7);
      expect(hasConflict(hook)).toBe(false);
    });

    it('syncs edits made while the Dynamic Link was being created', async () => {
      window.history.replaceState(null, '', '/');
      const hook = renderHook(() => useWorkshop(), { wrapper: wrapper('/') });
      edit(hook, 'Before');
      let creation!: Promise<string | null>;
      act(() => { creation = hook.result.current.enableServerMode(); });
      edit(hook, 'During creation');
      await act(async () => {
        await realSleep(20);
        await creation;
      });
      expect(hook.result.current.hasUnsyncedChanges).toBe(true);
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts).toHaveLength(1);
      expect(hook.result.current.hasUnsyncedChanges).toBe(false);
    });

    it('stops syncing when the session was deleted', async () => {
      const hook = await openSession();
      server.deleted = true;
      edit(hook, 'One');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(hook.result.current.syncFailureReason).toBe('deleted');
      const putsBefore = server.puts.length;
      const getsBefore = server.gets;
      await tick(SERVER_PUT_RETRY_MS * 4);
      await tick(POLLING_INTERVALS.ACTIVE);
      expect(server.puts).toHaveLength(putsBefore);
      expect(server.gets).toBe(getsBefore);
    });

    it('notices a deleted session while polling, without a close warning', async () => {
      const hook = await openSession();
      server.deleted = true;
      await tick(POLLING_INTERVALS.IDLE);
      expect(hook.result.current.syncFailureReason).toBe('deleted');
      expect(hook.result.current.getHasUnsavedCloseRisk()).toBe(false);
    });

    it('does not retry a refused payload until the next edit', async () => {
      const hook = await openSession();
      server.faults.push(413);
      edit(hook, 'Too large');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(hook.result.current.syncFailureReason).toBe('rejected');
      await tick(SERVER_PUT_RETRY_MS * 4);
      expect(server.puts).toHaveLength(1);

      edit(hook, 'Smaller');
      await tick(DEBOUNCE_TIMES.SERVER_PUT);
      expect(server.puts).toHaveLength(2);
      expect(hook.result.current.syncFailureReason).toBeNull();
    });
  });
});

describe('legacy sessions without commit IDs', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('fall back to the conflict banner after a lost response, overwriting nothing', async () => {
    clearAllStorage();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const initial = makeWorkshop();
    const putBodies: string[] = [];
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { ...initial, _v: 1 } }) })
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        putBodies.push(init.body as string);
        throw new TypeError('Failed to fetch');
      })
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        putBodies.push(init.body as string);
        return { ok: false, status: 409, json: async () => ({ serverVersion: 2, data: { ...initial, _v: 2 } }) };
      }) as unknown as typeof fetch;
    window.history.replaceState(null, '', '/?id=abcdef012345');
    const hook = renderHook(() => useWorkshop(), { wrapper: wrapper('/?id=abcdef012345') });
    await tick();
    act(() => hook.result.current.updateMetadata({ title: 'Mine' }));
    await tick(DEBOUNCE_TIMES.SERVER_PUT);
    await tick(SERVER_PUT_RETRY_MS);
    expect(putBodies).toHaveLength(2);
    expect(hook.result.current.incomingUpdate).not.toBeNull();
  });
});

describe('language switch', () => {
  const secrets = `#k=${encryptionKey}&w=${writeCapability}`;
  const render = (entry: string) => renderHook(() => useLanguageSwitcher(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[entry]}><LocaleProvider>{children}</LocaleProvider></MemoryRouter>
    ),
  });

  afterEach(() => window.history.replaceState(null, '', '/'));

  it('keeps the secrets of an open Dynamic Link', () => {
    window.history.replaceState(null, '', `/?id=${key}${secrets}`);
    const { result } = render(`/?id=${key}`);
    expect(result.current.getTargetUrl('en')).toBe(`/en?id=${key}${secrets}`);
    expect(result.current.getTargetUrl('de')).toBe(`/?id=${key}${secrets}`);
  });

  it('reads the session from the live URL when the router has not seen it yet', () => {
    window.history.replaceState(null, '', `/?id=${key}${secrets}`);
    const { result } = render('/');
    expect(result.current.getTargetUrl('en')).toBe(`/en?id=${key}${secrets}`);
  });

  it('does not carry a local session hash or add anything without a session', () => {
    window.history.replaceState(null, '', '/#data=abc');
    const { result } = render('/');
    expect(result.current.getTargetUrl('en')).toBe('/en');
  });
});

describe('useBlockFormState', () => {
  const item = { id: 'a', type: 'block', title: 'Block', duration: 10 } as WorkshopItem;

  it('reports unsaved input until the item catches up', () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: WorkshopItem | null }) => useBlockFormState(current, () => {}),
      { initialProps: { current: item as WorkshopItem | null } },
    );
    expect(result.current.hasUnsavedChanges).toBe(false);
    act(() => result.current.setFormData((prev) => ({ ...prev, title: 'Typed' })));
    expect(result.current.hasUnsavedChanges).toBe(true);
    rerender({ current: { ...item, title: 'Typed' } });
    expect(result.current.hasUnsavedChanges).toBe(false);
    rerender({ current: null });
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});
