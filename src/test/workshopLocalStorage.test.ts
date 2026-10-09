import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateStorageKeys,
  getSessionHistory,
  upsertSessionToHistory,
  removeSessionFromHistory,
  updateSessionLastOpened,
  saveTempWorkshopWithId,
  getTempWorkshopStore,
  getTempWorkshop,
  saveTempWorkshop,
  clearTempWorkshop,
  clearTempWorkshopItems,
  markTempWorkshopForRouteRestore,
  shouldRestoreTempWorkshopOnEntry,
  clearTempWorkshopRestoreMarker,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getBlockLibrary,
  saveBlockToLibrary,
  deleteBlockFromLibrary,
  clearAllData,
  getSidebarCollapsed,
  hasSidebarPreference,
  setSidebarCollapsed,
  getShowFullPreviewText,
  setShowFullPreviewText,
  getPlayModeSounds,
  setPlayModeSounds,
  getTimeVisualizationStrip,
  setTimeVisualizationStrip,
  exportWorkshopAsJson,
  importWorkshopFromJson,
  cleanImportedJson,
  normalizeImportedWorkshop,
  BlockTemplate,
  WorkshopTemplate,
} from '@/lib/workshopLocalStorage';
import { makeWorkshop, makeBlock } from './test-helpers';
import { vi } from 'vitest';
import type { WorkshopData } from '@/types/workshop';

describe('LLM JSON import helpers', () => {
  it('removes JSON Markdown code fences and surrounding whitespace', () => {
    expect(cleanImportedJson('  ```json\n{"version":"1.0"}\n```  ')).toBe('{"version":"1.0"}');
    expect(cleanImportedJson('{"version":"1.0"}')).toBe('{"version":"1.0"}');
  });

  it('fills optional workshop and item fields recursively', () => {
    const normalized = normalizeImportedWorkshop({
      version: '1.0',
      workshop: { title: 'Imported session' },
      blockTypes: [],
      persons: [],
      items: [{
        id: 'group',
        type: 'group',
        title: 'Group',
        duration: 15,
        children: [{ id: 'block', type: 'block', title: 'Block', duration: 15 }],
      }],
    }) as WorkshopData;

    expect(normalized.workshop).toMatchObject({ description: '', date: null, startTime: null });
    expect(normalized.items[0]).toMatchObject({ blockTypeId: null, notes: '', material: '' });
    expect(normalized.items[0].children[0]).toMatchObject({ blockTypeId: null, notes: '', material: '' });
  });
});

// All tests in this file rely on the auto-clearing beforeEach in setup.ts.

// ── migrateStorageKeys ────────────────────────────────────────────────────────

