/**
 * useClickToEdit — shared click-to-edit transition for the inline preview /
 * editor pairs in BlockPreview and WorkshopDescription.
 *
 * Two consumers (BlockPreview's `InlineEditableField` and
 * `WorkshopDescription`) used to duplicate the same state machine:
 *  - `editing` (also called `focused` or `open`) — whether the editor view
 *    is mounted.
 *  - `caretPoint` — when the preview's onClick fires with no carried
 *    selection, the editor opens with the caret at this viewport point.
 *  - `initialSelection` — when the user drag-selected text in the FORMATTED
 *    preview, the editor opens with that exact raw-value range selected so
 *    the formatting toolbar appears immediately.
 *  - `previewRef` — attached to the preview element so the click handler
 *    can read `window.getSelection()` against it.
 *
 * The carried-selection decision is the only non-trivial piece:
 *  1. Read `getRawRangeFromPreviewSelection(preview, value)`.
 *  2. If non-null and non-collapsed (`start !== end`), set
 *     `initialSelection = carried` and `caretPoint = null`.
 *  3. Otherwise set `initialSelection = null` and
 *     `caretPoint = { x: e.clientX, y: e.clientY }`.
 * Either branch ends with `setEditing(true)`.
 *
 * The two callers diverge on blur: BlockPreview's InlineEditableField
 * calls a `onEmptyBlur` only if the field's value became empty;
 * WorkshopDescription just closes unconditionally. The hook returns
 * `stopEditing()` and lets each caller wrap it with its own contract.
 */
import { MouseEvent as ReactMouseEvent, RefObject, useCallback, useRef, useState } from 'react';
import { getRawRangeFromPreviewSelection } from '@/lib/previewSelection';

export interface UseClickToEditResult<T extends HTMLElement> {
  previewRef: RefObject<T | null>;
  editing: boolean;
  startEditing: (e: ReactMouseEvent) => void;
  stopEditing: () => void;
  caretPoint: { x: number; y: number } | null;
  initialSelection: { start: number; end: number } | null;
}

export const useClickToEdit = <T extends HTMLElement>({
  value,
  initiallyEditing = false,
}: {
  value: string;
  initiallyEditing?: boolean;
}): UseClickToEditResult<T> => {
  const previewRef = useRef<T>(null);
  const [editing, setEditing] = useState(initiallyEditing);
  // Where the user clicked to open the editor, so the caret can start right
  // there (same click-to-edit behavior as the timeline block previews).
  const [caretPoint, setCaretPoint] = useState<{ x: number; y: number } | null>(null);
  // When the user clicked while holding a selection in the formatted preview
  // (drag-select), carry that selection into the opening editor
  // so it opens with the SAME text selected and the toolbar visible.
  const [initialSelection, setInitialSelection] = useState<{ start: number; end: number } | null>(null);

  const startEditing = useCallback((e: ReactMouseEvent) => {
    // Try to carry an in-preview selection into the opening editor. A
    // collapsed click falls back to opening with a caret at the click
    // point.
    const carried = previewRef.current
      ? getRawRangeFromPreviewSelection(previewRef.current, value)
      : null;
    if (carried && carried.start !== carried.end) {
      setInitialSelection(carried);
      setCaretPoint(null);
    } else {
      setInitialSelection(null);
      setCaretPoint({ x: e.clientX, y: e.clientY });
    }
    setEditing(true);
  }, [value]);

  const stopEditing = useCallback(() => setEditing(false), []);

  return {
    previewRef,
    editing,
    startEditing,
    stopEditing,
    caretPoint,
    initialSelection,
  };
};
