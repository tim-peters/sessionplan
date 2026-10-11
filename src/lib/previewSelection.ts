/**
 * previewSelection — translate a DOM selection made in a formatted preview
 * into raw-value offsets suitable for opening an inline editor with the
 * SAME text selected.
 *
 * The preview renders FORMATTED text (markers `*`/`_`/`[...]`](url) are
 * stripped by `parseFormatting`), so `window.getSelection()` returns
 * offsets in the RENDERED string. The textarea, in contrast, holds the RAW
 * value with the syntax intact. We compute rendered offsets via Range
 * (using `range.toString().length`, which ignores non-text nodes like the
 * pencil SVG), then delegate to `mapRenderedRangeToRaw` for outward
 * snapping around any formatted runs.
 *
 * Returns `null` when there's nothing to carry: collapsed/absent
 * selection, selection outside the preview container, or any DOM exception
 * (defensive — a bad container must never break the click-to-edit path).
 *
 * The offset math itself lives in `mapRenderedRangeToRaw` (textFormatting.ts)
 * and is unit-tested there; this file only adds the DOM reading around it,
 * which jsdom cannot meaningfully simulate.
 */
import { mapRenderedRangeToRaw } from './textFormatting';

export interface CarriedSelection {
  start: number;
  end: number;
}

/**
 * Reads the current selection inside `container` and returns raw-value
 * offsets matching it. Returns `null` if the selection is absent,
 * collapsed, outside the container, or unreadable for any reason.
 */
export const getRawRangeFromPreviewSelection = (
  container: Element,
  value: string,
): CarriedSelection | null => {
  try {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return null;
    if (selection.isCollapsed) return null;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return null;
    if (!container.contains(anchorNode) || !container.contains(focusNode)) return null;

    const anchorOffset = selection.anchorOffset;
    const focusOffset = selection.focusOffset;

    const renderedFromNode = (node: Node, offset: number): number => {
      const range = document.createRange();
      range.setStart(container, 0);
      range.setEnd(node, offset);
      return range.toString().length;
    };

    const start = Math.min(
      renderedFromNode(anchorNode, anchorOffset),
      renderedFromNode(focusNode, focusOffset),
    );
    const end = Math.max(
      renderedFromNode(anchorNode, anchorOffset),
      renderedFromNode(focusNode, focusOffset),
    );

    return mapRenderedRangeToRaw(value, start, end);
  } catch {
    return null;
  }
};