describe('migrateStorageKeys', () => {
  it('migrates legacy workshop-templates-<locale> to sp:templates:<locale>', () => {
    const payload = JSON.stringify([{ id: 'tpl-1', name: 'Old', data: {}, createdAt: '' }]);
    localStorage.setItem('workshop-templates-de', payload);
    localStorage.setItem('workshop-templates-en', payload);

    migrateStorageKeys();

    expect(localStorage.getItem('sp:templates:de')).toBe(payload);
    expect(localStorage.getItem('sp:templates:en')).toBe(payload);
    expect(localStorage.getItem('workshop-templates-de')).toBeNull();
    expect(localStorage.getItem('workshop-templates-en')).toBeNull();
  });

  it('migrates legacy block-library-<locale> and library-initialized-<locale>', () => {
    localStorage.setItem('block-library-de', '[{"id":"b1"}]');
    localStorage.setItem('library-initialized-de', 'true');

    migrateStorageKeys();

    expect(localStorage.getItem('sp:lib:de')).toBe('[{"id":"b1"}]');
    expect(localStorage.getItem('sp:lib-init:de')).toBe('true');
    expect(localStorage.getItem('block-library-de')).toBeNull();
    expect(localStorage.getItem('library-initialized-de')).toBeNull();
  });

  it('migrates temp-current-workshop into the new wrapper format with a session id', () => {
    const data = makeWorkshop();
    localStorage.setItem('temp-current-workshop', JSON.stringify(data));

    migrateStorageKeys();

    const stored = getTempWorkshopStore();
    expect(stored).not.toBeNull();
    expect(stored?.data).toEqual(data);
    expect(stored?.sessionId).toBeTruthy();
    expect(localStorage.getItem('temp-current-workshop')).toBeNull();
  });

  it('migrates UI prefs and removes the legacy keys', () => {
    localStorage.setItem('sidebarCollapsed', 'false');
    localStorage.setItem('showFullPreviewText', 'false');

    migrateStorageKeys();

    // Migrated prefs inherit DEFAULT_PREFS for fields that didn't exist in
    // the legacy store (e.g. playModeSounds, timeVisualizationStrip), so
    // missing keys gracefully fall back to their defaults.
    expect(JSON.parse(localStorage.getItem('sp:prefs')!)).toEqual({
      sidebarCollapsed: false,
      showFullPreviewText: false,
      playModeSounds: false,
      timeVisualizationStrip: false,
    });
    expect(localStorage.getItem('sidebarCollapsed')).toBeNull();
    expect(localStorage.getItem('showFullPreviewText')).toBeNull();
  });

  it('migrates the sessionStorage restore-pending flag', () => {
    sessionStorage.setItem('workshop-temp-restore-pending', '1');

    migrateStorageKeys();

    expect(sessionStorage.getItem('sp:restore-pending')).toBe('1');
    expect(sessionStorage.getItem('workshop-temp-restore-pending')).toBeNull();
  });

  it('removes bare legacy keys even when no localised variants exist', () => {
    localStorage.setItem('workshop-templates', '[]');
    localStorage.setItem('block-library', '[]');
    localStorage.setItem('library-initialized', 'true');

    migrateStorageKeys();

    expect(localStorage.getItem('workshop-templates')).toBeNull();
    expect(localStorage.getItem('block-library')).toBeNull();
    expect(localStorage.getItem('library-initialized')).toBeNull();
  });

  it('is idempotent: a second call is a no-op', () => {
    localStorage.setItem('sidebarCollapsed', 'false');
    migrateStorageKeys();
    localStorage.setItem('sp:prefs', JSON.stringify({ sidebarCollapsed: true, showFullPreviewText: true }));

    // Second call must not clobber the user-edited prefs.
    migrateStorageKeys();
    expect(JSON.parse(localStorage.getItem('sp:prefs')!)).toEqual({
      sidebarCollapsed: true,
      showFullPreviewText: true,
    });
  });

  it('discards corrupt temp-current-workshop data without throwing', () => {
    localStorage.setItem('temp-current-workshop', '{not json}');
    expect(() => migrateStorageKeys()).not.toThrow();
    expect(localStorage.getItem('temp-current-workshop')).toBeNull();
    expect(getTempWorkshopStore()).toBeNull();
  });
});

// ── Session history ───────────────────────────────────────────────────────────

