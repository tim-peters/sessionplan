/**
 * Integration tests for the URL and browser-history rules of the planner, on
 * the real window.history: saving never adds an entry, closing replaces one,
 * and no history navigation may overwrite another session's history entry.
 */
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkshop } from '@/hooks/useWorkshop';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { LocaleProvider } from '@/contexts/LocaleContext';
import {
  encodeWorkshopToUrl,
  getHistorySessionId,
  getSessionHistory,
  setKeyToUrl,
  upsertSessionToHistory,
} from '@/lib/workshopStorage';
import type { WorkshopData } from '@/types/workshop';
import type { SessionHistoryEntry } from '@/types/sessionHistory';
import { makeBlock, makeWorkshop } from './test-helpers';

const DYNAMIC_KEY = 'abcdef012345';
const named = (title: string): WorkshopData =>
  makeWorkshop({ items: [makeBlock()], workshop: { ...makeWorkshop().workshop, title } });

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <LocaleProvider>{children}</LocaleProvider>
  </BrowserRouter>
);
const mount = (prefill?: Parameters<typeof useWorkshop>[0]) =>
  renderHook(() => useWorkshop(prefill), { wrapper });

const openUrl = (url: string) => window.history.pushState(null, '', url);
const hashOf = (data: WorkshopData) => `#data=${encodeWorkshopToUrl(data)}`;
const localEntry = (id: string, data: WorkshopData): SessionHistoryEntry => ({
  id,
  title: data.workshop.title,
  createdAt: 1,
  updatedAt: Date.now(),
  lastOpenedAt: Date.now(),
  itemCount: data.items.length,
  totalDuration: 10,
  type: 'local',
  urlHash: encodeWorkshopToUrl(data),
});
const entry = (id: string) => getSessionHistory().find((s) => s.id === id);
const titles = () => getSessionHistory().map((s) => s.title).sort();

const go = (direction: 'back' | 'forward') =>
  act(async () => {
    await new Promise((resolve) => {
      window.addEventListener('popstate', resolve, { once: true });
      window.history[direction]();
    });
  });

