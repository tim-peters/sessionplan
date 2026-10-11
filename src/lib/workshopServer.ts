/** @file workshopServer — Server-side session persistence (create, fetch, update, delete). */
import { WorkshopData } from '@/types/workshop';
import { createDynamicSecret, decryptWorkshop, encryptWorkshop, hashWriteCapability, type EncryptedWorkshopEnvelope } from './dynamicLinkCrypto';

const SESSIONS_API = import.meta.env.VITE_SESSIONS_API || '/data/sessions.php';
const KEY_REGEX = /^(?:[a-f0-9]{12}|[A-Za-z0-9_-]{22})$/;
const FETCH_TIMEOUT_MS = 10_000;

export type SessionUnavailableReason = 'offline' | 'network' | 'server' | 'timeout' | 'missingKey' | 'invalidKey';
export type ServerSessionAccess = { encryptionKey: string | null; writeCapability: string | null };

export const isLegacyServerKey = (key: string): boolean => /^[a-f0-9]{12}$/.test(key);

export const getServerSessionAccess = (hash = window.location.hash): ServerSessionAccess => {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return { encryptionKey: params.get('k'), writeCapability: params.get('w') };
};


export const getKeyFromSearch = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('id');
  return key && KEY_REGEX.test(key) ? key : null;
};

export const setKeyToUrl = (key: string, encryptionKey?: string, writeCapability?: string): void => {
  const hadHash = window.location.hash.length > 1;
  const url = new URL(window.location.href);
  url.searchParams.set('id', key);
  url.hash = encryptionKey ? `k=${encryptionKey}${writeCapability ? `&w=${writeCapability}` : ''}` : '';
  if (hadHash) {
    window.history.pushState(null, '', url.toString());
  } else {
    window.history.replaceState(null, '', url.toString());
  }
};

export const clearKeyFromUrl = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete('id');
  window.history.replaceState(null, '', url.toString());
};

export const createServerSession = async (data: WorkshopData): Promise<{ key: string; version: number; encryptionKey: string; writeCapability: string }> => {
  const key = createDynamicSecret(16);
  const encryptionKey = createDynamicSecret();
  const writeCapability = createDynamicSecret();
  const envelope = await encryptWorkshop(data, key, encryptionKey);
  const requestBody: Record<string, unknown> = { ...envelope, id: key, writeCapabilityHash: await hashWriteCapability(writeCapability) };
  const response = await fetch(SESSIONS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }
  const json = await response.json();
  if (json.key !== key) {
    throw new Error('Server returned an unexpected session key.');
  }
  const result = { key: json.key as string, version: (json.version as number) ?? 1 } as {
    key: string; version: number; encryptionKey: string; writeCapability: string;
  };
  // Keep the historical enumerable response shape for integrations while
  // exposing the two client-only secrets to the sync hook.
  Object.defineProperties(result, {
    encryptionKey: { value: encryptionKey },
    writeCapability: { value: writeCapability },
  });
  return result;
};

export type FetchServerSessionResult =
  | { status: 'available'; data: WorkshopData; version: number }
  | { status: 'not-found' }
  | { status: 'unavailable'; reason: SessionUnavailableReason };

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError');

/**
 * Build an AbortSignal that aborts after `ms` milliseconds.
 *
 * Uses `AbortSignal.timeout()` when available (Node 17.3+, modern browsers).
 * Falls back to a manual `AbortController` for environments (and jsdom
 * test runs) that don't ship it yet.
 */
