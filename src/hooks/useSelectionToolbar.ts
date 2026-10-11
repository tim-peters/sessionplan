/**
 * useSelectionToolbar — state + effects driving the floating formatting toolbar
 * for FormattedTextField.
 *
 * Owns:
 *  - focused / hasSelection / activeFormats / positionVersion /
 *    selectionVersion / toolbarPosition / toolbarHovered state.
 *  - toolbarRef.
 *  - the placement useLayoutEffect (computes toolbar position from the
 *    textarea selection geometry and viewport size).
 *  - the ResizeObserver effect (bumps positionVersion on textarea resize).
 *  - the document-capture scroll + window-resize effect (bumps
 *    positionVersion while the toolbar is visible).
 *  - the toolbar-hover reset effect.
 *  - updateSelectionState (refreshes selection-derived state from the DOM
 *    and bumps selectionVersion) and scheduleSelectionStateUpdate (defers
 *    that read past in-progress execCommand / wrapSelection selection
 *    restores via setTimeout(0)).
 *
 * Note: while `toolbarVisible` is false, the placement / scroll-listener
 * effects do nothing (they early-return on that flag) and the hover-reset
 * effect only resets an already-false flag. No effect in the parent
 * FormattedTextField consumes any state produced here, so declaring this
 * hook before the parent's own effects makes the intra-commit ordering
 * unobservable.
 */
import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  findActiveRegions,
  FormatKind,
} from '@/lib/textFormatting';
import {
  getCursorCoordinates,
  readLineHeight,
} from '@/lib/caretGeometry';
import { isCoarsePointer } from '@/lib/domUtils';
import { computeToolbarPlacement } from '@/lib/selectionToolbarLayout';

// Gap between the toolbar and the anchor line in pixels — must match the
// visual offset that the previous `-translate-y-[calc(100%_+_6px)]` class
// produced, so flipping from above to below keeps the same gap.
const TOOLBAR_GAP = 6;
// jsdom (and a not-yet-measured toolbar) reports offsetWidth/Height as 0;
// fall back to a sensible default so the placement math still produces a
// sensible position on the first render.
const TOOLBAR_FALLBACK_WIDTH = 88;
const TOOLBAR_FALLBACK_HEIGHT = 32;

export interface UseSelectionToolbarResult {
  focused: boolean;
  setFocused: (v: boolean) => void;
  toolbarRef: RefObject<HTMLDivElement | null>;
  toolbarPosition: { left: number; top: number; below: boolean };
  toolbarVisible: boolean;
  linkDisabled: boolean;
  activeFormats: FormatKind[];
  updateSelectionState: () => void;
  scheduleSelectionStateUpdate: () => void;
  setToolbarHovered: (v: boolean) => void;
  bumpPositionVersion: () => void;
}