/** Lets both debounces pass (session save 350 ms, hash write 500 ms). */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { ...named('Dynamisch'), _v: 1 } }),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('saving adds no browser history entry', () => {
  it('a template leads straight back to the page it was opened from', async () => {
    openUrl('/templates');
    openUrl('/templates/retro');
    const length = window.history.length;
    mount({ workshopTitle: 'Retro', items: [makeBlock()] });
    await settle();

    expect(window.location.hash).toMatch(/^#data=/);
    expect(window.history.length).toBe(length);

    await go('back');
    expect(window.location.pathname).toBe('/templates');
  });

  it('the first block on the empty state stays on the same entry', async () => {
    const length = window.history.length;
    const hook = mount();
    act(() => { hook.result.current.addItem(makeBlock()); });
    await settle();

    expect(window.location.hash).toMatch(/^#data=/);
    expect(window.history.length).toBe(length);
  });

  it('turning a local session into a Dynamic Link keeps the entry', () => {
    openUrl(`/${hashOf(named('A'))}`);
    const length = window.history.length;

    setKeyToUrl(DYNAMIC_KEY, 'secret');

    expect(window.history.length).toBe(length);
    expect(window.location.search).toBe(`?id=${DYNAMIC_KEY}`);
    expect(window.location.hash).toBe('#k=secret');
  });

  it('does not touch the Dynamic Link of a session still loading from the list', async () => {
    const hook = mount();
    await settle();
    upsertSessionToHistory({ ...localEntry('d', named('D')), type: 'dynamic', urlHash: undefined, serverKey: DYNAMIC_KEY, serverHash: '#k=secret' });
    act(() => { hook.result.current.loadSessionFromHistory(entry('d')!); });

    await waitFor(() => expect(window.location.search).toBe(`?id=${DYNAMIC_KEY}`));
    expect(window.location.hash).toBe('#k=secret');
  });
});

describe('closing a session', () => {
  it('replaces the entry and leaves the session in the list', async () => {
    openUrl(`/${hashOf(named('A'))}`);
    const hook = mount();
    await settle();
    const length = window.history.length;

    act(() => { hook.result.current.resetWorkshop(); });

    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(length);
    expect(hook.result.current.workshop.items).toHaveLength(0);
    expect(titles()).toEqual(['A']);
  });

  it('keeps an edit made right before closing', async () => {
    openUrl(`/${hashOf(named('A'))}`);
    const hook = mount();
    await settle();

    act(() => { hook.result.current.updateMetadata({ title: 'Letzte Änderung' }); });
    act(() => { hook.result.current.resetWorkshop(); });

    expect(titles()).toEqual(['Letzte Änderung']);
  });

  it('returns to the empty state instead of stacking a second one after opening from the list', async () => {
    upsertSessionToHistory(localEntry('a', named('A')));
    const hook = mount();
    await settle();
    const emptyEntryUrl = window.location.href;

    act(() => { hook.result.current.loadSessionFromHistory(entry('a')!); });
    await settle();
    expect(window.location.hash).toMatch(/^#data=/);

    await act(async () => {
      await new Promise((resolve) => {
        window.addEventListener('popstate', resolve, { once: true });
        hook.result.current.resetWorkshop();
      });
    });

    expect(window.location.href).toBe(emptyEntryUrl);
    expect(hook.result.current.workshop.items).toHaveLength(0);
  });

  it('replaces the entry when a fallback page takes over, even after opening from the list', async () => {
    upsertSessionToHistory(localEntry('a', named('A')));
    const hook = mount();
    act(() => { hook.result.current.loadSessionFromHistory(entry('a')!); });
    const back = vi.spyOn(window.history, 'back');

    act(() => { hook.result.current.resetWorkshop({ navigatesAway: true }); });

    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    back.mockRestore();
  });
});

describe('session identity', () => {
  it('a foreign snapshot link leaves the previously open session untouched', async () => {
    upsertSessionToHistory(localEntry('a', named('A')));
    openUrl(`/${hashOf(named('Geteilt'))}`);
    mount();
    await settle();

    expect(entry('a')?.title).toBe('A');
    expect(titles()).toEqual(['A', 'Geteilt']);
  });

  it('a snapshot identical to a known entry belongs to that entry', async () => {
    const data = named('A');
    upsertSessionToHistory(localEntry('a', data));
    openUrl(`/${hashOf(data)}`);
    mount();
    await settle();

    expect(getSessionHistory().map((s) => s.id)).toEqual(['a']);
    expect(getHistorySessionId()).toBe('a');
  });

  it('Back to an earlier session never overwrites the one in between', async () => {
    upsertSessionToHistory(localEntry('a', named('A')));
    upsertSessionToHistory(localEntry('b', named('B')));
    const hook = mount();
    await settle();

    act(() => { hook.result.current.loadSessionFromHistory(entry('a')!); });
    await settle();
    openUrl('/');
    await go('back');
    await go('forward');
    await settle();
    act(() => { hook.result.current.loadSessionFromHistory(entry('b')!); });
    await settle();

    await go('back');
    await go('back');
    await settle();

    expect(hook.result.current.workshop.workshop.title).toBe('A');
    expect(entry('a')?.title).toBe('A');
    expect(entry('b')?.title).toBe('B');
  });

  it('a reload keeps the session and picks up its latest state', async () => {
    openUrl(`/${hashOf(named('A'))}`);
    const first = mount();
    await settle();
    const id = getHistorySessionId();
    expect(id).toBeTruthy();
    first.unmount();

    upsertSessionToHistory(localEntry(id!, named('Neuer als der Hash')));
    const second = mount();

    expect(second.result.current.workshop.workshop.title).toBe('Neuer als der Hash');
    await settle();
    expect(getSessionHistory().map((s) => s.id)).toEqual([id]);
  });

  it('leaving the planner within the debounce keeps the edit', async () => {
    openUrl(`/${hashOf(named('A'))}`);
    const hook = mount();
    await settle();

    act(() => { hook.result.current.updateMetadata({ title: 'Kurz vor dem Impressum' }); });
    hook.unmount();

    expect(titles()).toEqual(['Kurz vor dem Impressum']);
  });
});

describe('Dynamic Links', () => {
  const dynamicEntry = (): SessionHistoryEntry => ({
    ...localEntry('d', named('Dynamisch')),
    type: 'dynamic',
    urlHash: undefined,
    serverKey: DYNAMIC_KEY,
    serverHash: '#k=secret&w=write',
  });

  it('local data never replaces a dynamic history entry', async () => {
    upsertSessionToHistory(dynamicEntry());
    window.history.replaceState({ spSessionId: 'd' }, '', `/${hashOf(named('Lokal'))}`);
    mount();
    await settle();

    expect(entry('d')?.type).toBe('dynamic');
    expect(entry('d')?.serverHash).toBe('#k=secret&w=write');
    expect(titles()).toEqual(['Dynamisch', 'Lokal']);
  });

  it('Back to a local entry leaves server mode', async () => {
    openUrl(`/${hashOf(named('Lokal'))}`);
    openUrl(`/?id=${DYNAMIC_KEY}`);
    const hook = mount();
    await waitFor(() => expect(hook.result.current.isServerSessionLoaded).toBe(true));

    await go('back');

    expect(hook.result.current.serverKey).toBeNull();
    expect(hook.result.current.workshop.workshop.title).toBe('Lokal');
  });

  it('closing removes the ID, also from language links of a stale router location', async () => {
    openUrl(`/?id=${DYNAMIC_KEY}#k=secret&w=write`);
    const hook = renderHook(() => ({ ws: useWorkshop(), lang: useLanguageSwitcher() }), { wrapper });
    await waitFor(() => expect(hook.result.current.ws.isServerSessionLoaded).toBe(true));
    expect(hook.result.current.lang.getTargetUrl('en')).toBe(`/en?id=${DYNAMIC_KEY}#k=secret&w=write`);

    act(() => {
      hook.result.current.ws.resetSyncState();
      hook.result.current.ws.resetWorkshop();
    });

    expect(window.location.search).toBe('');
    expect(hook.result.current.lang.getTargetUrl('en')).toBe('/en');
  });
});
