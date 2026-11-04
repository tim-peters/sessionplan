/**
 * useElementHeight — Track the current rendered height (in px) of an element.
 *
 * Role: small utility used by overlays/strips that need to position themselves
 *       relative to a dynamic sibling (e.g. a sticky header that grows with
 *       banners, PlayModeBar, etc.). Size changes are tracked via
 *       ResizeObserver (fast path) plus a lightweight watchdog interval
 *       (fallback path).
 *
 * Returns 0 until a non-zero measurement is available (and in SSR/test
 * environments without ResizeObserver). Callers should provide a sensible
 * fallback if a non-zero value is needed at first paint.
 *
 * If the ref is not yet attached on mount (e.g. the element is behind an
 * async loading branch that renders later), the hook retries on subsequent
 * frames until the element appears — a plain early-return would otherwise
 * leave the height at 0 forever, since the effect never re-runs for a stable
 * ref object.
 */
import { useEffect, useState, type RefObject } from 'react';

/** Watchdog tick — frequent enough to feel instant, cheap enough to idle. */
const WATCHDOG_INTERVAL_MS = 250;

export function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let ro: ResizeObserver | null = null;
    // Element identity the observer is currently bound to. Guards the RO
    // callback (and the watchdog) against stale closures after a remount.
    let observedEl: HTMLElement | null = null;

    const read = (el: HTMLElement) => Math.round(el.getBoundingClientRect().height);

    const attach = (el: HTMLElement) => {
      observedEl = el;
      setHeight(read(el));
      ro?.disconnect();
      if (typeof ResizeObserver === 'undefined') return;
      ro = new ResizeObserver(() => {
        if (observedEl !== el || ref.current !== el) return;
        setHeight(read(el));
      });
      ro.observe(el);
    };

    // Seed immediately when already attached so we don't show 0 for one paint.
    const el = ref.current;
    if (el) attach(el);

    const watchdog = window.setInterval(() => {
      const next = ref.current;
      if (!next) return;
      if (next !== observedEl) {
        attach(next);
        return;
      }
      const h = read(next);
      setHeight((prev) => (h === prev ? prev : h));
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      window.clearInterval(watchdog);
      ro?.disconnect();
    };
  }, [ref]);

  return height;
}
