/** @file workshopUrl — URL encoding/decoding for workshop data (LZ-string compressed hash). */
import { WorkshopData } from '@/types/workshop';
import { hasAnyItems } from '@/lib/workshop-days';
import { withoutNegativeDurations } from '@/lib/workshopUtils';
import LZString from 'lz-string';

/** LZ-string compression for URL encoding (v2 format). */
export const encodeWorkshopToUrl = (data: WorkshopData): string => {
  try {
    const json = JSON.stringify(data);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return 'v2:' + compressed;
  } catch (error) {
    console.error('Failed to encode workshop:', error);
    return '';
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasReadableItems = (items: unknown): boolean =>
  items == null ||
  (Array.isArray(items) && items.every((item) => isObject(item) && hasReadableItems(item.children)));

const hasReadableDays = (days: unknown): boolean => {
  if (days == null) return true;
  if (!Array.isArray(days)) return false;
  const ids = days.map((day) => (isObject(day) ? day.id : null));
  return (
    days.every((day) => isObject(day) && typeof day.id === 'string' && day.id !== '' && hasReadableItems(day.items)) &&
    new Set(ids).size === ids.length
  );
};

/**
 * Links are opened without the strict checks of a file import, so that a plan
 * saved in an odd but usable state stays reachable. Only a shape the planner
 * cannot render at all is refused, like any other undecodable link.
 */
const parseWorkshop = (json: string): WorkshopData => {
  const data: unknown = JSON.parse(json);
  if (!isObject(data) || !hasReadableItems(data.items) || !hasReadableDays(data.days)) {
    throw new Error('Unreadable plan structure');
  }
  return withoutNegativeDurations(data as unknown as WorkshopData);
};

export const decodeWorkshopFromUrl = (encoded: string): WorkshopData | null => {
  try {
    if (encoded.startsWith('v2:')) {
      const compressed = encoded.substring(3);
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) {
        throw new Error('Decompression failed');
      }
      return parseWorkshop(json);
    }

    // Legacy format (base64 + URI encoding) - for backwards compatibility
    console.warn('Loading workshop from legacy URL format. Consider resharing with new format.');
    const json = decodeURIComponent(atob(encoded));
    return parseWorkshop(json);
  } catch (error) {
    console.error('Failed to decode workshop:', error);
    return null;
  }
};

export const getWorkshopFromHash = (): WorkshopData | null => {
  const hash = window.location.hash;
  if (hash.startsWith('#data=')) {
    const encoded = hash.substring(6);
    return decodeWorkshopFromUrl(encoded);
  }
  return null;
};

/** Query parameter selecting the day a multi-day plan opens with (`?day=2`). */
const DAY_URL_PARAM = 'day';

export const getDayParamFromUrl = (): string | null =>
  new URLSearchParams(window.location.search).get(DAY_URL_PARAM);

/**
 * Mirrors the active day into `?day=` without touching the hash, so copying
 * the address bar or reloading keeps the selected day.
 */
export const setDayParamInUrl = (value: string | null): void => {
  const url = new URL(window.location.href);
  if ((url.searchParams.get(DAY_URL_PARAM) ?? null) === value) return;
  if (value) url.searchParams.set(DAY_URL_PARAM, value);
  else url.searchParams.delete(DAY_URL_PARAM);
  window.history.replaceState(window.history.state, '', url.toString());
};

/** Appends `?day=` to a share URL while keeping its hash intact. */
export const withDayParam = (href: string, value: string | null): string => {
  const url = new URL(href);
  if (value) url.searchParams.set(DAY_URL_PARAM, value);
  else url.searchParams.delete(DAY_URL_PARAM);
  return url.toString();
};

/**
 * Dispatched on `window` whenever the session in the URL changes outside the
 * router. Lets UI outside the planner tree (e.g. LanguageHint) react to session
 * content appearing/disappearing without a prop drill.
 */
export const SESSION_URL_CHANGED_EVENT = 'sessionplan:session-url-changed';

export const notifySessionUrlChanged = (): void => {
  window.dispatchEvent(new Event(SESSION_URL_CHANGED_EVENT));
};

// Fields of a browser history entry. They sit next to React Router's own state,
// which every write below has to keep.
const SESSION_ID_FIELD = 'spSessionId';
const OPENED_FROM_LIST_FIELD = 'spOpenedFromList';

/** History state for an entry pushed by opening a session from the session list. */
export const createOpenedFromListState = (sessionId?: string) => ({
  [OPENED_FROM_LIST_FIELD]: true,
  ...(sessionId ? { [SESSION_ID_FIELD]: sessionId } : {}),
});

/** The session-history entry this browser history entry belongs to. */
export const getHistorySessionId = (): string | null => {
  const id = window.history.state?.[SESSION_ID_FIELD];
  return typeof id === 'string' ? id : null;
};

export const setHistorySessionId = (sessionId: string | null): void => {
  const { [SESSION_ID_FIELD]: _previous, ...state } = window.history.state ?? {};
  window.history.replaceState(sessionId ? { ...state, [SESSION_ID_FIELD]: sessionId } : state, '');
};

/**
 * True when the entry before this one is the empty state the session was opened
 * from. React Router keeps state passed to `navigate` under `usr`.
 */
export const wasOpenedFromList = (): boolean => {
  const state = window.history.state;
  return !!(state?.[OPENED_FROM_LIST_FIELD] || state?.usr?.[OPENED_FROM_LIST_FIELD]);
};

/** Turn the current history entry into the page without any session. */
export const clearSessionFromUrl = (): void => {
  const {
    [SESSION_ID_FIELD]: _sessionId,
    [OPENED_FROM_LIST_FIELD]: _openedFromList,
    usr: _usr,
    ...state
  } = window.history.state ?? {};
  window.history.replaceState(state, '', window.location.pathname);
  notifySessionUrlChanged();
};

export const setWorkshopToHash = (data: WorkshopData): void => {
  if (!hasAnyItems(data)) {
    const hadSession = window.location.hash.startsWith('#data=');
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (hadSession) notifySessionUrlChanged();
    return;
  }

  const encoded = encodeWorkshopToUrl(data);
  if (encoded) {
    window.history.replaceState(window.history.state, '', `#data=${encoded}`);
    notifySessionUrlChanged();
  }
};

export const copyShareLink = async (data: WorkshopData): Promise<boolean> => {
  const encoded = encodeWorkshopToUrl(data);
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;

  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy link:', error);
    return false;
  }
};

/** The same share URL without the write capability, so that it only allows viewing. */
export const toReadOnlyShareUrl = (url: string): string => {
  const readOnlyUrl = new URL(url);
  const hash = new URLSearchParams(readOnlyUrl.hash.slice(1));
  hash.delete('w');
  readOnlyUrl.hash = hash.toString();
  return readOnlyUrl.toString();
};