describe('session history', () => {
  it('upserts new entries and updates existing ones by id', () => {
    const now = Date.now();
    upsertSessionToHistory({
      id: 's1',
      title: 'One',
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      itemCount: 1,
      totalDuration: 10,
      type: 'local',
    });
    upsertSessionToHistory({
      id: 's2',
      title: 'Two',
      createdAt: now + 1,
      updatedAt: now + 1,
      lastOpenedAt: now + 1,
      itemCount: 2,
      totalDuration: 20,
      type: 'local',
    });

    let history = getSessionHistory();
    expect(history.map((s) => s.id)).toEqual(['s2', 's1']);

    upsertSessionToHistory({
      id: 's1',
      title: 'One (renamed)',
      createdAt: now,
      updatedAt: now + 100,
      lastOpenedAt: now + 100,
      itemCount: 3,
      totalDuration: 30,
      type: 'local',
    });

    history = getSessionHistory();
    const updated = history.find((s) => s.id === 's1');
    expect(updated?.title).toBe('One (renamed)');
    expect(updated?.itemCount).toBe(3);
  });

  it('removes entries by id', () => {
    const t = Date.now();
    upsertSessionToHistory({
      id: 'a', title: 'A', createdAt: t, updatedAt: t, lastOpenedAt: t,
      itemCount: 1, totalDuration: 1, type: 'local',
    });
    upsertSessionToHistory({
      id: 'b', title: 'B', createdAt: t, updatedAt: t, lastOpenedAt: t,
      itemCount: 1, totalDuration: 1, type: 'local',
    });
    removeSessionFromHistory('a');
    expect(getSessionHistory().map((s) => s.id)).toEqual(['b']);
  });

  it('prunes entries older than 3 months', () => {
    const old = Date.now() - 4 * 30 * 24 * 60 * 60 * 1000;
    const recent = Date.now() - 1 * 24 * 60 * 60 * 1000;
    upsertSessionToHistory({
      id: 'old', title: 'Old', createdAt: old, updatedAt: old, lastOpenedAt: old,
      itemCount: 1, totalDuration: 1, type: 'local',
    });
    upsertSessionToHistory({
      id: 'recent', title: 'Recent', createdAt: recent, updatedAt: recent, lastOpenedAt: recent,
      itemCount: 1, totalDuration: 1, type: 'local',
    });
    const history = getSessionHistory();
    expect(history.find((s) => s.id === 'old')).toBeUndefined();
    expect(history.find((s) => s.id === 'recent')).toBeTruthy();
  });

  it('updates the lastOpenedAt of an existing entry', () => {
    vi.useFakeTimers();
    const t = Date.now();
    vi.setSystemTime(t);
    upsertSessionToHistory({
      id: 'x', title: 'X', createdAt: t, updatedAt: t, lastOpenedAt: t,
      itemCount: 1, totalDuration: 1, type: 'local',
    });
    vi.setSystemTime(t + 5000);
    updateSessionLastOpened('x');
    vi.useRealTimers();
    const entry = getSessionHistory().find((s) => s.id === 'x');
    expect(entry?.lastOpenedAt).toBe(t + 5000);
  });

  it('updateSessionLastOpened is a no-op for unknown ids', () => {
    const t = Date.now();
    upsertSessionToHistory({
      id: 'y', title: 'Y', createdAt: t, updatedAt: t, lastOpenedAt: t,
      itemCount: 1, totalDuration: 1, type: 'local',
    });
    updateSessionLastOpened('does-not-exist');
    expect(getSessionHistory()).toHaveLength(1);
  });
});

// ── Temp workshop ─────────────────────────────────────────────────────────────

describe('temp workshop', () => {
  it('round-trips a workshop via saveTempWorkshopWithId / getTempWorkshopStore', () => {
    const data = makeWorkshop();
    saveTempWorkshopWithId(data, 'sess-1');
    const store = getTempWorkshopStore();
    expect(store?.data).toEqual(data);
    expect(store?.sessionId).toBe('sess-1');
  });

  it('getTempWorkshop returns just the data (backwards-compat)', () => {
    const data = makeWorkshop();
    saveTempWorkshopWithId(data, 'sess-2');
    expect(getTempWorkshop()).toEqual(data);
  });

  it('saveTempWorkshop re-uses the stored sessionId when not provided', () => {
    const data = makeWorkshop();
    saveTempWorkshopWithId(data, 'existing-id');
    saveTempWorkshop(makeWorkshop({ workshop: { ...makeWorkshop().workshop, title: 'Updated' } }));
    expect(getTempWorkshopStore()?.sessionId).toBe('existing-id');
  });

  it('saveTempWorkshop generates a new sessionId when none is stored', () => {
    saveTempWorkshop(makeWorkshop());
    expect(getTempWorkshopStore()?.sessionId).toBeTruthy();
  });

  it('clearTempWorkshop removes the entry', () => {
    saveTempWorkshopWithId(makeWorkshop(), 'x');
    clearTempWorkshop();
    expect(getTempWorkshopStore()).toBeNull();
  });

  it('clearTempWorkshopItems keeps the sessionId and zeroes the items', () => {
    const data = makeWorkshop();
    saveTempWorkshopWithId(data, 'sess-3');
    clearTempWorkshopItems();
    const store = getTempWorkshopStore();
    expect(store?.sessionId).toBe('sess-3');
    expect(store?.data.items).toEqual([]);
  });
});

