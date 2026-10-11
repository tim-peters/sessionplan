import { useEffect, useLayoutEffect, useRef, useState, ChangeEvent, UIEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  tokenizeFormatting,
  FormatToken,
  FormatKind,
} from '@/lib/textFormatting';
import { useSelectionToolbar } from '@/hooks/useSelectionToolbar';
import { useFormattingActions } from '@/hooks/useFormattingActions';
import { useDoubleClickEmulation } from '@/hooks/useDoubleClickEmulation';
import { FormattingToolbar } from './FormattingToolbar';
import { cn } from '@/lib/utils';

interface FormattedTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoGrow?: boolean;
  rows?: number;
  autoFocus?: boolean;
  toolbarSize?: 'xs' | 'sm';
  align?: 'left' | 'right';
  /** When the editor opens from a preview click, the caret lands at the
   *  viewport point under the cursor. Pass `null` for focus-only opens
   *  (e.g. keyboard activation). */
  initialCaretPoint?: { x: number; y: number } | null;
  /** When the editor opens from a preview click that landed on a selection
   *  in the FORMATTED preview, this is the matching raw-value range so the
   *  textarea opens with the SAME text selected and the toolbar visible. */
  initialSelection?: { start: number; end: number } | null;
  id?: string;
  className?: string;
  /** Extra attributes rendered onto the underlying <textarea>, e.g. data-*
   *  hooks used by global keyboard shortcuts (focusSessionElement). */
  dataAttributes?: Record<string, string>;
}

// Backdrop token styles. IMPORTANT: these must never change text METRICS
// (advance widths) — the transparent textarea above the backdrop draws its
// caret and selection highlight from its own regular-weight layout, so any
// real font-weight here would desync the visible caret from the visible
// text (the bug behind "cursor position doesn't match after bold+italic").
// Bold therefore uses the paint-only `.formatting-faux-bold` stroke (see
// index.css); italic's advance widths are metrically compatible (~0.04px per
// char for the app font) and keep the real `font-style`; underline and color
// are paint-only anyway.
const TOKEN_CLASS: Record<FormatToken['kind'], string> = {
  plain: '',
  marker: 'opacity-40',
  bold: 'formatting-faux-bold',
  italic: 'italic',
  'link-text': 'text-primary underline',
  'link-url': 'opacity-40',
};

// Styles applied by an ENCLOSING match (the kinds in `token.styles`). The
// token's OWN kind supplies its own styles via TOKEN_CLASS; these compose
// on top so a plain run inside a bold match still renders bold. Same
// metrics-neutrality rule as TOKEN_CLASS above.
const ENCLOSING_CLASS: Record<FormatKind, string> = {
  bold: 'formatting-faux-bold',
  italic: 'italic',
  link: 'text-primary underline',
};

const CHROME_CLASSES = {
  inline: 'bg-transparent rounded',
  // No focus ring: while editing, the field should blend into its context
  // (plain text, no border/color changes) — the caret and the formatting
  // toolbar are the editing affordances. The static border is a form-field
  // affordance (e.g. BlockEditDialog), independent of focus.
  dialog: 'rounded-md border border-input bg-background',
};

const FIELD_CLASSES = {
  inline: 'leading-5',
  dialog: 'px-3 py-2 text-sm',
};

