/**
 * TimeVisualizationStrip — Slim vertical track at the right edge of the
 * workshop planner that visualizes the time distribution of the session.
 *
 * Each block renders as a segment proportional to its duration, spanning from
 * plan start to plan end. Block types are recognizable by their color; gaps
 * (e.g. from fixedStartTime) appear as empty track. Groups expand to their
 * children at any nesting depth and additionally render as a thin gray line
 * hugging the right inner edge of the track. Breakouts collapse to a single
 * segment per container, drawn as a diagonal hatch in the breakout color.
 *
 * When the session is taller than the viewport, a subtle gray indicator on
 * the track shows which portion of the session is currently visible. The
 * indicator is draggable (vertical drag) and the track itself is clickable:
 *  - Drag the indicator  → page scrolls so the indicator follows the pointer
 *                          (exact-follow, like a scrollbar thumb).
 *  - Click empty track   → page scrolls so the visible range centers on the
 *                          clicked minute.
 *  - Keyboard            → ArrowUp/Down step ±5min, PageUp/Down step ±30min,
 *                          Home/End jump to the ends.
 *
 * The indicator auto-hides: it fades out after a few seconds without scrolling
 * or hovering and fades back in on either (or while dragged/focused).
 *
 * While Live Mode is active, a thin blue "current position" line is drawn at
 * the running session's minute. It's independent of the viewport indicator
 * (not subject to auto-hide) and is z-20 so it stays above both the segments
 * and the scroll indicator.
 *
 * Role: pure rendering module — derives everything from props. No state,
 *       no DnD, no business logic.
 * Used by: src/components/states/WorkshopPlanner.tsx (lazy-loaded)
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/primitives/tooltip';
import { cn } from '@/lib/utils';
import { WorkshopItem, BlockType } from '@/types/workshop';
import { timeToMinutes } from '@/lib/playModeUtils';
import {
  buildBlockAnchors,
  computeSegments,
  computeTotalSpanMin,
  formatMinAsHHMM,
  hasRenderableSegments,
  pixelAtMinute,
  type BlockAnchor,
} from '@/lib/timeVisualization';
import { useTimelineViewport } from '@/hooks/useTimelineViewport';
import { useHoveredItemId } from '@/hooks/useHoverHighlight';
import { getHoveredItemId, setHoveredItem } from '@/lib/hoverHighlight';

interface TimeVisualizationStripProps {
  items: WorkshopItem[];
  blockTypes: BlockType[];
  /** Workshop start time ("HH:MM") or null when unset. */
  startTime: string | null;
  /** Bottom edge of the sticky planner chrome (px, viewport-relative). */
  topOffsetPx: number;
  /** Ref to the timeline content root. Used to measure visible minute range. */
  timelineContentRef: RefObject<HTMLElement | null>;
  /**
   * Live Mode's current minute (null when Live Mode is off or the position
   * isn't determinable). Drives the blue "current position" line on the
   * strip. The strip clamps to [0, span] internally.
   */
  liveCurrentMinute: number | null;
}

const STRIP_GAP_PX = 12; // breathing room below the header chrome
const BOTTOM_OFFSET_PX = 72; // breathing room above the viewport bottom
const ARROW_STEP_MIN = 5; // ArrowUp/Down keyboard step
const PAGE_STEP_MIN = 30; // PageUp/Down keyboard step
const AUTO_HIDE_MS = 800; // indicator fades out after this much idle time
const TOOLTIP_SUPPRESS_DELAY_MS = 999999; // effectively disables tooltips during a drag
/** Hover zone extending this many px to the LEFT of the strip: hovering near
 *  the strip (without touching it) already brings the indicator back. */
const PROXIMITY_PX = 24;

/** Snapshot of layout + viewport state captured at the start of an interaction. */
interface DragSnapshot {
  anchors: BlockAnchor[];
  contentHeight: number;
  stripHeight: number;
  stripTop: number;
  headerBottomPx: number;
  span: number;
  visibleSpan: number;
  pointerId: number;
  /** Pointer's Y relative to the indicator box's top edge — preserves grab
   *  offset so dragging feels like "hold and move" rather than "jump to center". */
  pointerOffsetY: number;
}