describe('route-restore marker', () => {
  it('defaults to no-restore', () => {
    expect(shouldRestoreTempWorkshopOnEntry()).toBe(false);
  });
  it('markTempWorkshopForRouteRestore sets the marker', () => {
    markTempWorkshopForRouteRestore();
    expect(shouldRestoreTempWorkshopOnEntry()).toBe(true);
  });
  it('clearTempWorkshopRestoreMarker removes it again', () => {
    markTempWorkshopForRouteRestore();
    clearTempWorkshopRestoreMarker();
    expect(shouldRestoreTempWorkshopOnEntry()).toBe(false);
  });
});

// ── Templates and library ─────────────────────────────────────────────────────

describe('templates & library', () => {
  beforeEach(() => {
    // Reset the libInit flag so initializeLibraryIfNeeded() loads the default
    // library (which fetch()s from /data/defaultLibrary*.json in jsdom).
    // For these tests we explicitly populate the storage to avoid fetch.
    localStorage.setItem('sp:lib-init:de', 'true');
    localStorage.setItem('sp:templates:de', '[]');
    localStorage.setItem('sp:lib:de', '[]');
  });

  it('saves and lists templates', async () => {
    const tpl = await saveTemplate('My Template', makeWorkshop());
    expect(tpl.name).toBe('My Template');
    expect(tpl.id).toBeTruthy();
    const all = await getTemplates();
    expect(all.find((t) => t.id === tpl.id)).toBeTruthy();
  });

  it('deletes templates by id', async () => {
    const tpl = await saveTemplate('Doomed', makeWorkshop());
    await deleteTemplate(tpl.id);
    const all = await getTemplates();
    expect(all.find((t) => t.id === tpl.id)).toBeUndefined();
  });

  it('saves a block to the library with a fresh id', async () => {
    const block = makeBlock({ title: 'Original' });
    const saved = await saveBlockToLibrary('My Block', block);
    expect(saved.name).toBe('My Block');
    expect(saved.item.id).not.toBe(block.id);
    const all = await getBlockLibrary();
    expect(all.find((b) => b.id === saved.id)).toBeTruthy();
  });

  it('deletes blocks from the library', async () => {
    const saved = await saveBlockToLibrary('Doomed', makeBlock());
    await deleteBlockFromLibrary(saved.id);
    const all = await getBlockLibrary();
    expect(all.find((b) => b.id === saved.id)).toBeUndefined();
  });

  it('clearAllData wipes everything and re-initialises the library', async () => {
    const tpl = await saveTemplate('Keep me', makeWorkshop());
    const block = await saveBlockToLibrary('Block', makeBlock());
    saveTempWorkshopWithId(makeWorkshop(), 'sess-4');
    upsertSessionToHistory({
      id: 's1', title: 'X', createdAt: Date.now(), updatedAt: Date.now(),
      lastOpenedAt: Date.now(), itemCount: 1, totalDuration: 1, type: 'local',
    });
    setSidebarCollapsed(false);

    await clearAllData();

    expect(getTempWorkshopStore()).toBeNull();
    expect(getSessionHistory()).toEqual([]);
    // Note: clearAllData re-initialises the library, so the keys may be present
    // again, but user-created entries must be gone.
    const tpls = await getTemplates();
    const blocks = await getBlockLibrary();
    expect(tpls.find((t) => t.id === tpl.id)).toBeUndefined();
    expect(blocks.find((b) => b.id === block.id)).toBeUndefined();
  });
});

// ── UI prefs ──────────────────────────────────────────────────────────────────

