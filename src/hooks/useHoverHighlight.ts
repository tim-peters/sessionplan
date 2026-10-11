/**
 * useHoverHighlight — React bindings for the hover-highlight pub/sub store.
 *
 * Role: Tiny glue between `src/lib/hoverHighlight.ts` and React components.
 *       Three exports:
 *         - `useHoveredItemId()` subscribes via `useSyncExternalStore` and
 *           returns just the id. The strip uses this — it only cares about
 *           "which id is hovered", not where the hover originated, so its
 *           snapshot is the id string and re-renders are skipped when only
 *           the source changes.
 *         - `useIsStripHighlighted(id)` returns `true` only when the store
 *           holds the given id AND its source is `'strip'`. Timeline cards
 *           use this to decide whether to apply the `time-card-highlight`
 *           outline — strip-originated hovers get it, timeline-originated
 *           hovers don't (the user's already getting the native CSS hover
 *           feedback on the card itself).
 *         - `useHoverHighlightHandlers(id)` returns stable
 *           `{ onPointerEnter, onPointerLeave }` props that publish
 *           `id` / `null` to the store with `source: 'timeline'`. Timeline
 *           cards use this. The strip publishes directly with
 *           `source: 'strip'` (see TimeVisualizationStrip.tsx).
 *
 *       On touch devices (no real hover), the returned handlers are no-ops —
 *       `pointerenter` on a touch device doesn't stick, but we skip even
 *       publishing so the cross-highlight feature is dormant on phones.
 *       Both hooks install a safety useEffect cleanup that clears the store
 *       if the component unmounts while still hovered.
 * Used by: src/modules/timeline/BlockCard.tsx,
 *         src/modules/timeline/BreakoutCard.tsx,
 *         src/modules/planner/TimeVisualizationStrip.tsx
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  getHoveredItem,
  getHoveredItemId,
  setHoveredItem,
  subscribe,
  type HoverSource,
} from '@/lib/hoverHighlight';
import { isTouchDevice } from '@/lib/domUtils';

export interface HoverHighlightHandlers {
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

const NOOP_HANDLERS: HoverHighlightHandlers = {
  onPointerEnter: () => {},
  onPointerLeave: () => {},
};

/** Default source for `useHoverHighlightHandlers` (timeline cards). The
 *  strip publishes with `'strip'` directly via the store API. */
const DEFAULT_SOURCE: HoverSource = 'timeline';

/** Subscribe to the hovered id and re-render only when the id changes. The
 *  source is intentionally not part of the snapshot: the strip doesn't care
 *  which side the hover came from, and `Object.is('A', 'A')` short-circuits
 *  source-only changes so we don't re-render the strip for them. */
export function useHoveredItemId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getHoveredItem()?.id ?? null,
    () => null,
  );
}

/** True when the store holds the given id AND its source is `'strip'`.
 *
 *  The snapshot returned to `useSyncExternalStore` is the derived boolean
 *  itself, not the underlying store object. This means a card whose id
 *  doesn't match stays at `false` across any number of unrelated store
 *  changes (e.g. hovering a different card, or a source-only change for an
 *  id that isn't ours) and skips the re-render entirely. Only the one card
 *  whose boolean flipped between renders actually re-renders. */
export function useIsStripHighlighted(id: string | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const it = getHoveredItem();
      return !!it && id !== null && it.id === id && it.source === 'strip';
    },
    () => false,
  );
}

/** Returns pointer handlers that publish / clear `id` on the store with
 *  `source: 'timeline'`. The returned object is memoized per `id`, so
 *  consumers can spread it onto a JSX element without re-attaching listeners
 *  every render.
 *
 *  Also installs a safety useEffect cleanup that clears the store if the
 *  component unmounts while still hovered (pointerleave normally covers
 *  this, but it can fail when an element is removed mid-hover). */
export function useHoverHighlightHandlers(
  id: string | null,
  source: HoverSource = DEFAULT_SOURCE,
): HoverHighlightHandlers {
  useEffect(() => {
    if (id === null) return;
    return () => {
      if (getHoveredItemId() === id) setHoveredItem(null, null);
    };
  }, [id]);

  return useMemo<HoverHighlightHandlers>(() => {
    if (id === null || isTouchDevice()) return NOOP_HANDLERS;
    return {
      onPointerEnter: () => setHoveredItem(id, source),
      onPointerLeave: () => {
        if (getHoveredItemId() === id) setHoveredItem(null, null);
      },
    };
  }, [id, source]);
}