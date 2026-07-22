/** @file workshopServer — Server-side session persistence (create, fetch, update, delete). */
import { WorkshopData } from '@/types/workshop';

const SESSIONS_API = import.meta.env.VITE_SESSIONS_API || '/data/sessions.php';
const KEY_REGEX = /^[a-f0-9]{12}$/;

export const getKeyFromSearch = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('id');
  return key && KEY_REGEX.test(key) ? key : null;
};

export const setKeyToUrl = (key: string): void => {
  const hadHash = window.location.hash.length > 1;
  const url = new URL(window.location.href);
  url.searchParams.set('id', key);
  url.hash = '';
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

export const createServerSession = async (data: WorkshopData): Promise<{ key: string; version: number }> => {
  const response = await fetch(SESSIONS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }
  const json = await response.json();
  return { key: json.key as string, version: (json.version as number) ?? 1 };
};

export const fetchServerSession = async (key: string): Promise<{ data: WorkshopData; version: number } | null> => {
  try {
    const response = await fetch(`${SESSIONS_API}?id=${encodeURIComponent(key)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to fetch session: ${response.status}`);
    const json = await response.json();
    const data = json.data as WorkshopData;
    return { data, version: (data as WorkshopData & { _v?: number })._v ?? 0 };
  } catch (error) {
    console.error('Failed to fetch server session:', error);
    return null;
  }
};

export type UpdateServerSessionResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; serverData: WorkshopData; serverVersion: number }
  | { ok: false; conflict: false };

export const updateServerSession = async (
  key: string,
  data: WorkshopData,
  version?: number
): Promise<UpdateServerSessionResult> => {
  try {
    const url = version !== undefined
      ? `${SESSIONS_API}?id=${encodeURIComponent(key)}&version=${version}`
      : `${SESSIONS_API}?id=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (response.status === 409) {
      const json = await response.json();
      return {
        ok: false,
        conflict: true,
        serverData: json.data as WorkshopData,
        serverVersion: json.serverVersion as number,
      };
    }
    if (!response.ok) return { ok: false, conflict: false };
    const json = await response.json();
    return { ok: true, version: (json.version as number) ?? (version ?? 0) + 1 };
  } catch (error) {
    console.error('Failed to update server session:', error);
    return { ok: false, conflict: false };
  }
};

export const deleteServerSession = async (key: string): Promise<void> => {
  try {
    await fetch(`${SESSIONS_API}?id=${encodeURIComponent(key)}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Failed to delete server session:', error);
  }
};