export const TimeVisualizationStrip = ({
  items,
  blockTypes,
  startTime,
  topOffsetPx,
  timelineContentRef,
  liveCurrentMinute,
}: TimeVisualizationStripProps) => {
  const { t } = useTranslation('common');

  const segments = useMemo(
    () => computeSegments(items, startTime, blockTypes),
    [items, startTime, blockTypes],
  );
  const span = useMemo(() => computeTotalSpanMin(segments), [segments]);

  const viewport = useTimelineViewport({
    contentRef: timelineContentRef,
    segments,
    headerBottomPx: topOffsetPx,
  });

  // Cross-highlight: subscribe once at the strip level (cheaper than per-
  // segment since segments are rendered inside a map and hooks can't run in
  // loops). Segment handlers are attached inline.
  const hoveredId = useHoveredItemId();

  const stripRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragSnapshotRef = useRef<DragSnapshot | null>(null);
  const rafIdRef = useRef<number | null>(null);
  // Latest pointermove target — the rAF reads from this ref each frame so
  // bursty events coalesce into the most-recent position instead of only
  // acting on the first one.
  const latestTargetMinRef = useRef<number | null>(null);

  // ── Indicator auto-hide ────────────────────────────────────────────────────
  // The indicator fades out after a few seconds without scrolling or hovering
  // and fades back in on either. While the pointer rests on the track (or the
  // indicator is being dragged/focused) it stays visible regardless of idle time.
  const [indicatorVisible, setIndicatorVisible] = useState(true);
  const [trackHovered, setTrackHovered] = useState(false);
  const [trackFocused, setTrackFocused] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Proximity zone: hovering within PROXIMITY_PX left of the strip counts as
  // "on the track" for the auto-hide logic. The strip is `position: fixed`
  // so its rect moves only when `topPx` changes (which it does, when the
  // sticky header grows/shrinks). We cache the rect in a ref and refresh it
  // on `scroll`, `resize`, and when `topOffsetPx` changes — the pointermove
  // handler then only compares numbers.
  const stripRectRef = useRef<{ top: number; bottom: number; left: number; right: number } | null>(null);
  const refreshStripRect = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    stripRectRef.current = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }, []);
  const [stripProximate, setStripProximate] = useState(false);
  useEffect(() => {
    refreshStripRect();
    const onPointerMove = (e: PointerEvent) => {
      const rect = stripRectRef.current;
      if (!rect) return;
      const inBand =
        e.clientX >= rect.left - PROXIMITY_PX &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      setStripProximate(inBand);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', refreshStripRect, { passive: true });
    window.addEventListener('resize', refreshStripRect);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', refreshStripRect);
      window.removeEventListener('resize', refreshStripRect);
    };
  }, [refreshStripRect]);

  useEffect(() => {
    // Whenever the strip's top changes (header grew/shrunk), refresh the
    // cached rect so the proximity check uses fresh coordinates.
    refreshStripRect();
  }, [topOffsetPx, refreshStripRect]);

  useEffect(() => {
    const visibleSpan =
      viewport && viewport.endMin > viewport.startMin
        ? viewport.endMin - viewport.startMin
        : 0;
    const indicatorApplies = !!viewport && visibleSpan > 0 && visibleSpan < span;

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    // No indicator at all, pointer resting on/near the track, active drag or
    // keyboard focus → always visible, no timer.
    if (!indicatorApplies || trackHovered || stripProximate || trackFocused || isDragging) {
      setIndicatorVisible(true);
      return;
    }
    // Scroll (any source: wheel, keyboard, scrollbar, drag) re-runs this
    // effect via `viewport` — always fade the indicator back in first, then
    // arm the idle timer.
    setIndicatorVisible(true);
    hideTimerRef.current = window.setTimeout(() => setIndicatorVisible(false), AUTO_HIDE_MS);
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [viewport, span, trackHovered, trackFocused, stripProximate, isDragging]);

  /**
   * Build a layout snapshot used by drag/click/keyboard to map between
   * pointer Y on the strip and the actual scroll position in the content.
   * Returns null when any of the required DOM nodes aren't mounted yet.
   */
  const measure = useCallback((): DragSnapshot | null => {
    const content = timelineContentRef.current;
    const stripEl = stripRef.current;
    if (!content || !stripEl) return null;

    const stripRect = stripEl.getBoundingClientRect();
    return {
      anchors: buildBlockAnchors(content, segments),
      contentHeight: content.getBoundingClientRect().height,
      stripHeight: stripRect.height,
      stripTop: stripRect.top,
      headerBottomPx: topOffsetPx,
      span,
      visibleSpan: viewport ? viewport.endMin - viewport.startMin : 0,
      pointerId: -1,
      pointerOffsetY: 0,
    };
  }, [timelineContentRef, segments, span, viewport, topOffsetPx]);

  // ── Scroll helpers (drag / click / keyboard all funnel through this) ─────

  /**
   * Scroll so the visible minute range starts at `targetViewportStartMin`.
   * Uses the snapshot's anchors for the minute→pixel conversion (so the
   * result matches where the block cards actually live in the DOM).
   */
  const scrollToMinute = useCallback(
    (targetViewportStartMin: number, snapshot: DragSnapshot, smooth: boolean) => {
      const visibleSpanMin = snapshot.visibleSpan;
      if (visibleSpanMin <= 0) return;
      const clamped = Math.max(
        0,
        Math.min(snapshot.span - visibleSpanMin, targetViewportStartMin),
      );
      const pixel = pixelAtMinute(clamped, snapshot.anchors, snapshot.contentHeight);
      const scrollY = pixel - snapshot.headerBottomPx;
      window.scrollTo({ top: Math.max(0, scrollY), behavior: smooth ? 'smooth' : 'auto' });
    },
    [],
  );

  // ── Window-level drag fallback (fix for stuck-drag) ─────────────────────────
  // When setPointerCapture is refused (some touch pointers / cross-origin
  // iframes) or the captured target is removed mid-drag, the indicator's own
  // pointerup/pointercancel won't fire and `isDragging` would stay true
  // forever. The handlers below match the pointerId in dragSnapshotRef and
  // run the same finishDrag logic. They are registered at pointerdown (and
  // torn down at pointerup/cancel/unmount).
  const windowDragFallbackRef = useRef<{
    pointerup: (e: PointerEvent) => void;
    pointercancel: (e: PointerEvent) => void;
  } | null>(null);
  const tearDownWindowDragFallback = useCallback(() => {
    const handles = windowDragFallbackRef.current;
    if (!handles) return;
    window.removeEventListener('pointerup', handles.pointerup);
    window.removeEventListener('pointercancel', handles.pointercancel);
    windowDragFallbackRef.current = null;
  }, []);

  const finishDrag = useCallback(
    (e?: ReactPointerEvent<HTMLDivElement> | null) => {
      const snapshot = dragSnapshotRef.current;
      const pointerId = e?.pointerId ?? snapshot?.pointerId;
      if (snapshot && pointerId !== undefined && snapshot.pointerId === pointerId) {
        if (e?.currentTarget) {
          try {
            e.currentTarget.releasePointerCapture(pointerId);
          } catch {
            // ignore
          }
        }
        dragSnapshotRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      latestTargetMinRef.current = null;
      tearDownWindowDragFallback();
      setIsDragging(false);
    },
    [tearDownWindowDragFallback],
  );

  const ensureWindowDragFallback = useCallback(() => {
    if (windowDragFallbackRef.current) return;
    const pointerup = (e: PointerEvent) => {
      const snap = dragSnapshotRef.current;
      if (snap && e.pointerId === snap.pointerId) finishDrag();
    };
    const pointercancel = (e: PointerEvent) => {
      const snap = dragSnapshotRef.current;
      if (snap && e.pointerId === snap.pointerId) finishDrag();
    };
    window.addEventListener('pointerup', pointerup);
    window.addEventListener('pointercancel', pointercancel);
    windowDragFallbackRef.current = { pointerup, pointercancel };
  }, [finishDrag]);

  // Always clean up on unmount so a pending drag-scroll doesn't fire after the
  // component is gone (would otherwise call window.scrollTo) and a stuck drag
  // doesn't outlive the component.
  useEffect(
    () => () => {
      tearDownWindowDragFallback();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    },
    [tearDownWindowDragFallback],
  );

  if (!hasRenderableSegments(segments)) return null;

  const topPx = Math.max(0, topOffsetPx + STRIP_GAP_PX);
  // Hoisted out of the map loop — also used for tooltip time labels.
  const sessionStartMin = startTime ? timeToMinutes(startTime) : 0;

  // Indicator: only when the visible minute range is strictly smaller than
  // the total span (otherwise the session fits entirely in the viewport).
  const visibleSpan =
    viewport && viewport.endMin > viewport.startMin
      ? viewport.endMin - viewport.startMin
      : 0;
  const showIndicator =
    !!viewport && visibleSpan > 0 && visibleSpan < span;

  const indicatorTopPct = showIndicator
    ? clampPct((viewport.startMin / span) * 100)
    : 0;
  const indicatorHeightPct = showIndicator
    ? clampPct(((viewport.endMin - viewport.startMin) / span) * 100)
    : 0;

  // Live Mode "current position" marker. Independent of the viewport
  // indicator: always rendered when live mode has a determinable minute,
  // regardless of the auto-hide state of the scroll indicator. The line is
  // clamped to [0, span] so a session that has been extended past the plan
  // sticks to the track bottom rather than disappearing.
  const showLiveLine =
    liveCurrentMinute !== null &&
    Number.isFinite(liveCurrentMinute) &&
    liveCurrentMinute >= 0 &&
    span > 0;
  const liveLineTopPct = showLiveLine
    ? clampPct((Math.min(liveCurrentMinute!, span) / span) * 100)
    : 0;

  // Slider aria-value text: describes the current value, not static help.
  // The help text lives in `title` (and `aria-description` if supported) so
  // screen readers learn the gesture vocabulary without it being read aloud
  // every time the value changes.
  const indicatorValueText = showIndicator
    ? t('timeStrip.indicatorValue', {
        start: formatMinAsHHMM(sessionStartMin + viewport!.startMin),
        end: formatMinAsHHMM(sessionStartMin + viewport!.endMin),
      })
    : undefined;

  // ── Indicator drag (vertical, exact-follow) ────────────────────────────────

  const handleIndicatorPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!indicatorRef.current) return;
    const snap = measure();
    if (!snap) return;
    const boxRect = indicatorRef.current.getBoundingClientRect();
    dragSnapshotRef.current = {
      ...snap,
      pointerId: e.pointerId,
      pointerOffsetY: e.clientY - boxRect.top,
    };
    latestTargetMinRef.current = null;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture for touch pointers — fall back to the
      // window-level listeners registered below.
    }
    // Always register the window-level fallback listeners. They're cheap
    // (passive + a one-shot guard) and guarantee isDragging can never get
    // stuck if `setPointerCapture` is refused (e.g. on some touch pointers or
    // in iframes) or if the element is unmounted mid-drag.
    ensureWindowDragFallback();
    setIsDragging(true);
    e.preventDefault();
  };

  const handleIndicatorPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const snapshot = dragSnapshotRef.current;
    if (!snapshot || snapshot.pointerId !== e.pointerId) return;
    if (snapshot.stripHeight <= 0) return;

    // Exact-follow: keep the pointer at the same offset within the box.
    const newIndicatorTopStripY = e.clientY - snapshot.pointerOffsetY - snapshot.stripTop;
    const targetViewportStartMin =
      (newIndicatorTopStripY / snapshot.stripHeight) * snapshot.span;
    // Publish the latest target into a ref; the rAF reads from it so a
    // burst of pointermove events collapses into the most-recent position
    // (not the first one captured by the closure).
    latestTargetMinRef.current = targetViewportStartMin;

    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const snap = dragSnapshotRef.current;
      const target = latestTargetMinRef.current;
      if (snap && target !== null) scrollToMinute(target, snap, false);
    });
  };

  const handleIndicatorPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    finishDrag(e);
  };

  const handleIndicatorPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    finishDrag(e);
  };

  // ── Track click (centers the visible range on the clicked minute) ──────────

  const handleTrackClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // Ignore clicks that originated on the indicator box — it handles its own
    // drag interactions and a plain click on it shouldn't double-scroll.
    // Clicks on SEGMENTS are wanted: the segments tile the track seamlessly,
    // so without this the track would be almost entirely unclickable.
    const target = e.target as Node | null;
    if (target && indicatorRef.current?.contains(target)) return;
    const snap = measure();
    if (!snap || snap.stripHeight <= 0 || snap.visibleSpan <= 0) return;

    const clickY = e.clientY - snap.stripTop;
    const targetMin = (clickY / snap.stripHeight) * snap.span;
    const targetViewportStartMin = targetMin - snap.visibleSpan / 2;
    scrollToMinute(targetViewportStartMin, snap, true);
  };

  // ── Keyboard (slider semantics) ───────────────────────────────────────────

  const handleIndicatorKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!viewport) return;
    const snap = measure();
    if (!snap || snap.visibleSpan <= 0) return;

    let next = viewport.startMin;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next += ARROW_STEP_MIN;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next -= ARROW_STEP_MIN;
        break;
      case 'PageDown':
        next += PAGE_STEP_MIN;
        break;
      case 'PageUp':
        next -= PAGE_STEP_MIN;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = snap.span - snap.visibleSpan;
        break;
      default:
        return;
    }
    e.preventDefault();
    scrollToMinute(next, snap, true);
  };

  // Tooltip suppression: while dragging, push the delay way out so they
  // never appear during a fast pointer drag.
  const tooltipDelay = isDragging ? TOOLTIP_SUPPRESS_DELAY_MS : 150;
  const tooltipSkipDelay = isDragging ? TOOLTIP_SUPPRESS_DELAY_MS : 100;

  return (
    <TooltipProvider delayDuration={tooltipDelay} skipDelayDuration={tooltipSkipDelay}>
      <div
        ref={stripRef}
        data-testid="time-visualization-strip"
        role="figure"
        aria-label={t('timeStrip.ariaLabel')}
        className={cn(
          // right-4 keeps the strip clear of classic ~17px scrollbars (macOS
          // overlay scrollbars are auto-hidden anyway).
          'fixed right-4 z-20 hidden lg:block print:hidden',
          'pointer-events-none',
          'flex flex-col items-center justify-end',
        )}
        style={{ top: topPx, bottom: BOTTOM_OFFSET_PX, width: 10 }}
      >
        {/* The slider lives at the track level (sibling of the segments
            list) so role="slider" is not nested inside role="list". The
            segments wrapper below owns the list semantics. */}
        {showIndicator && (
          <div
            ref={indicatorRef}
            data-testid="time-visualization-viewport-indicator"
            role="slider"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={t('timeStrip.indicatorLabel')}
            aria-valuemin={0}
            aria-valuemax={Math.round(span)}
            aria-valuenow={Math.round(viewport.startMin)}
            aria-valuetext={indicatorValueText}
            title={t('timeStrip.indicatorHelp')}
            className={cn(
              'absolute left-0 right-0 -ml-8 z-10',
              'bg-foreground/5 border-t border-b border-border/50 rounded-l-lg',
              'select-none pointer-events-none',
              'transition-opacity duration-300',
              // Auto-hide: faded out when idle; hovering the track brings
              // it back.
              !indicatorVisible && 'opacity-0',
            )}
            style={{
              top: `${indicatorTopPct}%`,
              height: `${indicatorHeightPct}%`,
            }}
            onFocus={() => setTrackFocused(true)}
            onBlur={() => setTrackFocused(false)}
            onKeyDown={handleIndicatorKeyDown}
          >
            {/* Drag handle — covers the box's left overhang (the 32px that
                stick out to the left of the track, thanks to -ml-8). The
                track-area part of the box stays pointer-transparent so the
                segments underneath remain hoverable. */}
            <div
              data-testid="time-visualization-indicator-handle"
              className={cn(
                'absolute left-0 inset-y-0 w-8 rounded-l-lg',
                'pointer-events-auto',
                'cursor-grab',
                isDragging && 'cursor-grabbing',
              )}
              style={{ touchAction: 'none' }}
              onPointerEnter={() => setTrackHovered(true)}
              onPointerLeave={() => setTrackHovered(false)}
              onPointerDown={handleIndicatorPointerDown}
              onPointerMove={handleIndicatorPointerMove}
              onPointerUp={handleIndicatorPointerUp}
              onPointerCancel={handleIndicatorPointerCancel}
            />
          </div>
        )}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          onPointerEnter={() => setTrackHovered(true)}
          onPointerLeave={() => setTrackHovered(false)}
          className={cn(
            'relative w-2.5 rounded-full bg-muted/40 border border-border/60',
            'pointer-events-auto',
            'h-full min-h-[80px]',
            'cursor-pointer',
            '',
          )}
        >
          <div role="list" className="absolute inset-0">
            {segments.map((seg) => {
              // Clamp visual position to [0, 100] — a fixedStartTime earlier than
              // the session start yields a negative offset, which would otherwise
              // paint above the track. overflow-hidden is a belt-and-suspenders
              // guard.
              const topPct = clampPct((seg.startMin / span) * 100);
              const heightPct = clampPct(((seg.endMin - seg.startMin) / span) * 100);

              // Group segments are a decorative background box behind
              // the track — they don't carry tooltips and don't intercept
              // pointer events (track clicks bubble through to the parent
              // track click handler, which scrolls the page). They do
              // participate in the cross-highlight: hovering the group's
              // card in the timeline brightens the line here.
              if (seg.kind === 'group') {
                const isGroupHighlighted = hoveredId === seg.id;
                return (
                  <div
                    key={seg.id}
                    role="listitem"
                    data-testid="time-visualization-group-line"
                    aria-hidden
                    className={cn(
                      'absolute right-0 -mx-1 w-4 rounded-full pointer-events-none -z-10',
                      'bg-block-group/30 transition-colors',
                      isGroupHighlighted && 'bg-block-group/70',
                    )}
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                    }}
                  />
                );
              }

              const wallStart = sessionStartMin + seg.startMin;
              const wallEnd = sessionStartMin + seg.endMin;
              const isBreakout = seg.kind === 'breakout';
              const isHighlighted = hoveredId === seg.id;
              const label = `${seg.title || t('timeStrip.untitled')}, ${formatMinAsHHMM(wallStart)}–${formatMinAsHHMM(wallEnd)}${
                isBreakout ? ` (${t('timeStrip.breakout')})` : ''
              }`;
              return (
                <Tooltip key={seg.id}>
                  <TooltipTrigger asChild>
                    <div
                      role="listitem"
                      aria-label={label}
                      // Inline pointer handlers — coexist fine with Radix's
                      // hover-based Tooltip trigger (Radix uses pointermove/
                      // pointerleave which don't conflict with pointerenter).
                      onPointerEnter={() => setHoveredItem(seg.id, 'strip')}
                      onPointerLeave={() => {
                        if (getHoveredItemId() === seg.id) setHoveredItem(null, null);
                      }}
                      className={cn(
                        'absolute left-0 right-0 rounded-sm',
                        // Highlighted segments stay full-opacity even when the
                        // pointer is elsewhere; otherwise the usual
                        // dim-by-default, brighten-on-hover pattern.
                        isHighlighted
                          ? 'opacity-100'
                          : 'opacity-75 hover:opacity-100 transition-opacity',
                        isBreakout && 'time-strip-segment--breakout',
                        isHighlighted && 'time-strip-segment--highlight',
                      )}
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        // Plain blocks use the resolved block type color;
                        // breakouts let CSS draw the stripes via the
                        // .time-strip-segment--breakout class (--strip-color
                        // passes the per-segment color into the pattern).
                        backgroundColor: isBreakout ? undefined : seg.color,
                        ...(isBreakout ? ({ '--strip-color': seg.color } as CSSProperties) : null),
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8} className="text-xs">
                    <div className="font-medium">
                      {seg.title || t('timeStrip.untitled')}
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      {formatMinAsHHMM(wallStart)}–{formatMinAsHHMM(wallEnd)}
                      {isBreakout ? ` · ${t('timeStrip.breakout')}` : ''}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* Live Mode "current position" line — a thin blue marker that
                travels vertically with the running session. Rendered last and
                given z-20 so it sits above both the segments and the auto-
                hiding scroll indicator (z-10). pointer-events-none so it
                doesn't block segment tooltips or track clicks. */}
            {showLiveLine && (
              <div
                data-testid="time-visualization-live-line"
                aria-hidden
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20',
                  'w-8 h-0.5 rounded-full bg-primary pointer-events-none',
                )}
                style={{
                  top: `${liveLineTopPct}%`,
                  boxShadow:
                    '0 0 4px hsl(var(--primary) / 0.65), 0 0 1px hsl(var(--primary) / 0.9)',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

/** Clamp a percentage value (allowing sub-100 plus the 0 floor). */
function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

export default TimeVisualizationStrip;