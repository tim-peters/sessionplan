import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getKeyFromSearch,
  setKeyToUrl,
  clearKeyFromUrl,
  createServerSession,
  fetchServerSession,
  updateServerSession,
  deleteServerSession,
} from '@/lib/workshopServer';
import { makeWorkshop, setSearch, mockFetchResponse } from './test-helpers';

describe('getKeyFromSearch', () => {
  it('returns null when no id is in the search params', () => {
    window.history.replaceState(null, '', window.location.pathname);
    expect(getKeyFromSearch()).toBeNull();
  });

  it('returns the id when it matches the 12-hex regex', () => {
    setSearch('id=abcdef012345');
    expect(getKeyFromSearch()).toBe('abcdef012345');
  });

  it('returns null when the id is not 12 hex chars', () => {
    setSearch('id=short');
    expect(getKeyFromSearch()).toBeNull();
  });

  it('returns null when the id contains non-hex characters', () => {
    setSearch('id=zzzzzzzzzzzz');
    expect(getKeyFromSearch()).toBeNull();
  });
});

describe('setKeyToUrl / clearKeyFromUrl', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('setKeyToUrl sets the id query param', () => {
    setKeyToUrl('abcdef012345');
    expect(window.location.search).toBe('?id=abcdef012345');
  });

  it('setKeyToUrl clears any existing hash', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#data=v2:abc`);
    setKeyToUrl('abcdef012345');
    expect(window.location.hash).toBe('');
  });

  it('clearKeyFromUrl removes the id param', () => {
    setSearch('id=abcdef012345');
    clearKeyFromUrl();
    expect(window.location.search).toBe('');
  });
});

describe('createServerSession', () => {
  it('POSTs the data and returns the key + version', async () => {
    const fetchMock = mockFetchResponse({ body: { key: 'abcdef012345', version: 1 }, status: 200 });
    const result = await createServerSession(makeWorkshop());
    expect(result).toEqual({ key: 'abcdef012345', version: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/data/sessions.php',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('defaults version to 1 when not present in the response', async () => {
    mockFetchResponse({ body: { key: 'abcdef012345' }, status: 200 });
    const result = await createServerSession(makeWorkshop());
    expect(result.version).toBe(1);
  });

  it('throws on non-2xx response', async () => {
    mockFetchResponse({ body: { error: 'nope' }, status: 500 });
    await expect(createServerSession(makeWorkshop())).rejects.toThrow(/Failed to create session/);
  });
});

describe('fetchServerSession', () => {
  it('returns null for a 404 response', async () => {
    mockFetchResponse({ body: { error: 'not found' }, status: 404 });
    const result = await fetchServerSession('abcdef012345');
    expect(result).toBeNull();
  });

  it('returns the data and version for a 200 response', async () => {
    const data = { ...makeWorkshop(), _v: 7 };
    mockFetchResponse({ body: { data }, status: 200 });
    const result = await fetchServerSession('abcdef012345');
    expect(result?.data).toEqual(data);
    expect(result?.version).toBe(7);
  });

  it('defaults version to 0 when the response has no _v', async () => {
    mockFetchResponse({ body: { data: makeWorkshop() }, status: 200 });
    const result = await fetchServerSession('abcdef012345');
    expect(result?.version).toBe(0);
  });

  it('returns null (and does not throw) on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSession('abcdef012345');
    expect(result).toBeNull();
  });

  it('returns null on a non-404, non-2xx response (the source swallows these)', async () => {
    mockFetchResponse({ body: { error: 'server down' }, status: 500 });
    const result = await fetchServerSession('abcdef012345');
    expect(result).toBeNull();
  });
});

describe('updateServerSession', () => {
  it('returns ok=true with the new version on 200', async () => {
    mockFetchResponse({ body: { version: 4 }, status: 200 });
    const result = await updateServerSession('abcdef012345', makeWorkshop(), 3);
    expect(result).toEqual({ ok: true, version: 4 });
  });

  it('includes the version query param when provided', async () => {
    const fetchMock = mockFetchResponse({ body: { version: 2 }, status: 200 });
    await updateServerSession('abcdef012345', makeWorkshop(), 1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('version=1'),
      expect.anything(),
    );
  });

  it('returns ok=false with conflict payload on 409', async () => {
    mockFetchResponse({
      body: {
        data: makeWorkshop({ workshop: { ...makeWorkshop().workshop, title: 'Server' } }),
        serverVersion: 5,
      },
      status: 409,
    });
    const result = await updateServerSession('abcdef012345', makeWorkshop(), 4);
    expect(result.ok).toBe(false);
    if (!result.ok && 'serverData' in result) {
      expect(result.conflict).toBe(true);
      expect(result.serverVersion).toBe(5);
      expect(result.serverData.workshop.title).toBe('Server');
    } else {
      throw new Error('expected conflict result');
    }
  });

  it('returns ok=false (no conflict) on other non-2xx', async () => {
    mockFetchResponse({ body: { error: 'bad' }, status: 400 });
    const result = await updateServerSession('abcdef012345', makeWorkshop(), 1);
    expect(result).toEqual({ ok: false, conflict: false });
  });

  it('returns ok=false on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await updateServerSession('abcdef012345', makeWorkshop());
    expect(result).toEqual({ ok: false, conflict: false });
  });
});

describe('deleteServerSession', () => {
  it('issues a DELETE request', async () => {
    const fetchMock = mockFetchResponse({ status: 200 });
    await deleteServerSession('abcdef012345');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('id=abcdef012345'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does not throw on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(deleteServerSession('abcdef012345')).resolves.toBeUndefined();
  });
});
