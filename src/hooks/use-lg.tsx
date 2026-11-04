import { LG_BREAKPOINT } from '@/lib/constants';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * useIsLg — Reports whether the viewport is at least the `lg` breakpoint (≥ 1024 px).
 *
 * Role: Mirror of useIsMobile, for components that need to branch on desktop
 *       vs. mobile/tablet layout. Uses matchMedia so the value is stable across
 *       renders and only flips on real viewport changes — unlike reading
 *       `window.innerWidth` directly during render, which can change between
 *       two renders for transient reasons (font load, reflow, sidebar toggle)
 *       and cause React to mount/unmount the same node in the same position,
 *       producing `Failed to execute 'removeChild'` / `insertBefore` errors.
 */
export function useIsLg(): boolean {
  return useMediaQuery(`(min-width: ${LG_BREAKPOINT}px)`);
}
