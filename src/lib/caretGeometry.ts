/**
 * caretGeometry — DOM measurement helpers for textarea caret/selection geometry.
 *
 * Role: Build a hidden off-screen mirror that copies the textarea's text layout
 *       (font metrics + box model + white-space rules) so we can ask "where
 *       would the caret land at character offset N?" and "given a viewport
 *       point, which character offset is closest?". Used by the formatting
 *       toolbar's positioning effect and by the initialCaretPoint logic that
 *       places the caret at the click point when the editor opens from a
 *       preview.
 *
 *       Pure DOM measurement, no React.
 *
 * Metrics-neutrality intent
 * -------------------------
 * The mirror copies every CSS property that affects text advance width or
 * line height — `box-sizing`, `font-*`, `letter-spacing`, `text-transform`,
 * `word-spacing`, `text-indent`, `line-height`, `padding-*`, `border-*`,
 * `white-space`, `word-wrap`, `overflow-wrap`, `tab-size`, `text-align`.
 * Layout produced inside the mirror is therefore pixel-identical to the
 * textarea it mirrors, so `cursor.offsetLeft/Top` reflects the same caret
 * position a real browser would render for that character offset. jsdom
 * returns `0` for every layout measurement, so these helpers cannot be
 * unit-tested in isolation; the placement math that consumes them is
 * covered by integration tests that drive real textareas.
 *
 * Mirror reuse
 * ------------
 * `getCursorPositionFromPoint` measures EVERY caret offset 0..n, so building
 * a fresh mirror per offset would be quadratic in DOM churn (n mirrors, n
 * style-property copies, n body append/remove cycles). It instead builds ONE
 * mirror and re-fills it per offset. Semantics are unchanged: the per-offset
 * DOM state is exactly the original sequence (a single text-before node, the
 * cursor span, a single text-after node — the `textContent` assignment first
 * clears any children left over from the previous iteration), and the same
 * strict `<` distance comparison keeps the first-minimum tie-break, so
 * results are identical in real browsers and in jsdom (where every layout
 * measurement is 0 and offset 0 therefore always wins).
 */

const TEXTAREA_STYLE_PROPERTIES = [
  'box-sizing', 'width', 'font-family', 'font-size', 'font-weight', 'font-style',
  'letter-spacing', 'text-transform', 'word-spacing', 'text-indent', 'line-height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'white-space', 'word-wrap', 'overflow-wrap', 'tab-size', 'text-align',
];

/** Builds an empty mirror element and its cursor span. Styling is applied
 *  separately (`styleCursorMirror`) so the pair can be reused across
 *  measurements. */
const buildCursorMirror = (): { mirror: HTMLDivElement; cursor: HTMLSpanElement } => {
  const mirror = document.createElement('div');
  const cursor = document.createElement('span');
  cursor.textContent = '\u200b';
  return { mirror, cursor };
};

/** Copies the textarea's layout-relevant styles onto the mirror and hides it
 *  off-screen. Same property list and positioning as the original single-shot
 *  implementation. */
const styleCursorMirror = (mirror: HTMLDivElement, style: CSSStyleDeclaration): void => {
  TEXTAREA_STYLE_PROPERTIES.forEach((property) => {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  });
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
};

/** Fills the mirror to measure caret `position`: text before + cursor span +
 *  text after. The `textContent` assignment first clears the previous
 *  iteration's children, so the resulting DOM state per measurement is
 *  identical to building a fresh mirror. */
const fillCursorMirror = (
  mirror: HTMLDivElement,
  cursor: HTMLSpanElement,
  value: string,
  position: number,
): void => {
  mirror.textContent = value.slice(0, position);
  mirror.appendChild(cursor);
  mirror.append(value.slice(position));
};

export const getCursorCoordinates = (textarea: HTMLTextAreaElement, position: number) => {
  const { mirror, cursor } = buildCursorMirror();
  styleCursorMirror(mirror, window.getComputedStyle(textarea));
  fillCursorMirror(mirror, cursor, textarea.value, position);
  document.body.appendChild(mirror);

  const coordinates = { left: cursor.offsetLeft, top: cursor.offsetTop };
  mirror.remove();
  return coordinates;
};

export const getCursorPositionFromPoint = (textarea: HTMLTextAreaElement, point: { x: number; y: number }) => {
  const textareaRect = textarea.getBoundingClientRect();
  const { mirror, cursor } = buildCursorMirror();
  styleCursorMirror(mirror, window.getComputedStyle(textarea));
  document.body.appendChild(mirror);

  try {
    let closestPosition = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let position = 0; position <= textarea.value.length; position += 1) {
      fillCursorMirror(mirror, cursor, textarea.value, position);
      const x = textareaRect.left + cursor.offsetLeft - textarea.scrollLeft;
      const y = textareaRect.top + cursor.offsetTop - textarea.scrollTop;
      const distance = (x - point.x) ** 2 + (y - point.y) ** 2;

      if (distance < closestDistance) {
        closestPosition = position;
        closestDistance = distance;
      }
    }

    return closestPosition;
  } finally {
    mirror.remove();
  }
};

export const readLineHeight = (textarea: HTMLTextAreaElement): number => {
  const cs = window.getComputedStyle(textarea);
  const parsed = parseFloat(cs.lineHeight);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  const fontSize = parseFloat(cs.fontSize);
  if (!Number.isNaN(fontSize) && fontSize > 0) return fontSize * 1.5;
  return 20;
};
