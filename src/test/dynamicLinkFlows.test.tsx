import { webcrypto } from 'node:crypto';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkshop } from '@/hooks/useWorkshop';
import { createDynamicSecret, encryptWorkshop } from '@/lib/dynamicLinkCrypto';
import { decodeWorkshopFromUrl, getLegacyMigration, getSessionHistory, removeSessionFromHistory, saveLegacyMigration, clearAllData, KEYS } from '@/lib/workshopStorage';
import { makeWorkshop, makeBlock } from './test-helpers';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
const legacyKey = 'abcdef012345';
const initial = makeWorkshop({ items: [makeBlock()], workshop: { ...makeWorkshop().workshop, title: 'Original' } });
let sessions: Map<string, Record<string, unknown>>;
let unavailable: 'none' | 'network' | 'invalidKey';
let fetchMock: ReturnType<typeof vi.fn>;
const mount = () => renderHook(() => useWorkshop(), { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
const loadLegacy = () => window.history.replaceState(null, '', `/?id=${legacyKey}`);
const mutations = () => fetchMock.mock.calls.filter(([, init]) => ['POST', 'DELETE'].includes(init?.method));

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  unavailable = 'none';
  sessions = new Map([[legacyKey, { ...initial, _v: 1 }]]);
  fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const id = new URL(input, window.location.origin).searchParams.get('id');
    if (init.method === 'POST') {
      const body = JSON.parse(String(init.body));
      sessions.set(body.id, { ...body, _v: 1 });
      return { ok: true, status: 201, json: async () => ({ key: body.id, version: 1 }) };
    }
    if (id !== legacyKey && unavailable === 'network') throw new TypeError('Failed to fetch');
    const data = sessions.get(id);
    return { ok: !!data, status: data ? 200 : 404, json: async () => ({ data: unavailable === 'invalidKey' && id !== legacyKey ? { ...data, ciphertext: 'invalid' } : data }) };
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('encrypted link migration', () => {
  it('creates once despite repeated clicks, returns the new editor URL and remembers it independently of history', async () => {
    loadLegacy(); const hook = mount();
    await waitFor(() => expect(hook.result.current.isServerSessionLoaded).toBe(true));
    expect(getSessionHistory().some(entry => entry.serverKey === legacyKey)).toBe(true);
    let urls: (string | null)[];
    await act(async () => { urls = await Promise.all([hook.result.current.migrateLegacySession(), hook.result.current.migrateLegacySession()]); });
    expect(mutations()).toHaveLength(1);
    expect(urls[0]).toBe(window.location.href);
    expect(urls[0]).toContain('&w=');
    expect(urls[1]).toBeNull();
    const mapping = getLegacyMigration(legacyKey)!;
    expect(getSessionHistory().filter(entry => entry.type === 'dynamic').map(entry => entry.serverKey)).toEqual([mapping.serverKey]);
    expect(JSON.parse(localStorage.getItem(KEYS.sessions)!).some(entry => entry.serverKey === legacyKey)).toBe(false);
    expect(sessions.has(legacyKey)).toBe(true);
    removeSessionFromHistory(getSessionHistory().find(entry => entry.serverKey === mapping.serverKey)!.id);
    expect(getLegacyMigration(legacyKey)).toEqual(mapping);

    // Returning via the old bookmark opens the new copy's current content,
    // without overwriting it with the old legacy plan.
    const newData = { ...initial, workshop: { ...initial.workshop, title: 'Updated protected copy' } };
    const secret = new URLSearchParams(mapping.serverHash.slice(1)).get('k')!;
    sessions.set(mapping.serverKey, { ...await encryptWorkshop(newData, mapping.serverKey, secret), _v: 3 });
    hook.unmount(); loadLegacy(); const reopened = mount();
    await waitFor(() => expect(reopened.result.current.isServerSessionLoaded).toBe(true));
    expect(reopened.result.current.legacyMigrationStatus).toBe('existing');
    expect(getSessionHistory().some(entry => entry.serverKey === legacyKey)).toBe(true);
    await act(async () => { await reopened.result.current.migrateLegacySession(); });
    expect(reopened.result.current.workshop.workshop.title).toBe('Updated protected copy');
    expect(reopened.result.current.serverKey).toBe(mapping.serverKey);
    expect(getSessionHistory().filter(entry => entry.type === 'dynamic').map(entry => entry.serverKey)).toEqual([mapping.serverKey]);
    expect(mutations()).toHaveLength(1);
  });

  it('requires an explicit second action after a confirmed 404 before creating a replacement', async () => {
    saveLegacyMigration(legacyKey, { serverKey: 'A'.repeat(22), serverHash: `#k=${'B'.repeat(43)}&w=${'C'.repeat(43)}` });
    loadLegacy(); const hook = mount();
    await waitFor(() => expect(hook.result.current.isServerSessionLoaded).toBe(true));
    await act(async () => { expect(await hook.result.current.migrateLegacySession()).toBeNull(); });
    expect(hook.result.current.legacyMigrationStatus).toBe('missing');
    expect(hook.result.current.serverKey).toBe(legacyKey);
    expect(mutations()).toHaveLength(0);
    await act(async () => { await hook.result.current.migrateLegacySession(); });
    expect(mutations()).toHaveLength(1);
    expect(getLegacyMigration(legacyKey)?.serverKey).toBe(hook.result.current.serverKey);
  });

  it.each(['network', 'invalidKey'] as const)('does not create a replacement after %s failure', async (failure) => {
    const key = 'A'.repeat(22), secret = createDynamicSecret();
    sessions.set(key, { ...await encryptWorkshop(initial, key, secret), _v: 1 });
    saveLegacyMigration(legacyKey, { serverKey: key, serverHash: `#k=${secret}&w=${createDynamicSecret()}` });
    unavailable = failure;
    loadLegacy(); const hook = mount();
    await waitFor(() => expect(hook.result.current.isServerSessionLoaded).toBe(true));
    await act(async () => { await expect(hook.result.current.migrateLegacySession()).rejects.toThrow(); });
    expect(hook.result.current.serverKey).toBe(legacyKey);
    expect(hook.result.current.legacyMigrationStatus).toBe('existing');
    expect(mutations()).toHaveLength(0);
    unavailable = 'none';
    await act(async () => { await hook.result.current.migrateLegacySession(); });
    expect(hook.result.current.serverKey).toBe(key);
    expect(mutations()).toHaveLength(0);
  });

  it('retains the new session after localStorage failure without retrying its POST', async () => {
    loadLegacy(); const hook = mount();
    await waitFor(() => expect(hook.result.current.isServerSessionLoaded).toBe(true));
    const original = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === KEYS.legacyMigrations) throw new Error('Storage full');
      original(key, value);
    });
    await act(async () => { await hook.result.current.migrateLegacySession(); });
    expect(hook.result.current.canEditServerSession).toBe(true);
    expect(getSessionHistory().some(entry => entry.serverKey === legacyKey)).toBe(false);
    await act(async () => { expect(await hook.result.current.migrateLegacySession()).toBeNull(); });
    expect(mutations()).toHaveLength(1);
    spy.mockRestore();
  });

  it('removes migration mappings when all local app data is cleared', async () => {
    saveLegacyMigration(legacyKey, { serverKey: 'A'.repeat(22), serverHash: `#k=${'B'.repeat(43)}&w=${'C'.repeat(43)}` });
    // Library reload performed by clearAllData uses the same mocked transport.
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ blocks: [], templates: [] }) });
    await clearAllData();
    expect(getLegacyMigration(legacyKey)).toBeNull();
  });
});

