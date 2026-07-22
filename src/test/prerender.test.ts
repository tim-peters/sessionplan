import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isPrerendering, resetPrerenderReady, signalPrerenderReady } from '@/lib/prerender';

type PrerenderWindow = Window & {
  __PRERENDER__?: boolean;
  __PRERENDER_READY__?: boolean;
  __PRERENDER_INJECTED?: { prerender?: boolean };
};

const w = (): PrerenderWindow => window as PrerenderWindow;

describe('prerender', () => {
  beforeEach(() => {
    delete w().__PRERENDER__;
    delete w().__PRERENDER_READY__;
    delete w().__PRERENDER_INJECTED;
  });
  afterEach(() => {
    delete w().__PRERENDER__;
    delete w().__PRERENDER_READY__;
    delete w().__PRERENDER_INJECTED;
  });

  describe('isPrerendering', () => {
    it('returns false when no flag is set', () => {
      expect(isPrerendering()).toBe(false);
    });
    it('returns true when window.__PRERENDER__ is true', () => {
      w().__PRERENDER__ = true;
      expect(isPrerendering()).toBe(true);
    });
    it('returns true when window.__PRERENDER_INJECTED.prerender is true', () => {
      w().__PRERENDER_INJECTED = { prerender: true };
      expect(isPrerendering()).toBe(true);
    });
  });

  describe('signalPrerenderReady', () => {
    it('is a no-op outside prerender', () => {
      signalPrerenderReady();
      expect(w().__PRERENDER_READY__).toBeUndefined();
    });
    it('sets the flag and dispatches the event during prerender', () => {
      w().__PRERENDER__ = true;
      const handler = vi.fn();
      document.addEventListener('prerender-ready', handler);
      signalPrerenderReady();
      expect(w().__PRERENDER_READY__).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      document.removeEventListener('prerender-ready', handler);
    });
  });

  describe('resetPrerenderReady', () => {
    it('is a no-op outside prerender', () => {
      w().__PRERENDER_READY__ = true;
      resetPrerenderReady();
      expect(w().__PRERENDER_READY__).toBe(true);
    });
    it('clears the flag during prerender', () => {
      w().__PRERENDER__ = true;
      w().__PRERENDER_READY__ = true;
      resetPrerenderReady();
      expect(w().__PRERENDER_READY__).toBe(false);
    });
  });
});