export const useSelectionToolbar = ({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}): UseSelectionToolbarResult => {
  const [focused, setFocused] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  // Formatting kinds the caret/selection currently sits in, in stack order
  // (outermost first). For a plain caret this is empty; for a caret inside
  // a single formatted run it has one entry; for a caret inside nested
  // content like `*_hello_*` it has BOTH — every enclosing button shows
  // pressed and clicking any one toggles just that layer off, leaving the
  // surrounding chain intact.
  const [activeFormats, setActiveFormats] = useState<FormatKind[]>([]);
  const [positionVersion, setPositionVersion] = useState(0);
  // selectionVersion is bumped on every selection change (mouseup, select,
  // keyup, pointerup, deferred handleChange). The placement effect
  // depends on it so the toolbar re-anchors whenever the selection moves
  // (including across rows). Inside the effect the row is re-read from the
  // DOM; same-row extensions resolve to an identical placement and the
  // visible toolbar doesn't move.
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [toolbarPosition, setToolbarPosition] = useState<{ left: number; top: number; below: boolean }>({
    left: 0,
    top: 0,
    below: false,
  });
  const [toolbarHovered, setToolbarHovered] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Trailing-edge dedupe for scheduleSelectionStateUpdate. The handler can
  // be called many times in quick succession (input + keyup + pointerup +
  // mouseup on the same gesture); without dedupe each call would queue
  // its own setTimeout(0). We always CLEAR the pending timeout and
  // re-schedule so the read fires AFTER every action's restore timeout
  // has had a chance to run.
  const pendingSelectionUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // bumpPositionVersion: bumped from outside this hook (e.g. the
  // textarea's onScroll handler) to retrigger the placement effect after
  // the backdrop has been synced with the textarea's scrollTop/Left.
  const bumpPositionVersion = useCallback(() => setPositionVersion((v) => v + 1), []);

  // Toolbar is visible iff the field is focused AND there is something to
  // act on: either a non-collapsed selection OR the caret sitting inside
  // a formatted run (so the matching button can toggle that formatting
  // off — and nested runs press several buttons at once). Hover-freeze
  // (during pointer interaction) is applied at the reposition-effect
  // level, not at the visibility level — the toolbar stays mounted while
  // the mouse is over it so the user can click.
  const toolbarVisible = focused && (hasSelection || activeFormats.length > 0);
  // The Link button is enabled with either a selection (to wrap with
  // `[text](url)`) or an active link (to toggle that link off instead of
  // prompting for a new URL).
  const linkDisabled = !hasSelection && !activeFormats.includes('link');

  // If the toolbar unmounts while the pointer is over it (blur or selection
  // collapse — pointerleave never fires for a removed element), the frozen
  // flag would stick and the next toolbar render would be stuck at a stale
  // position. Reset it whenever the toolbar hides.
  useEffect(() => {
    if (!toolbarVisible) setToolbarHovered(false);
  }, [toolbarVisible]);

  // Reposition effect. Runs whenever any of the following change:
  //   - toolbarVisible transitions (selection appears / focus enters)
  //   - toolbarHovered (hover-freeze toggle)
  //   - selectionVersion (any selection change — same-row extensions
  //     recompute to an identical placement and skip the re-render)
  //   - positionVersion (scroll, resize)
  // Inside the effect we re-read all DOM state (selection, geometry,
  // sizes) so a stale-closure read of e.g. selectionStart can never
  // happen — the closure captures only the version counter / flags.
  // It is a layout effect so the toolbar's FIRST position is committed
  // before paint and it never flashes at (0, 0).
  useLayoutEffect(() => {
    if (!toolbarVisible) return;
    if (toolbarHovered) return;
    const textarea = textareaRef.current;
    const toolbar = toolbarRef.current;
    if (!textarea || !toolbar) return;

    const below = isCoarsePointer();
    // Coarse pointer anchors at the LAST line of the selection so the
    // toolbar sits below the native iOS/Android selection callout.
    // Fine pointer anchors at the FIRST visible line (multi-line
    // selections stay anchored at their top).
    const anchorPosition = below ? textarea.selectionEnd : textarea.selectionStart;
    const cursor = getCursorCoordinates(textarea, anchorPosition);
    const textareaRect = textarea.getBoundingClientRect();
    const lineHeight = readLineHeight(textarea);
    const toolbarWidth = toolbar.offsetWidth || TOOLBAR_FALLBACK_WIDTH;
    const toolbarHeight = toolbar.offsetHeight || TOOLBAR_FALLBACK_HEIGHT;

    // The toolbar is portaled to document.body and positioned with
    // position:fixed, so both the anchor and the clamp/flip bounds are
    // viewport-relative. Floating above every ancestor means
    // overflow:hidden clipping contexts (workshop header card, title
    // wrappers, dialogs) can never cut the toolbar off.
    const anchorTop = textareaRect.top + cursor.top - textarea.scrollTop;
    const anchorLeft = textareaRect.left + cursor.left - textarea.scrollLeft;

    const placement = computeToolbarPlacement({
      anchorTop,
      anchorLeft,
      lineHeight,
      toolbarWidth,
      toolbarHeight,
      containerWidth: window.innerWidth,
      containerHeight: window.innerHeight,
      gap: TOOLBAR_GAP,
      below,
    });

    // Set the toolbar position. Use a functional setter so that when the
    // selection grew within the same row (or the result equals the
    // current placement) we bail out and React skips the re-render —
    // prevents "nervous jumping" while the user drags the selection.
    setToolbarPosition((prev) =>
      prev.left === placement.left && prev.top === placement.top && prev.below === placement.below
        ? prev
        : placement,
    );
    // selectionVersion intentionally drives a re-run when the user moves
    // the selection across rows. Same-row extensions resolve to the same
    // placement object above and React skips the re-render.
  }, [toolbarVisible, toolbarHovered, positionVersion, selectionVersion, textareaRef]);

  // ResizeObserver on the textarea: covers both autoGrow height changes
  // and any external resize of the container. Bumping positionVersion is
  // enough to retrigger the placement effect. Guarded for environments
  // without ResizeObserver (e.g. jsdom).
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const ro = new ResizeObserver(() => {
      setPositionVersion((v) => v + 1);
    });
    ro.observe(textarea);
    return () => ro.disconnect();
  }, [textareaRef]);

  // While the toolbar is visible, any ancestor scroll changes where the
  // selection sits in the viewport (the toolbar is position:fixed and no
  // longer scrolls along inside its old container). Scroll events don't
  // bubble but DO propagate in the capture phase, so a capture listener on
  // document sees every scroller — the textarea itself, dialog bodies,
  // the page. A window resize likewise invalidates the viewport-relative
  // placement.
  useEffect(() => {
    if (!toolbarVisible) return;
    const bump = () => setPositionVersion((v) => v + 1);
    document.addEventListener('scroll', bump, true);
    window.addEventListener('resize', bump);
    return () => {
      document.removeEventListener('scroll', bump, true);
      window.removeEventListener('resize', bump);
    };
  }, [toolbarVisible]);

  // Stable identity: only touches refs and state setters, so useCallback
  // keeps it referentially equal across renders. This is load-bearing for
  // the "scheduleSelectionStateUpdate is stable" dep-array comments in
  // FormattedTextField / useDoubleClickEmulation — their useCallback
  // memoizations would otherwise never hit.
  const updateSelectionState = useCallback(() => {
    const el = textareaRef.current;
    setHasSelection(!!el && el.selectionStart !== el.selectionEnd);
    // Recompute which formatting kinds the caret/selection sits in.
    // Collapsed caret INSIDE a formatted run counts as active so the
    // toolbar stays visible with the matching button pressed (toggle-off
    // via click or Cmd+B/I/K). For nested runs like `*_hello_*` both
    // bold and italic are returned — every enclosing button shows
    // pressed, clicking any one toggles just that layer off.
    if (el) {
      const regions = findActiveRegions(el.value, el.selectionStart, el.selectionEnd);
      setActiveFormats(regions.map((r) => r.kind));
    } else {
      setActiveFormats([]);
    }
    // Bump selectionVersion so the placement effect re-reads the DOM and
    // re-anchors the toolbar if the selection moved to another row.
    setSelectionVersion((v) => v + 1);
  }, [textareaRef]);

  // Trailing-edge dedupe (see pendingSelectionUpdateRef above) + stable
  // identity via useCallback.
  const scheduleSelectionStateUpdate = useCallback(() => {
    if (pendingSelectionUpdateRef.current !== null) {
      clearTimeout(pendingSelectionUpdateRef.current);
    }
    pendingSelectionUpdateRef.current = setTimeout(() => {
      pendingSelectionUpdateRef.current = null;
      updateSelectionState();
    }, 0);
  }, [updateSelectionState]);

  // Unmount: cancel any pending selection-state refresh so a queued read
  // never fires against an unmounted textarea.
  useEffect(() => () => {
    if (pendingSelectionUpdateRef.current !== null) {
      clearTimeout(pendingSelectionUpdateRef.current);
      pendingSelectionUpdateRef.current = null;
    }
  }, []);

  return {
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
  };
};
