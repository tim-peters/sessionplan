/**
 * useDoubleClickEmulation — the textarea's `onClick` half of the editor's
 * click-to-position / double-click word-selection behavior.
 *
 * Lifecycle (editor opened from a preview click):
 *  1. The preview's onClick fires `setEditing(true)` and the textarea mounts
 *     with `initialCaretPoint = { x, y }`.
 *  2. The parent (FormattedTextField) calls this hook with that point.
 *  3. The `initialCaretPoint` useLayoutEffect runs synchronously at commit
 *     and STASHES `openedAt = performance.now()` and `openedPoint = point`
 *     on two refs.
 *  4. The same effect schedules a rAF that calls
 *     `getCursorPositionFromPoint(textarea, point)` to place the caret at
 *     the matching character offset.
 *  5. The user's NEXT click on the textarea lands in `handleTextareaClick`.
 *     If it happens within `DBLCLICK_MS` and within `DBLCLICK_SLOP_PX`
 *     pixels of the opening click, the caret is expanded to the containing
 *     word run (mirrors native browser double-click → word selection).
 *
 * Why a real `dblclick` never fires: the first click of the pair already
 * opened the editor (and unmounted the preview), so the browser only
 * sees the second click. We emulate the pair here.
 *
 * Why the stash must be synchronous: a very fast second click (automation,
 * or a very quick human) can arrive BEFORE the rAF in step 4 runs, and the
 * emulation must still see the opening metadata. useLayoutEffect (not
 * useEffect) runs synchronously at commit, so the refs are populated
 * before the second click can be dispatched. Passive effects can lose
 * the race against immediately-following input events.
 *
 * The consumed-stash guard (`if (openedAtRef.current === null) return;`)
 * inside the rAF ensures that, if a click already consumed the stash (the
 * fast-second-click path), the pending rAF doesn't clobber that newer
 * caret/selection by jumping back to the opening point.
 */
import { MouseEvent, RefObject, useCallback, useLayoutEffect, useRef } from 'react';
import { expandToWordRun } from '@/lib/textFormatting';
import { getCursorPositionFromPoint } from '@/lib/caretGeometry';

// Double-click emulation: a real dblclick never fires because the FIRST
// click of the pair already opened the editor and unmounted the preview.
// We treat a second click inside this window AND within `DBLCLICK_SLOP_PX`
// of the opening click as the second half of a double-click, then expand
// the caret into a word selection (mirrors native browser behavior).
const DBLCLICK_MS = 500;
const DBLCLICK_SLOP_PX = 5;

export interface UseDoubleClickEmulationResult {
  handleTextareaClick: (e: MouseEvent<HTMLTextAreaElement>) => void;
}

export const useDoubleClickEmulation = ({
  textareaRef,
  initialCaretPoint,
  scheduleSelectionStateUpdate,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  initialCaretPoint: { x: number; y: number } | null | undefined;
  scheduleSelectionStateUpdate: () => void;
}): UseDoubleClickEmulationResult => {
  // Double-click emulation. Set inside the `initialCaretPoint` effect
  // right after the caret is placed, then read by the textarea's onClick
  // to detect a second click that, combined with the first opening click,
  // should behave like a native browser double-click (select the word).
  // Never set by `initialSelection` — carrying an existing selection is
  // already a "selection event", not a click-to-position gesture.
  const openedAtRef = useRef<number | null>(null);
  const openedPointRef = useRef<{ x: number; y: number } | null>(null);

  // initialCaretPoint: place the caret at the click point and refresh
  // selection state. A collapsed caret on PLAIN text hides the toolbar
  // (no selection, no active format); a collapsed caret INSIDE a
  // formatted run keeps the toolbar visible with the matching button
  // pressed — handled by `findActiveRegions` in useSelectionToolbar's
  // updateSelectionState.
  // We also stash the click timestamp + viewport point here so the
  // textarea's onClick can emulate a native double-click: the first
  // click opened the editor (and unmounted the preview), so the real
  // dblclick never fires. The stash happens SYNCHRONOUSLY in the effect
  // body — a very fast second click (automation, or a quick human) can
  //   arrive before the rAF below runs, and the emulation must still see
  //   the opening metadata. The caret itself is correct in that case too:
  //   the browser's native mousedown of the second click places it.
  // useLayoutEffect (not useEffect): the stash must be in place before the
  // second click of a fast double-click is dispatched — passive effects run
  // in a scheduler task that can lose the race against immediately
  // following input events, layout effects run synchronously at commit.
  useLayoutEffect(() => {
    if (!initialCaretPoint || !textareaRef.current) return;

    openedAtRef.current = performance.now();
    openedPointRef.current = initialCaretPoint;

    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      // A click consumed the stash (emulated double-click word selection, or
      // a fast deliberate re-click) — its caret/selection is newer than the
      // opening point, so this pending rAF must not clobber it.
      if (openedAtRef.current === null) return;

      const position = getCursorPositionFromPoint(textarea, initialCaretPoint);
      textarea.setSelectionRange(position, position);
      scheduleSelectionStateUpdate();
    });

    return () => cancelAnimationFrame(frame);
    // scheduleSelectionStateUpdate is stable; only react to the prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaretPoint, textareaRef]);

  const handleTextareaClick = useCallback((e: MouseEvent<HTMLTextAreaElement>) => {
    // Double-click emulation. The first click of a dblclick opens
    // the editor (unmounting the preview), so the browser's real
    // dblclick never fires; we treat a second click inside
    // `DBLCLICK_MS` AND within `DBLCLICK_SLOP_PX` of the opening
    // click point as the second half. The browser's native
    // mousedown already placed the caret at the click point, so
    // we just expand that caret to the containing word run.
    // `openedAtRef` is always cleared — even on a non-match — so
    // stale timestamps can't pair with a later, unrelated click.
    const openedAt = openedAtRef.current;
    const openedPoint = openedPointRef.current;
    openedAtRef.current = null;
    if (openedAt !== null && openedPoint) {
      const dx = e.clientX - openedPoint.x;
      const dy = e.clientY - openedPoint.y;
      const inWindow = performance.now() - openedAt <= DBLCLICK_MS;
      const inSlop = dx * dx + dy * dy <= DBLCLICK_SLOP_PX * DBLCLICK_SLOP_PX;
      if (inWindow && inSlop) {
        const textarea = textareaRef.current;
        if (textarea) {
          const { start, end } = expandToWordRun(textarea.value, textarea.selectionStart);
          if (start !== end) {
            textarea.setSelectionRange(start, end);
            scheduleSelectionStateUpdate();
          }
        }
      }
    }
    e.stopPropagation();
    // scheduleSelectionStateUpdate is stable; include textareaRef only to satisfy
    // exhaustive-deps (ref identity is stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textareaRef]);

  return { handleTextareaClick };
};
