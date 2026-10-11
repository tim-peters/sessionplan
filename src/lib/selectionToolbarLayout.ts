/**
 * selectionToolbarLayout — pure geometry for positioning a floating
 * formatting toolbar relative to a textarea selection.
 *
 * The component measures textarea / toolbar pixel dimensions in its React
 * effect; this module only does the arithmetic (clamp + flip) so the rules
 * can be unit-tested without a DOM.
 *
 * Positioning context: the toolbar is portaled to document.body and placed
 * with position:fixed, so the "container" bounds passed in are the
 * VIEWPORT (window.innerWidth/innerHeight) and the anchor coordinates are
 * viewport-relative. Floating above every ancestor makes clipping by
 * overflow:hidden contexts (cards, dialogs, title wrappers) impossible.
 *
 * Horizontal contract: the toolbar uses CSS `-translate-x-1/2`, so `left`
 * is treated as the desired CENTER. The math clamps the center to
 * `[toolbarWidth/2, containerWidth - toolbarWidth/2]`. If the toolbar is
 * wider than the container (or the container has no width), the toolbar is
 * centered on the container's midline; the CSS translate then makes it
 * overflow symmetrically rather than clipping.
 *
 * Vertical contract: by default the toolbar is placed ABOVE the anchor
 * line (`top = anchorTop - toolbarHeight - gap`). When `below=true`
 * (coarse / touch pointer) the toolbar is placed BELOW the line
 * (`top = anchorTop + lineHeight + gap`).
 *
 * Flip rules:
 *   - Above → below: if the default ABOVE placement would render above the
 *     container's top edge (`top < 0`) — e.g. a single-line field at the
 *     top of the viewport — we flip BELOW the anchor line. The toolbar may
 *     then cover content directly beneath the anchor line, but it stays
 *     fully visible.
 *   - Below → above: if the BELOW placement overflows the container's
 *     bottom edge (`top + toolbarHeight > containerHeight`), we flip
 *     ABOVE the anchor line. If the flipped ABOVE position would still
 *     be negative (very short container), we clamp `top` to 0.
 */

export interface ToolbarPlacementInput {
  /** Top of the anchor line in positioning-context pixels
   *  (viewport-relative when the toolbar is portaled to document.body). */
  anchorTop: number;
  /** Horizontal anchor point in positioning-context pixels
   *  (left edge of the selection's first/last line). */
  anchorLeft: number;
  /** Textarea line height in pixels (used for the BELOW gap). */
  lineHeight: number;
  /** Measured width of the toolbar element in px. */
  toolbarWidth: number;
  /** Measured height of the toolbar element in px. */
  toolbarHeight: number;
  /** Width of the positioning context in px (viewport when portaled). */
  containerWidth: number;
  /** Height of the positioning context in px (viewport when portaled). */
  containerHeight: number;
  /** Gap between the toolbar and the anchor line in px. */
  gap: number;
  /** Whether the toolbar should anchor BELOW the line by default
   *  (true on coarse / touch pointers so the toolbar doesn't cover the
   *  native iOS/Android selection callout). */
  below: boolean;
}

export interface ToolbarPlacement {
  /** Final X coordinate of the toolbar (treated as CENTER due to `-translate-x-1/2`). */
  left: number;
  /** Final Y coordinate of the toolbar's TOP edge in positioning-context pixels. */
  top: number;
  /** Whether the toolbar ended up BELOW the anchor line after any flip. */
  below: boolean;
}

/** Pure geometry. No DOM, no side effects. */
export const computeToolbarPlacement = ({
  anchorTop,
  anchorLeft,
  lineHeight,
  toolbarWidth,
  toolbarHeight,
  containerWidth,
  containerHeight,
  gap,
  below: initialBelow,
}: ToolbarPlacementInput): ToolbarPlacement => {
  let below = initialBelow;

  let top = below
    ? anchorTop + lineHeight + gap
    : anchorTop - toolbarHeight - gap;

  if (!below && top < 0) {
    // No headroom above → flip below.
    below = true;
    top = anchorTop + lineHeight + gap;
  } else if (below && top + toolbarHeight > containerHeight) {
    // No headroom below → flip above.
    below = false;
    top = anchorTop - toolbarHeight - gap;
    if (top < 0) top = 0;
  }

  let left: number;
  if (containerWidth <= 0 || toolbarWidth >= containerWidth) {
    // Wider than container (or no container): best-effort center.
    left = containerWidth / 2;
  } else {
    const minCenter = toolbarWidth / 2;
    const maxCenter = containerWidth - toolbarWidth / 2;
    left = Math.max(minCenter, Math.min(maxCenter, anchorLeft));
  }

  return { left, top, below };
};