export const FormattedTextField = ({
  value,
  onChange,
  onBlur,
  placeholder,
  multiline = false,
  autoGrow = false,
  rows,
  autoFocus = false,
  toolbarSize = 'sm',
  align = 'left',
  initialCaretPoint,
  initialSelection,
  id,
  className,
  dataAttributes,
}: FormattedTextFieldProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const {
    focused,
    setFocused,
    toolbarRef,
    toolbarPosition,
    toolbarVisible,
    linkDisabled,
    activeFormats,
    updateSelectionState,
    scheduleSelectionStateUpdate,
    setToolbarHovered,
    bumpPositionVersion,
  } = useSelectionToolbar({ textareaRef });

  const { handleKeyDown, handleBold, handleItalic, handleLink } = useFormattingActions({
    textareaRef,
    multiline,
    onChange,
    scheduleSelectionStateUpdate,
  });

  const { handleTextareaClick } = useDoubleClickEmulation({
    textareaRef,
    initialCaretPoint,
    scheduleSelectionStateUpdate,
  });

  const variant = autoGrow ? 'inline' : 'dialog';
  const whiteSpaceClass = multiline ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto';
  const textAlignClass = align === 'right' ? 'text-right' : 'text-left';

  useEffect(() => {
    if (autoGrow && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [autoGrow, value]);

  // Scroll-sync parity: the backdrop must be exactly as tall (and no taller)
  // than the textarea's scrollable client area, otherwise the 1:1 scrollTop
  // sync in handleScroll clamps earlier on the backdrop than on the textarea
  // and the styled text visibly drifts from the caret/selection once the
  // field scrolls (e.g. long notes in BlockEditDialog). The textarea therefore
  // renders as `display: block` — its default inline-block participates in
  // the container's line box, whose strut adds a few px of baseline gap below
  // the field, inflating the container (and with it the inset-0 backdrop)
  // without inflating the textarea's own scrollable area. `block` removes the
  // gap; nothing visible changes (the chrome around the field is transparent
  // in the inline variant, and the dialog field only loses the empty strip).
  // Second parity axis: when the textarea shows a SPACE-TAKING scrollbar
  // (Windows, or macOS "always show scrollbars"), its clientWidth shrinks
  // while the absolutely-positioned backdrop keeps the full container width —
  // the two would wrap text differently and drift. Mirror the textarea's
  // clientWidth onto the backdrop whenever they diverge; a no-op with overlay
  // scrollbars (macOS default), where the widths already match.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    if (!textarea || !backdrop) return;
    const scrollbarSpace = textarea.offsetWidth - textarea.clientWidth;
    if (scrollbarSpace > 0) {
      const width = `${textarea.clientWidth}px`;
      if (backdrop.style.width !== width) backdrop.style.width = width;
    } else if (backdrop.style.width) {
      backdrop.style.width = '';
    }
    // The scrollbar appears/disappears as the value wraps differently —
    // re-check on every value change and variant switch.
  }, [variant, value]);

  // initialSelection: open the editor with a non-collapsed selection
  // already in place, matching a selection the user made in the
  // formatted preview. Clamped to the value length so out-of-range
  // offsets from a malformed upstream never throw, and to keep end >=
  // start (a collapsed range is ignored). Declared AFTER the
  // initialCaretPoint effect (now in useDoubleClickEmulation) so its
  // rAF wins if both props are ever passed together (callers pass one
  // or the other in practice).
  useEffect(() => {
    if (!initialSelection || !textareaRef.current) return;

    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const max = textarea.value.length;
      const start = Math.max(0, Math.min(max, initialSelection.start));
      const end = Math.max(start, Math.min(max, initialSelection.end));
      textarea.setSelectionRange(start, end);
      scheduleSelectionStateUpdate();
    });

    return () => cancelAnimationFrame(frame);
    // scheduleSelectionStateUpdate is stable; only react to the prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelection]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    // Defer the selection-state read: the input event may have been fired
    // by document.execCommand('insertText') DURING wrapSelection, at which
    // point selectionStart/End still reflect the post-insert collapsed
    // caret. wrapSelection then re-asserts the selection synchronously; by
    // pushing our read to setTimeout(0) we observe the restored selection,
    // so hasSelection stays correct and the toolbar never flashes off
    // mid-apply.
    onChange(e.target.value);
    scheduleSelectionStateUpdate();
  };

  const handleScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    bumpPositionVersion();
  };

  return (
    // text-foreground: the field is often mounted inside muted contexts
    // (notes/material previews render in text-muted-foreground containers).
    // While EDITING, the text must always read as regular foreground text,
    // regardless of what the resting preview looked like.
    <div className={cn('relative text-foreground', className)}>
      {toolbarVisible &&
        createPortal(
          <FormattingToolbar
            ref={toolbarRef}
            onBold={handleBold}
            onItalic={handleItalic}
            onLink={handleLink}
            linkDisabled={linkDisabled}
            active={activeFormats}
            size={toolbarSize}
            onPointerEnter={() => setToolbarHovered(true)}
            onPointerLeave={() => setToolbarHovered(false)}
            className="fixed z-50 -translate-x-1/2 bg-background/90 backdrop-blur-sm rounded shadow-sm"
            style={{ left: toolbarPosition.left, top: toolbarPosition.top }}
          />,
          document.body,
        )}
      <div className={cn('relative', CHROME_CLASSES[variant])}>
        <div
          ref={backdropRef}
          aria-hidden
          className={cn('pointer-events-none absolute inset-0 overflow-hidden', FIELD_CLASSES[variant], whiteSpaceClass, textAlignClass)}
        >
          {value
            ? tokenizeFormatting(value).map((token, i) => (
                <span
                  key={i}
                  className={cn(
                    TOKEN_CLASS[token.kind],
                    ...(token.styles ?? []).map((k) => ENCLOSING_CLASS[k]),
                  )}
                >
                  {token.text}
                </span>
              ))
            : null}
        </div>
        <textarea
          ref={textareaRef}
          id={id}
          {...(dataAttributes ?? {})}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={autoGrow ? 1 : rows || 1}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onSelect={updateSelectionState}
          onMouseUp={updateSelectionState}
          onKeyUp={updateSelectionState}
          // Touch: native selection handles on iOS/Android commit on
          // pointerup, which doesn't fire mouseup consistently. Scheduling
          // the refresh keeps the toolbar in sync with selection-handle
          // drags.
          onPointerUp={() => scheduleSelectionStateUpdate()}
          onFocus={() => {
            setFocused(true);
            // Refresh both selection-derived pieces of state from the DOM
            // so they stay in sync (a selection could exist on mount, e.g.
            // when initialSelection was passed).
            updateSelectionState();
          }}
          onBlur={(e) => { setFocused(false); onBlur?.(e.target.value); }}
          onClick={handleTextareaClick}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ caretColor: 'hsl(var(--foreground))' }}
          className={cn(
            'relative block w-full resize-none border-none bg-transparent text-transparent outline-none placeholder:text-muted-foreground',
            autoGrow ? 'overflow-hidden' : 'overflow-auto',
            FIELD_CLASSES[variant],
            whiteSpaceClass,
            textAlignClass,
          )}
        />
      </div>
    </div>
  );
};