it('activates a local session once despite concurrent calls and returns its editor URL', async () => {
  const hook = mount();
  act(() => hook.result.current.loadWorkshop(initial));
  let urls: (string | null)[];
  await act(async () => { urls = await Promise.all([hook.result.current.enableServerMode(), hook.result.current.enableServerMode()]); });
  expect(urls[0]).toBe(window.location.href);
  expect(urls[0]).toContain('&w=');
  expect(urls[1]).toBeNull();
  expect(mutations()).toHaveLength(1);
});

it('saves conflicted edits as a reopenable local copy without POST or DELETE', async () => {
  const key = 'A'.repeat(22), secret = createDynamicSecret();
  sessions.set(key, { ...await encryptWorkshop(initial, key, secret), _v: 1 });
  window.history.replaceState(null, '', `/?id=${key}#k=${secret}`);
  const hook = mount();
  await waitFor(() => expect(hook.result.current.isServerSessionLoaded).toBe(true));
  act(() => hook.result.current.updateMetadata({ title: 'My local edits' }));
  sessions.set(key, { ...await encryptWorkshop(initial, key, secret), _v: 2 });
  await act(async () => { await hook.result.current.pollNow(); });
  expect(hook.result.current.incomingUpdate).not.toBeNull();
  act(() => hook.result.current.createLocalCopy());
  expect(hook.result.current.serverKey).toBeNull();
  expect(hook.result.current.incomingUpdate).toBeNull();
  expect(hook.result.current.hasUnsyncedChanges).toBe(false);
  expect(window.location.search).toBe('');
  expect(decodeWorkshopFromUrl(window.location.hash.slice('#data='.length))?.workshop.title).toBe('My local edits');
  expect(getSessionHistory().find(entry => entry.type === 'local')?.urlHash).toBeTruthy();
  expect(mutations()).toHaveLength(0);
});
