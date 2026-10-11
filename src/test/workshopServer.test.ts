import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  getKeyFromSearch,
  setKeyToUrl,
  clearKeyFromUrl,
  createServerSession,
  fetchServerSession,
  fetchServerSessionStatus,
  updateServerSession,
  deleteServerSession,
} from '@/lib/workshopServer';
import { makeWorkshop, setSearch, mockFetchResponse } from './test-helpers';
import { encryptWorkshop } from '@/lib/dynamicLinkCrypto';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

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
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return { ok: true, status: 200, json: async () => ({ key: body.id, version: 1 }) };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await createServerSession(makeWorkshop());
    expect(result.key).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(result.version).toBe(1);
    const sentBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sentBody).not.toHaveProperty('writeCapability');
    expect(fetchMock).toHaveBeenCalledWith(
      '/data/sessions.php',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('defaults version to 1 when not present in the response', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return { ok: true, status: 200, json: async () => ({ key: body.id }) };
    }) as unknown as typeof fetch;
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

  it('returns null on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSession('abcdef012345');
    expect(result).toBeNull();
  });

  it('returns null on a 5xx response (server unavailable)', async () => {
    mockFetchResponse({ body: { error: 'server down' }, status: 500 });
    const result = await fetchServerSession('abcdef012345');
    expect(result).toBeNull();
  });
});

describe('fetchServerSessionStatus', () => {
  it('returns available for 200', async () => {
    const data = { ...makeWorkshop(), _v: 3 };
    mockFetchResponse({ body: { data }, status: 200 });
    await expect(fetchServerSessionStatus('abcdef012345')).resolves.toEqual({
      status: 'available',
      data,
      version: 3,
    });
  });

  it('returns not-found for 404', async () => {
    mockFetchResponse({ body: { error: 'not found' }, status: 404 });
    await expect(fetchServerSessionStatus('abcdef012345')).resolves.toEqual({ status: 'not-found' });
  });

  it('reports missingKey when an encrypted-link ID is opened without a key fragment', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchServerSessionStatus('A'.repeat(22))).resolves.toEqual({
      status: 'unavailable', reason: 'missingKey',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports invalidKey when the key fragment does not match the encrypted session', async () => {
    const envelope = await encryptWorkshop(makeWorkshop(), 'B'.repeat(22), 'B'.repeat(43));
    mockFetchResponse({ body: { data: envelope }, status: 200 });
    await expect(fetchServerSessionStatus('B'.repeat(22), { encryptionKey: 'A'.repeat(43), writeCapability: null })).resolves.toEqual({
      status: 'unavailable', reason: 'invalidKey',
    });
  });

  it('rejects a plaintext response for a new encrypted-link ID', async () => {
    mockFetchResponse({ body: { data: makeWorkshop() }, status: 200 });
    await expect(fetchServerSessionStatus('A'.repeat(22), { encryptionKey: 'valid-key', writeCapability: null })).resolves.toEqual({
      status: 'unavailable', reason: 'server',
    });
  });

  it('classifies a TypeError "Failed to fetch" as network', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'network' });
  });

  it('classifies a TypeError "Load failed" as network', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Load failed'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'network' });
  });

  it('classifies a 500 response as server (status included in the app error label)', async () => {
    const debugSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchResponse({ body: { error: 'server down' }, status: 500 });
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'server' });
    debugSpy.mockRestore();
  });

  it('classifies a 503 response as server', async () => {
    mockFetchResponse({ body: { error: 'unavailable' }, status: 503 });
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'server' });
  });

  it('classifies a 429 response as server (rate-limited)', async () => {
    mockFetchResponse({ body: { error: 'slow down' }, status: 429 });
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'server' });
  });

  it('classifies an aborted request (AbortError) as timeout', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'timeout' });
  });

  it('classifies AbortSignal.timeout rejections (TimeoutError) as timeout', async () => {
    const timeoutError = new DOMException('signal timed out', 'TimeoutError');
    const fetchMock = vi.fn().mockRejectedValue(timeoutError);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'timeout' });
  });

  it('classifies navigator.onLine=false as offline (overrides fetch failure)', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'offline' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('falls back to network for non-fetch-type errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('something else'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchServerSessionStatus('abcdef012345');
    expect(result).toEqual({ status: 'unavailable', reason: 'network' });
  });

  it('emits the fetch timeout signal on the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: makeWorkshop() }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await fetchServerSessionStatus('abcdef012345');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.anything() }),
    );
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
    expect(result).toEqual({ ok: false, conflict: false, reason: 'server' });
  });

  it('returns ok=false on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const result = await updateServerSession('abcdef012345', makeWorkshop());
    expect(result).toEqual({ ok: false, conflict: false, reason: 'server' });
  });
});

describe('deleteServerSession', () => {
  it('issues a DELETE request', async () => {
    const fetchMock = mockFetchResponse({ status: 200 });
    await expect(deleteServerSession('abcdef012345')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('id=abcdef012345'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('does not throw on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(deleteServerSession('abcdef012345')).resolves.toBe(false);
  });

  it('uses the capability supplied by the session history entry', async () => {
    const fetchMock = mockFetchResponse({ status: 200 });
    await expect(deleteServerSession('A'.repeat(22), {
      encryptionKey: 'unused', writeCapability: 'history-capability',
    })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer history-capability' }) }),
    );
  });

  it('does not remove an encrypted session without a write capability', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(deleteServerSession('A'.repeat(22), { encryptionKey: 'key', writeCapability: null })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
