/**
 * hoverHighlight — Module-level pub/sub singleton for cross-highlighting the
 * time-visualization strip and the timeline cards.
 *
 * Tracks both the hovered id AND the source it came from ('strip' or
 * 'timeline'). The source matters because the visual treatment differs:
 *  - Hover in the strip  → segment in the strip AND card in the timeline
 *                          both get the highlight outline.
 *  - Hover in the timeline → segment in the strip gets the highlight, but
 *                          the card itself only shows its normal CSS hover
 *                          (no extra outline) so we don't double up the
 *                          affordance the user is already seeing.
 *
 * Per AGENTS.md this is a purely ephemeral UI concern (NOT workshop state)
 * so it lives in this module-level store rather than useWorkshop() or a
 * React Context. Consumers subscribe via `subscribe(listener)` and read the
 * current value via `getHoveredItem()` (full state) or `getHoveredItemId()`
 * (id only — used by the strip's leave-flicker check); React-side
 * `useSyncExternalStore` integration lives in
 * `src/hooks/useHoverHighlight.ts`.
 *
 * Role: tiny observable singleton — no React, no DOM. Safe to call from any
 *       component (cards, segments) without re-render concerns at this layer.
 * Used by: src/hooks/useHoverHighlight.ts,
 *         src/modules/timeline/BlockCard.tsx,
 *         src/modules/timeline/BreakoutCard.tsx,
 *         src/modules/planner/TimeVisualizationStrip.tsx,
 *         src/test/hoverHighlight.test.ts
 */

export type HoverSource = 'strip' | 'timeline';

export interface HoveredItem {
  id: string;
  source: HoverSource;
}

let current: HoveredItem | null = null;
const listeners = new Set<(item: HoveredItem | null) => void>();

/** Set the currently hovered item and its source. Pass `null` for either to
 *  clear. No-op when both id AND source are unchanged — important so React
 *  subscribers don't re-render on pointerenter/leave churn. */
export function setHoveredItem(
  id: string | null,
  source: HoverSource | null,
): void {
  if (id === null) {
    if (current === null) return;
    current = null;
  } else {
    if (source === null) return; // invalid combination — ignore
    if (current && current.id === id && current.source === source) return;
    current = { id, source };
  }
  // Snapshot listeners before iterating so an unsubscription during dispatch
  // (e.g. a component unmounting in response to the hover change) doesn't
  // shift the iteration.
  for (const listener of [...listeners]) listener(current);
}

/** Read just the hovered id (or `null`). Stable reference when unchanged. */
export function getHoveredItemId(): string | null {
  return current?.id ?? null;
}

/** Read the full hovered state (id + source). Stable reference when
 *  unchanged — same object is returned on every call until setHoveredItem
 *  creates a new one, which lets `useSyncExternalStore` skip re-renders. */
export function getHoveredItem(): HoveredItem | null {
  return current;
}

/** Subscribe to hover changes. Returns an unsubscribe function. */
export function subscribe(listener: (item: HoveredItem | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}