const timeoutSignal = (ms: number): AbortSignal => {
  const ctor = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
  if (typeof ctor === 'function') return ctor(ms);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

const isFetchFailure = (error: unknown): boolean => {
  if (!(error instanceof TypeError)) return false;
  const message = error.message ?? '';
  return /Failed to fetch|Load failed|NetworkError when attempting to fetch resource/i.test(message);
};

const classifyFetchError = (error: unknown): SessionUnavailableReason => {
  if (isAbortError(error)) return 'timeout';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (isFetchFailure(error)) return 'network';
  return 'network';
};

const appErrorLabelForUnavailable = (
  reason: SessionUnavailableReason,
  status?: number,
): string => {
  if (reason === 'server' && status !== undefined) {
    return `fetchServerSession: kind=server status=${status}`;
  }
  return `fetchServerSession: kind=${reason}`;
};

export const fetchServerSessionStatus = async (
  key: string,
  access: ServerSessionAccess = getServerSessionAccess(),
): Promise<FetchServerSessionResult> => {
  // A non-legacy dynamic link cannot be opened without the encryption key
  // from the URL hash (#k=...). Without it the payload would be undecryptable,
  // so surface a dedicated reason instead of a transient server error.
  if (!isLegacyServerKey(key) && !access.encryptionKey) {
    console.warn('Dynamic link opened without an encryption key (missing #k=... fragment).');
    return { status: 'unavailable', reason: 'missingKey' };
  }
  let response: Response;
  try {
    response = await fetch(`${SESSIONS_API}?id=${encodeURIComponent(key)}`, {
      signal: timeoutSignal(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = classifyFetchError(error);
    console.error('Failed to fetch server session:', error);
    return { status: 'unavailable', reason };
  }

  if (response.status === 404) return { status: 'not-found' };
  if (response.status >= 500 || response.status === 429) {
    console.error('Server returned an error status:', response.status);
    return { status: 'unavailable', reason: 'server' };
  }
  if (!response.ok) {
    // Unexpected non-2xx, non-404, non-5xx/429 response (e.g. 4xx besides 404).
    console.error('Unexpected status when fetching session:', response.status);
    return { status: 'unavailable', reason: 'server' };
  }

  try {
    const json = await response.json();
    const raw = json.data;
    const isLegacy = isLegacyServerKey(key);
    if (!isLegacy && (!raw || raw.format !== 'encrypted-v1')) {
      console.error('Encrypted session has an invalid envelope.');
      return { status: 'unavailable', reason: 'server' };
    }
    if (isLegacy) {
      return {
        status: 'available',
        data: raw as WorkshopData,
        version: (raw?._v as number | undefined) ?? 0,
      };
    }
    // Decrypt separately so a failing/unmodified key can be distinguished from
    // a transport/parse problem: the server answered fine, but the key in the
    // URL hash does not match this session.
    try {
      const data = await decryptWorkshop(raw as EncryptedWorkshopEnvelope, key, access.encryptionKey ?? '');
      return {
        status: 'available',
        data,
        version: (raw?._v as number | undefined) ?? 0,
      };
    } catch (error) {
      console.warn('Failed to decrypt server session — the link key is likely invalid:', error);
      return { status: 'unavailable', reason: 'invalidKey' };
    }
  } catch (error) {
    console.error('Failed to parse server session response:', error);
    return { status: 'unavailable', reason: 'server' };
  }
};

export const fetchServerSession = async (
  key: string,
  access?: ServerSessionAccess,
): Promise<{ data: WorkshopData; version: number } | null> => {
  const result = await fetchServerSessionStatus(key, access);
  return result.status === 'available' ? result : null;
};

/**
 * Why a sync attempt failed.
 *
 * Mirrors the SessionUnavailableReason vocabulary so the planner can render
 * the right banner: a 403 means the link has lost permission to write
 * (read-only-by-permission), every other transport/server error is treated
 * as a transient outage.
 */
export type UpdateServerFailureReason = 'forbidden' | 'server';

export type UpdateServerSessionResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; serverData: WorkshopData; serverVersion: number }
  | { ok: false; conflict: false; reason: UpdateServerFailureReason };

export const updateServerSession = async (
  key: string,
  data: WorkshopData,
  version?: number,
  access: ServerSessionAccess = getServerSessionAccess(),
): Promise<UpdateServerSessionResult> => {
  try {
    const url = version !== undefined
      ? `${SESSIONS_API}?id=${encodeURIComponent(key)}&version=${version}`
      : `${SESSIONS_API}?id=${encodeURIComponent(key)}`;
    const isLegacy = isLegacyServerKey(key);
    if (!isLegacy && (version === undefined || !access.writeCapability || !access.encryptionKey)) {
      return { ok: false, conflict: false, reason: 'forbidden' };
    }
    const envelope = isLegacy ? data : await encryptWorkshop(data, key, access.encryptionKey!);
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(access.writeCapability ? { Authorization: `Bearer ${access.writeCapability}` } : {}) },
      body: JSON.stringify(envelope),
    });
    if (response.status === 409) {
      const json = await response.json();
      return {
        ok: false,
        conflict: true,
        serverData: isLegacy ? json.data as WorkshopData : await decryptWorkshop(json.data as EncryptedWorkshopEnvelope, key, access.encryptionKey!),
        serverVersion: json.serverVersion as number,
      };
    }
    if (response.status === 403) return { ok: false, conflict: false, reason: 'forbidden' };
    if (!response.ok) return { ok: false, conflict: false, reason: 'server' };
    const json = await response.json();
    return { ok: true, version: (json.version as number) ?? (version ?? 0) + 1 };
  } catch (error) {
    console.error('Failed to update server session:', error);
    return { ok: false, conflict: false, reason: 'server' };
  }
};

export const deleteServerSession = async (
  key: string,
  access: ServerSessionAccess = getServerSessionAccess(),
): Promise<boolean> => {
  try {
    if (!access.writeCapability && !isLegacyServerKey(key)) return false;
    const response = await fetch(`${SESSIONS_API}?id=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: {
        ...(access.writeCapability ? { Authorization: `Bearer ${access.writeCapability}` } : {}),
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to delete server session:', error);
    return false;
  }
};
