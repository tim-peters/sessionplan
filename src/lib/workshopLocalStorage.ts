/**
 * @file workshopLocalStorage — localStorage/sessionStorage persistence.
 *
 * Storage keys use the `sp:` namespace prefix to avoid collisions.
 * Call `migrateStorageKeys()` once on app startup to migrate pre-v2 keys.
 */
import { WorkshopData, WorkshopItem, generateId } from '@/types/workshop';
import { SessionHistoryEntry } from '@/types/sessionHistory';

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
  /** Temporary current workshop incl. session id. */
  temp: 'sp:temp',
  /** sessionStorage flag to restore temp workshop on route entry. */
  restorePending: 'sp:restore-pending',
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

    // Migrate temp workshop to the new wrapper format.
    const oldTemp = localStorage.getItem('temp-current-workshop');
    if (oldTemp) {
      try {
        const data = JSON.parse(oldTemp) as WorkshopData;
        const wrapper: TempWorkshopStore = { data, sessionId: generateId() };
        localStorage.setItem(KEYS.temp, JSON.stringify(wrapper));
      } catch {
        // Corrupt data — discard.
      }
      localStorage.removeItem('temp-current-workshop');
    }

    // Migrate UI prefs.
    const sidebarOld = localStorage.getItem('sidebarCollapsed');
    const previewOld = localStorage.getItem('showFullPreviewText');
    if (sidebarOld !== null || previewOld !== null) {
      const prefs: UIPrefs = {
        sidebarCollapsed: sidebarOld === null ? true : sidebarOld === 'true',
        showFullPreviewText: previewOld === null ? true : previewOld === 'true',
      };
      localStorage.setItem(KEYS.prefs, JSON.stringify(prefs));
      localStorage.removeItem('sidebarCollapsed');
      localStorage.removeItem('showFullPreviewText');
    }

    // sessionStorage restore flag.
    const oldFlag = sessionStorage.getItem('workshop-temp-restore-pending');
    if (oldFlag) {
      sessionStorage.setItem(KEYS.restorePending, oldFlag);
      sessionStorage.removeItem('workshop-temp-restore-pending');
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

// ── Temp workshop ─────────────────────────────────────────────────────────────

/** Shape stored under `sp:temp`. */
export interface TempWorkshopStore {
  data: WorkshopData;
  /** ID of the SessionHistoryEntry this temp data belongs to. */
  sessionId: string;
}

export const saveTempWorkshopWithId = (data: WorkshopData, sessionId: string): void => {
  try {
    const wrapper: TempWorkshopStore = { data, sessionId };
    localStorage.setItem(KEYS.temp, JSON.stringify(wrapper));
  } catch (error) {
    console.error('Failed to save temp workshop:', error);
  }
};

export const getTempWorkshopStore = (): TempWorkshopStore | null => {
  try {
    const stored = localStorage.getItem(KEYS.temp);
    return stored ? (JSON.parse(stored) as TempWorkshopStore) : null;
  } catch (error) {
    console.error('Failed to load temp workshop:', error);
    return null;
  }
};

/** Convenience wrapper — returns just the WorkshopData (for backwards-compat). */
export const getTempWorkshop = (): WorkshopData | null => getTempWorkshopStore()?.data ?? null;

/** Save workshop data, re-using the existing sessionId if available. */
export const saveTempWorkshop = (data: WorkshopData, sessionId?: string): void => {
  const id = sessionId ?? getTempWorkshopStore()?.sessionId ?? generateId();
  saveTempWorkshopWithId(data, id);
};

export const clearTempWorkshop = (): void => {
  localStorage.removeItem(KEYS.temp);
};

export const clearTempWorkshopItems = (): void => {
  const store = getTempWorkshopStore();
  if (!store) return;
  saveTempWorkshopWithId({ ...store.data, items: [] }, store.sessionId);
};

export const markTempWorkshopForRouteRestore = (): void => {
  sessionStorage.setItem(KEYS.restorePending, '1');
};

export const shouldRestoreTempWorkshopOnEntry = (): boolean =>
  sessionStorage.getItem(KEYS.restorePending) === '1';

export const clearTempWorkshopRestoreMarker = (): void => {
  sessionStorage.removeItem(KEYS.restorePending);
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
  localStorage.removeItem(KEYS.temp);
  localStorage.removeItem(KEYS.sessions);
  localStorage.removeItem(KEYS.prefs);
  localStorage.removeItem(KEYS.theme);
  sessionStorage.removeItem(KEYS.restorePending);
  await initializeLibraryIfNeeded();
};

// ── UI Preferences ────────────────────────────────────────────────────────────

interface UIPrefs {
  sidebarCollapsed: boolean;
  showFullPreviewText: boolean;
}

const DEFAULT_PREFS: UIPrefs = { sidebarCollapsed: true, showFullPreviewText: true };

export const getDefaultPrefs = (): UIPrefs => DEFAULT_PREFS;

const getPrefs = (): UIPrefs => {
  try {
    const stored = localStorage.getItem(KEYS.prefs);
    if (stored) return JSON.parse(stored) as UIPrefs;
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
        const data = JSON.parse(e.target?.result as string) as WorkshopData;
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