describe('UI prefs', () => {
  it('uses the default (sidebarCollapsed=true) when nothing is stored', () => {
    expect(getSidebarCollapsed()).toBe(true);
  });

  it('persists and reads sidebarCollapsed', () => {
    setSidebarCollapsed(false);
    expect(getSidebarCollapsed()).toBe(false);
    expect(hasSidebarPreference()).toBe(true);
  });

  it('hasSidebarPreference returns false when no prefs are stored', () => {
    expect(hasSidebarPreference()).toBe(false);
  });

  it('persists and reads showFullPreviewText', () => {
    setShowFullPreviewText(false);
    expect(getShowFullPreviewText()).toBe(false);
  });

  it('defaults play mode sounds to disabled and persists the setting', () => {
    expect(getPlayModeSounds()).toBe(false);
    setPlayModeSounds(false);
    expect(getPlayModeSounds()).toBe(false);
  });

  it('defaults the time-visualization strip to disabled and persists the setting', () => {
    expect(getTimeVisualizationStrip()).toBe(false);
    setTimeVisualizationStrip(true);
    expect(getTimeVisualizationStrip()).toBe(true);
    setTimeVisualizationStrip(false);
    expect(getTimeVisualizationStrip()).toBe(false);
  });
});

// ── Export / Import ───────────────────────────────────────────────────────────

describe('exportWorkshopAsJson / importWorkshopFromJson', () => {
  it('produces a JSON string of the workshop data', () => {
    const data = makeWorkshop();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob: Blob | null = null;
    let capturedFileName: string | null = null;

    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:fake';
    });
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      capturedFileName = this.download;
    };

    try {
      exportWorkshopAsJson(data);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    }

    expect(blob).not.toBeNull();
    expect(capturedFileName).toMatch(/_workshop\.json$/);
  });

  it('importWorkshopFromJson parses a valid File', async () => {
    const data = makeWorkshop();
    const file = new File([JSON.stringify(data)], 'session.json', { type: 'application/json' });
    const parsed = await importWorkshopFromJson(file);
    expect(parsed).toEqual(data);
  });

  it('importWorkshopFromJson rejects invalid JSON', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    await expect(importWorkshopFromJson(file)).rejects.toThrow('Invalid JSON file');
  });

  it('importWorkshopFromJson rejects valid JSON with an invalid workshop shape', async () => {
    const file = new File([JSON.stringify({})], 'bad-workshop.json', { type: 'application/json' });
    await expect(importWorkshopFromJson(file)).rejects.toThrow('Invalid JSON file');
  });

  it('importWorkshopFromJson accepts exported groups without optional item fields', async () => {
    const data = {
      ...makeWorkshop(),
      items: [{
        id: 'group-1',
        type: 'group',
        title: 'Session',
        duration: 30,
        children: [],
      }],
    };
    const file = new File([JSON.stringify(data)], 'group-workshop.json', { type: 'application/json' });
    await expect(importWorkshopFromJson(file)).resolves.toMatchObject({
      ...data,
      workshop: { ...data.workshop, description: data.workshop.description, date: data.workshop.date, startTime: data.workshop.startTime },
      items: [{ ...data.items[0], blockTypeId: null, notes: '', material: '' }],
    });
  });

  it('importWorkshopFromJson accepts an LLM Markdown code fence', async () => {
    const data = makeWorkshop();
    const file = new File(['```json\n' + JSON.stringify(data) + '\n```\n'], 'session.md', { type: 'text/markdown' });
    await expect(importWorkshopFromJson(file)).resolves.toEqual(data);
  });

  it('parseWorkshopJson accepts a pasted JSON object and a JSON string containing an object', async () => {
    const data = makeWorkshop();
    const { parseWorkshopJson } = await import('@/lib/workshopLocalStorage');

    expect(parseWorkshopJson(JSON.stringify(data))).toEqual(data);
    expect(parseWorkshopJson(JSON.stringify(JSON.stringify(data)))).toEqual(data);
  });
});
