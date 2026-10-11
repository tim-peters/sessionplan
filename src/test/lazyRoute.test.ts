import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazyPage, recoverFromChunkLoadError, handleChunkLoadError } from '@/lib/lazyRoute';

const FLAG = 'sp:chunk-reload';

function chunkError() {
  return new TypeError('Failed to fetch dynamically imported module: /assets/Index-abc123.js');
}

describe('recoverFromChunkLoadError', () => {
  it('detects known chunk-load failure messages', () => {
    expect(recoverFromChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true);
    expect(recoverFromChunkLoadError(new Error('Importing a module script failed'))).toBe(true);
    expect(recoverFromChunkLoadError(new Error('ViteError: unable to load chunk'))).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(recoverFromChunkLoadError(new Error('some app error'))).toBe(false);
    expect(recoverFromChunkLoadError(null)).toBe(false);
    expect(recoverFromChunkLoadError(undefined)).toBe(false);
  });
});

describe('handleChunkLoadError', () => {
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    reloadMock = vi.fn();
    // jsdom's location.reload is not implemented — stub it.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reloads once on a chunk error and sets the guard flag', () => {
    expect(handleChunkLoadError(chunkError())).toBe(true);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(Number(sessionStorage.getItem(FLAG))).toBeGreaterThan(0);
  });

  it('rethrows instead of looping when a reload happened within the window', () => {
    sessionStorage.setItem(FLAG, String(Date.now()));
    expect(() => handleChunkLoadError(chunkError())).toThrow();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('reloads again after the guard window has passed', () => {
    sessionStorage.setItem(FLAG, String(Date.now() - 11_000));
    expect(handleChunkLoadError(chunkError())).toBe(true);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('ignores non-chunk errors without reloading', () => {
    const err = new Error('some app error');
    expect(handleChunkLoadError(err)).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });
});

describe('lazyPage', () => {
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the module on success and clears a stale guard flag', async () => {
    sessionStorage.setItem(FLAG, String(Date.now() - 60_000));
    const module = { default: () => null };
    const result = await lazyPage(() => Promise.resolve(module))();
    expect(result).toEqual({ Component: module.default });
    expect(sessionStorage.getItem(FLAG)).toBeNull();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('reloads (never resolves) on a chunk error', async () => {
    const loader = vi.fn(() => Promise.reject(chunkError()));
    const pending = lazyPage(loader)();
    // Never resolves — verify it doesn't settle and a reload was scheduled.
    await expect(Promise.race([pending, new Promise((r) => setTimeout(() => r('pending'), 50))])).resolves.toBe('pending');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows on the second chunk error within the window', async () => {
    sessionStorage.setItem(FLAG, String(Date.now()));
    const loader = vi.fn(() => Promise.reject(chunkError()));
    await expect(lazyPage(loader)()).rejects.toThrow(/Failed to fetch dynamically imported module/);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('rethrows non-chunk errors without reloading', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('app error')));
    await expect(lazyPage(loader)()).rejects.toThrow('app error');
    expect(reloadMock).not.toHaveBeenCalled();
  });
});
