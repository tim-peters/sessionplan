/**
 * useElementHeight — Track the current rendered height (in px) of an element.
 *
 * Role: small utility used by overlays/strips that need to position themselves
 *       relative to a dynamic sibling (e.g. a sticky header that grows with
 *       banners, PlayModeBar, etc.). Uses ResizeObserver so the value updates
 *       immediately when content changes.
 *
 * Returns 0 until the element is attached (and in SSR/test environments without
 * ResizeObserver). Callers should provide a sensible fallback if a non-zero
 * value is needed at first paint.
 *
 * If the ref is not yet attached on mount (e.g. the element is behind an
 * async loading branch that renders later), the hook retries on subsequent
 * frames until the element appears — a plain early-return would otherwise
 * leave the height at 0 forever, since the effect never re-runs for a stable
 * ref object.
 */
import { useEffect, useState, type RefObject } from 'react';

export function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let ro: ResizeObserver | null = null;
    let rafId: number | null = null;

    const read = (el: HTMLElement) => Math.round(el.getBoundingClientRect().height);

    const attach = (el: HTMLElement) => {
      // Seed once attached so we don't show 0 for one paint.
      setHeight(read(el));
      if (typeof ResizeObserver === 'undefined') return;
      ro = new ResizeObserver(() => {
        setHeight(read(el));
      });
      ro.observe(el);
    };

    const el = ref.current;
    if (el) {
      attach(el);
      return () => ro?.disconnect();
    }

    // Element not mounted yet — poll on animation frames until it appears.
    const poll = () => {
      const next = ref.current;
      if (next) {
        attach(next);
        return;
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [ref]);

  return height;
}