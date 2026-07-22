/**
 * prerender — Puppeteer pre-rendering detection and readiness signaling.
 *
 * Role: Detects whether the app is running inside the Puppeteer pre-render
 *       pipeline (via window.__PRERENDER__). Exposes signalPrerenderReady() which
 *       sets window.__PRERENDER_READY__ to tell Puppeteer to capture the DOM.
 *       Called by App.tsx after each route transition completes.
 */
type PrerenderWindow = Window & {
  __PRERENDER__?: boolean;
  __PRERENDER_READY__?: boolean;
  __PRERENDER_INJECTED?: { prerender?: boolean };
};

const getPrerenderWindow = (): PrerenderWindow | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window as PrerenderWindow;
};

export const isPrerendering = (): boolean => {
  const currentWindow = getPrerenderWindow();

  if (!currentWindow) {
    return false;
  }

  return Boolean(currentWindow.__PRERENDER__ || currentWindow.__PRERENDER_INJECTED?.prerender);
};

export const resetPrerenderReady = (): void => {
  const currentWindow = getPrerenderWindow();

  if (!currentWindow || !isPrerendering()) {
    return;
  }

  currentWindow.__PRERENDER_READY__ = false;
};

export const signalPrerenderReady = (): void => {
  const currentWindow = getPrerenderWindow();

  if (!currentWindow || !isPrerendering()) {
    return;
  }

  currentWindow.__PRERENDER_READY__ = true;
  document.dispatchEvent(new Event("prerender-ready"));
};
