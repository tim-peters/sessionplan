/**
 * @file workshopLocalStorage — localStorage/sessionStorage persistence.
 *
 * Storage keys use the `sp:` namespace prefix to avoid collisions.
 * Call `migrateStorageKeys()` once on app startup to migrate pre-v2 keys.
 */
import { MAX_DAYS, WorkshopData, WorkshopDay, WorkshopItem, generateId } from '@/types/workshop';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import { withoutNegativeDurations } from '@/lib/workshopUtils';

// ── Default library loader ────────────────────────────────────────────────────

const loadDefaultLibrary = async () => {
  try {
    const locale = window.location.pathname.startsWith('/en') ? 'en' : 'de';
    const path = locale === 'en' ? '/data/defaultLibrary.en.json' : '/data/defaultLibrary.json';
    const response = await fetch(path);
    if (!response.ok) throw new Error('Failed to load default library');
    return await response.json();
  } catch (error) {
    console.error('Error loading default library:', error);
    return { blocks: [], templates: [] };
  }
};

// ── Storage keys ──────────────────────────────────────────────────────────────

export const KEYS = {
  /** Session history list. */
  sessions: 'sp:sessions',
  /** Legacy ID to encrypted link; independent of the history registry. */
  legacyMigrations: 'sp:legacy-migrations',
  /** Per-locale workshop template library. */
  templates: (locale: string) => `sp:templates:${locale}`,
  /** Per-locale block library. */
  lib: (locale: string) => `sp:lib:${locale}`,
  /** Per-locale library initialised flag. */
  libInit: (locale: string) => `sp:lib-init:${locale}`,
  /** UI preferences. */
  prefs: 'sp:prefs',
  /** Theme preference (`light` / `dark` / `system`), managed by next-themes. */
  theme: 'sp:theme',
  /** Migration guard. */
  migrated: 'sp:_migrated_v1',
} as const;

const getLocale = () => (window.location.pathname.startsWith('/en') ? 'en' : 'de');

// ── Storage migration (legacy → sp: keys) ────────────────────────────────────

/**
 * One-time migration from the pre-v2 key scheme to the `sp:` namespace.
 * Safe to call multiple times — skips if the migration guard is already set.
 * Must be called synchronously before `ReactDOM.createRoot()`.
 */
export const migrateStorageKeys = (): void => {
  try {
    // The former auto-save copy of the open session, now covered by `sp:sessions`.
    // Dynamic Link content in it was stored decrypted.
    localStorage.removeItem('sp:temp');

    if (localStorage.getItem(KEYS.migrated)) return;

    for (const locale of ['de', 'en']) {
      const templatesOld = `workshop-templates-${locale}`;
      const libOld = `block-library-${locale}`;
      const libInitOld = `library-initialized-${locale}`;

      const templates = localStorage.getItem(templatesOld);
      if (templates) {
        localStorage.setItem(KEYS.templates(locale), templates);
        localStorage.removeItem(templatesOld);
      }

      const lib = localStorage.getItem(libOld);
      if (lib) {
        localStorage.setItem(KEYS.lib(locale), lib);
        localStorage.removeItem(libOld);
      }

      const libInit = localStorage.getItem(libInitOld);
      if (libInit) {
        localStorage.setItem(KEYS.libInit(locale), libInit);
        localStorage.removeItem(libInitOld);
      }
    }

    // Remove bare (non-locale-suffixed) legacy keys.
    for (const oldKey of ['workshop-templates', 'block-library', 'library-initialized']) {
      localStorage.removeItem(oldKey);
    }

    localStorage.removeItem('temp-current-workshop');

    // Migrate UI prefs.
    const sidebarOld = localStorage.getItem('sidebarCollapsed');
    const previewOld = localStorage.getItem('showFullPreviewText');
    if (sidebarOld !== null || previewOld !== null) {
      const prefs: UIPrefs = {
        ...DEFAULT_PREFS,
        sidebarCollapsed: sidebarOld === null ? true : sidebarOld === 'true',
        showFullPreviewText: previewOld === null ? true : previewOld === 'true',
      };
      localStorage.setItem(KEYS.prefs, JSON.stringify(prefs));
      localStorage.removeItem('sidebarCollapsed');
      localStorage.removeItem('showFullPreviewText');
    }

    localStorage.setItem(KEYS.migrated, '1');
  } catch (error) {
    console.error('Storage migration failed:', error);
  }
};

// ── Session history ───────────────────────────────────────────────────────────

const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000;

