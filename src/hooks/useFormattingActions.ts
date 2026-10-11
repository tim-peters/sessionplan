/**
 * useFormattingActions — shared routing for the formatting toolbar buttons
 * and the Cmd/Ctrl+B/I/K keyboard shortcuts.
 *
 * Bold/Italic use the same toggle-or-wrap logic: if the caret/selection
 * currently sits inside a matching format region, toggle that region OFF;
 * otherwise wrap the selection with the marker. The same functions back
 * both the toolbar buttons and the keyboard shortcuts so they share
 * toggle semantics — e.g. inside a nested chain like `*_hello_*`, only
 * the matched layer is removed when either input fires.
 *
 * Link is two-state: caret inside an existing link toggles it off;
 * otherwise the selection (required) is wrapped with `[text](url)` after
 * prompting for a URL.
 *
 * The DOM-level mutation lives in textFormattingActions
 * (wrapSelection / insertLink / removeFormatting), which keeps the
 * browser's native undo stack in sync via document.execCommand.
 * applyMarkerOrToggle here calls those and forwards the returned text
 * (or null on the native path) to the parent's onChange.
 *
 * On Mac the modifier key is `metaKey`; elsewhere it's `ctrlKey`.
 * `isMacPlatform` from @/lib/domUtils prefers the modern User-Agent
 * Client Hints API (`navigator.userAgentData.platform`) and falls back
 * to the deprecated `navigator.platform`. Both surfaces are matched with
 * a case-insensitive MAC substring check.
 */
import { RefObject, useCallback } from 'react';
import { KeyboardEvent } from 'react';
import {
  findActiveRegionOfKind,
} from '@/lib/textFormatting';
import {
  wrapSelection,
  insertLink,
  promptForLink,
  removeFormatting,
} from '@/lib/textFormattingActions';
import { isMacPlatform } from '@/lib/domUtils';

export interface UseFormattingActionsResult {
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleBold: () => void;
  handleItalic: () => void;
  handleLink: () => void;
}

export const useFormattingActions = ({
  textareaRef,
  multiline,
  onChange,
  scheduleSelectionStateUpdate,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  multiline: boolean;
  onChange: (value: string) => void;
  scheduleSelectionStateUpdate: () => void;
}): UseFormattingActionsResult => {
  // Shared routing for Bold/Italic: if the caret/selection currently sits
  // inside a matching format region, toggle it OFF; otherwise wrap the
  // selection with the marker. Used by both the toolbar buttons and the
  // Cmd/Ctrl+B/I keyboard shortcuts so they share toggle semantics. In a
  // nested chain like `*_hello_*` only the matched layer is removed — the
  // outer/inner regions stay intact.
  const applyMarkerOrToggle = useCallback((kind: 'bold' | 'italic', marker: '*' | '_') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const region = findActiveRegionOfKind(textarea.value, textarea.selectionStart, textarea.selectionEnd, kind);
    if (region) {
      const result = removeFormatting(textarea, region);
      if (result !== null) onChange(result);
    } else {
      const result = wrapSelection(textarea, marker);
      if (result !== null) onChange(result);
    }
    scheduleSelectionStateUpdate();
  }, [textareaRef, onChange, scheduleSelectionStateUpdate]);

  const handleBold = useCallback(() => applyMarkerOrToggle('bold', '*'), [applyMarkerOrToggle]);
  const handleItalic = useCallback(() => applyMarkerOrToggle('italic', '_'), [applyMarkerOrToggle]);

  const handleLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Toggle-off path: caret inside an existing link → remove the syntax.
    // Used by both the toolbar button and Cmd/Ctrl+K.
    const region = findActiveRegionOfKind(textarea.value, textarea.selectionStart, textarea.selectionEnd, 'link');
    if (region) {
      const result = removeFormatting(textarea, region);
      if (result !== null) onChange(result);
      scheduleSelectionStateUpdate();
      return;
    }
    // Insert path: needs a selection to wrap with `[text](url)`.
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    if (!selectedText) return;
    const url = promptForLink();
    if (!url) return;
    const result = insertLink(textarea, url);
    if (result !== null && result !== textarea.value) onChange(result);
    scheduleSelectionStateUpdate();
  }, [textareaRef, onChange, scheduleSelectionStateUpdate]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      return;
    }

    const isMac = isMacPlatform();
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    if (!modKey) return;

    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      handleBold();
    } else if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      handleItalic();
    } else if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      handleLink();
    }
  }, [multiline, handleBold, handleItalic, handleLink]);

  return { handleKeyDown, handleBold, handleItalic, handleLink };
};