const pruneExpiredSessions = (entries: SessionHistoryEntry[]): SessionHistoryEntry[] => {
  const cutoff = Date.now() - THREE_MONTHS_MS;
  return entries.filter((e) => e.lastOpenedAt >= cutoff);
};

export const getSessionHistory = (): SessionHistoryEntry[] => {
  try {
    const stored = localStorage.getItem(KEYS.sessions);
    const entries: SessionHistoryEntry[] = stored ? JSON.parse(stored) : [];
    const pruned = pruneExpiredSessions(entries);
    if (pruned.length !== entries.length) {
      localStorage.setItem(KEYS.sessions, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
};

export const upsertSessionToHistory = (entry: SessionHistoryEntry): void => {
  try {
    const sessions = getSessionHistory();
    const idx = sessions.findIndex((s) => s.id === entry.id);
    if (idx >= 0) {
      sessions[idx] = entry;
    } else {
      sessions.unshift(entry);
    }
    localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to upsert session to history:', error);
  }
};

export const removeSessionFromHistory = (id: string): void => {
  try {
    const sessions = getSessionHistory().filter((s) => s.id !== id);
    localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to remove session from history:', error);
  }
};

export const updateSessionLastOpened = (id: string): void => {
  try {
    const sessions = getSessionHistory();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx >= 0) {
      sessions[idx] = { ...sessions[idx], lastOpenedAt: Date.now() };
      localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Failed to update session lastOpenedAt:', error);
  }
};

/** Secrets stay in this browser, just like the session history's serverHash. */
export interface LegacyMigrationTarget {
  serverKey: string;
  serverHash: string;
}

export const getLegacyMigration = (legacyKey: string): LegacyMigrationTarget | null => {
  try {
    const entry = JSON.parse(localStorage.getItem(KEYS.legacyMigrations) ?? '{}')[legacyKey];
    if (!/^[a-f0-9]{12}$/.test(legacyKey) || !entry ||
        !/^[A-Za-z0-9_-]{22}$/.test(entry.serverKey) || typeof entry.serverHash !== 'string') return null;
    const params = new URLSearchParams(entry.serverHash.slice(1));
    if (!entry.serverHash.startsWith('#') ||
        !/^[A-Za-z0-9_-]{43}$/.test(params.get('k') ?? '') ||
        !/^[A-Za-z0-9_-]{43}$/.test(params.get('w') ?? '')) return null;
    return { serverKey: entry.serverKey, serverHash: entry.serverHash };
  } catch {
    return null;
  }
};

export const saveLegacyMigration = (legacyKey: string, target: LegacyMigrationTarget): void => {
  let entries: Record<string, LegacyMigrationTarget> = {};
  try {
    const stored = JSON.parse(localStorage.getItem(KEYS.legacyMigrations) ?? '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) entries = stored;
  } catch { /* Replace corrupt metadata without affecting the sessions. */ }
  // Propagate storage failures: callers retain an in-memory mapping as well.
  localStorage.setItem(KEYS.legacyMigrations, JSON.stringify({ ...entries, [legacyKey]: target }));
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkshopTemplate {
  id: string;
  name: string;
  createdAt: string;
  data: WorkshopData;
  isDefault?: boolean;
}

export interface BlockTemplate {
  id: string;
  name: string;
  createdAt: string;
  item: WorkshopItem;
  isDefault?: boolean;
}

// ── Library & templates ───────────────────────────────────────────────────────

const initializeLibraryIfNeeded = async (): Promise<void> => {
  try {
    const locale = getLocale();
    const initKey = KEYS.libInit(locale);
    const initialized = localStorage.getItem(initKey);
    if (!initialized) {
      const defaultLibraryData = await loadDefaultLibrary();

      const defaultBlocks = defaultLibraryData.blocks.map((block: BlockTemplate) => ({
        ...block,
        createdAt: new Date().toISOString(),
      }));
      localStorage.setItem(KEYS.lib(locale), JSON.stringify(defaultBlocks));

      const defaultTemplates = defaultLibraryData.templates.map((template: WorkshopTemplate) => ({
        ...template,
        createdAt: new Date().toISOString(),
      }));
      localStorage.setItem(KEYS.templates(locale), JSON.stringify(defaultTemplates));

      localStorage.setItem(initKey, 'true');
    }
  } catch (error) {
    console.error('Failed to initialize library:', error);
  }
};

export const getTemplates = async (): Promise<WorkshopTemplate[]> => {
  await initializeLibraryIfNeeded();
  try {
    const stored = localStorage.getItem(KEYS.templates(getLocale()));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveTemplate = async (name: string, data: WorkshopData): Promise<WorkshopTemplate> => {
  const templates = await getTemplates();
  const template: WorkshopTemplate = {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    data,
  };
  templates.push(template);
  localStorage.setItem(KEYS.templates(getLocale()), JSON.stringify(templates));
  return template;
};

export const deleteTemplate = async (id: string): Promise<void> => {
  const templates = (await getTemplates()).filter((t) => t.id !== id);
  localStorage.setItem(KEYS.templates(getLocale()), JSON.stringify(templates));
};

export const getBlockLibrary = async (): Promise<BlockTemplate[]> => {
  await initializeLibraryIfNeeded();
  try {
    const stored = localStorage.getItem(KEYS.lib(getLocale()));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveBlockToLibrary = async (name: string, item: WorkshopItem): Promise<BlockTemplate> => {
  const library = await getBlockLibrary();
  const template: BlockTemplate = {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    item: { ...item, id: generateId() },
  };
  library.push(template);
  localStorage.setItem(KEYS.lib(getLocale()), JSON.stringify(library));
  return template;
};

export const deleteBlockFromLibrary = async (id: string): Promise<void> => {
  const library = (await getBlockLibrary()).filter((b) => b.id !== id);
  localStorage.setItem(KEYS.lib(getLocale()), JSON.stringify(library));
};

export const clearAllData = async (): Promise<void> => {
  for (const locale of ['de', 'en']) {
    localStorage.removeItem(KEYS.templates(locale));
    localStorage.removeItem(KEYS.lib(locale));
    localStorage.removeItem(KEYS.libInit(locale));
  }
  localStorage.removeItem(KEYS.sessions);
  localStorage.removeItem(KEYS.legacyMigrations);
  localStorage.removeItem(KEYS.prefs);
  localStorage.removeItem(KEYS.theme);
  await initializeLibraryIfNeeded();
};

// ── UI Preferences ────────────────────────────────────────────────────────────

interface UIPrefs {
  sidebarCollapsed: boolean;
  showFullPreviewText: boolean;
  playModeSounds: boolean;
  /** Off by default — opt-in to render the slim time-distribution strip on
   *  the right edge of the planner. */
  timeVisualizationStrip: boolean;
  keyboardShortcutsEnabled: boolean;
}

const DEFAULT_PREFS: UIPrefs = {
  sidebarCollapsed: true,
  showFullPreviewText: true,
  playModeSounds: false,
  timeVisualizationStrip: false,
  keyboardShortcutsEnabled: true,
};

export const getDefaultPrefs = (): UIPrefs => DEFAULT_PREFS;

const getPrefs = (): UIPrefs => {
  try {
    const stored = localStorage.getItem(KEYS.prefs);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) } as UIPrefs;
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
};

const savePrefs = (patch: Partial<UIPrefs>): void => {
  const prefs = { ...getPrefs(), ...patch };
  localStorage.setItem(KEYS.prefs, JSON.stringify(prefs));
};

export const getSidebarCollapsed = (): boolean => getPrefs().sidebarCollapsed;

export const hasSidebarPreference = (): boolean => {
  try {
    const stored = localStorage.getItem(KEYS.prefs);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as Partial<UIPrefs>;
    return parsed.sidebarCollapsed !== undefined;
  } catch {
    return false;
  }
};

export const setSidebarCollapsed = (collapsed: boolean): void => {
  savePrefs({ sidebarCollapsed: collapsed });
};

export const getShowFullPreviewText = (): boolean => getPrefs().showFullPreviewText;

export const setShowFullPreviewText = (value: boolean): void => {
  savePrefs({ showFullPreviewText: value });
};

export const getPlayModeSounds = (): boolean => getPrefs().playModeSounds;

export const setPlayModeSounds = (value: boolean): void => {
  savePrefs({ playModeSounds: value });
};

export const getTimeVisualizationStrip = (): boolean => getPrefs().timeVisualizationStrip;

export const setTimeVisualizationStrip = (value: boolean): void => {
  savePrefs({ timeVisualizationStrip: value });
};

export const getKeyboardShortcutsEnabled = (): boolean => getPrefs().keyboardShortcutsEnabled;

export const setKeyboardShortcutsEnabled = (value: boolean): void => {
  savePrefs({ keyboardShortcutsEnabled: value });
};

// ── Export / Import ───────────────────────────────────────────────────────────

export const exportWorkshopAsJson = (data: WorkshopData): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.workshop.title.replace(/[^a-z0-9]/gi, '_')}_workshop.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importWorkshopFromJson = (file: File): Promise<WorkshopData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(parseWorkshopJson(e.target?.result as string));
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/** Parses JSON pasted from an LLM or read from an imported file. */
export const parseWorkshopJson = (value: string): WorkshopData => {
  let parsed: unknown = JSON.parse(cleanImportedJson(value));

  // Some LLMs return a JSON string containing the actual JSON object.
  if (typeof parsed === 'string') {
    parsed = JSON.parse(cleanImportedJson(parsed));
  }

  const data = normalizeImportedWorkshop(parsed);
  if (!isWorkshopData(data)) {
    throw new Error('Invalid workshop data');
  }
  return withoutNegativeDurations(data);
};

/** Removes the Markdown fence users commonly copy from an LLM response. */
export const cleanImportedJson = (value: string): string => {
  return value
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
};

/** Fills optional fields that are safe to omit in LLM-generated JSON. */
export const normalizeImportedWorkshop = (value: unknown): unknown => {
  if (!isRecord(value)) return value;

  const workshop = isRecord(value.workshop)
    ? {
        ...value.workshop,
        description: value.workshop.description ?? '',
        date: value.workshop.date ?? null,
        startTime: value.workshop.startTime ?? null,
      }
    : value.workshop;

  return {
    ...value,
    workshop,
    items: Array.isArray(value.items) ? value.items.map(normalizeImportedItem) : value.items,
    ...(Array.isArray(value.days) ? { days: value.days.map(normalizeImportedDay) } : {}),
  };
};

const normalizeImportedDay = (value: unknown): unknown => {
  if (!isRecord(value) || !Array.isArray(value.items)) return value;

  return { ...value, items: value.items.map(normalizeImportedItem) };
};

const normalizeImportedItem = (value: unknown): unknown => {
  if (!isRecord(value)) return value;

  return {
    ...value,
    blockTypeId: value.blockTypeId ?? null,
    notes: value.notes ?? '',
    material: value.material ?? '',
    children: Array.isArray(value.children) ? value.children.map(normalizeImportedItem) : value.children,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isWorkshopItem = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    (value.type !== 'block' && value.type !== 'group' && value.type !== 'breakout') ||
    (value.blockTypeId !== undefined && value.blockTypeId !== null && typeof value.blockTypeId !== 'string') ||
    typeof value.title !== 'string' ||
    typeof value.duration !== 'number' ||
    (value.notes !== undefined && typeof value.notes !== 'string') ||
    (value.material !== undefined && typeof value.material !== 'string')
  ) {
    return false;
  }

  return value.children === undefined ||
    (Array.isArray(value.children) && value.children.every(isWorkshopItem));
};

const isWorkshopDay = (value: unknown): boolean => {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (value.title === undefined || typeof value.title === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.date === undefined || value.date === null || typeof value.date === 'string') &&
    (value.startTime === undefined || value.startTime === null || typeof value.startTime === 'string') &&
    (value.targetDuration === undefined || typeof value.targetDuration === 'number') &&
    (value.durationLocked === undefined || typeof value.durationLocked === 'boolean') &&
    (value.items === undefined || (Array.isArray(value.items) && value.items.every(isWorkshopItem)))
  );
};

const collectItemIds = (items: WorkshopItem[]): string[] =>
  items.flatMap((item) => [item.id, ...collectItemIds(item.children ?? [])]);

/** Mirrors the backend rules for `days`, so an import cannot lose or mix up items. */
const hasValidDays = (data: Record<string, unknown>): boolean => {
  if (data.days === undefined) return true;
  if (!Array.isArray(data.days) || data.days.length > MAX_DAYS || !data.days.every(isWorkshopDay)) return false;

  const days = data.days as WorkshopDay[];
  // The first day's items live in `items`; any here would be dropped silently.
  if (days[0]?.items !== undefined) return false;
  if (new Set(days.map((day) => day.id)).size !== days.length) return false;

  const itemIds = [data.items as WorkshopItem[], ...days.map((day) => day.items ?? [])].flatMap(collectItemIds);
  return new Set(itemIds).size === itemIds.length;
};

const isWorkshopData = (value: unknown): value is WorkshopData => {
  if (!isRecord(value) || !isRecord(value.workshop)) return false;

  const metadata = value.workshop;
  return (
    typeof value.version === 'string' &&
    typeof metadata.title === 'string' &&
    typeof metadata.description === 'string' &&
    (metadata.date === null || typeof metadata.date === 'string') &&
    (metadata.startTime === null || typeof metadata.startTime === 'string') &&
    Array.isArray(value.blockTypes) &&
    Array.isArray(value.persons) &&
    Array.isArray(value.items) &&
    value.items.every(isWorkshopItem) &&
    hasValidDays(value)
  );
};
