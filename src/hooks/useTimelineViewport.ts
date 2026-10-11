/**
 * useTimelineViewport — Track which portion of the workshop timeline is
 * currently visible in the viewport.
 *
 * Role: Used by `TimeVisualizationStrip` to render a viewport indicator on
 *       the time track. The page scrolls with the window (no inner overflow
 *       container in the planner), so we listen to `window.scroll` and
 *       `window.resize`, plus a `ResizeObserver` on the content root for
 *       layout-driven size changes. All work is batched in a single rAF to
 *       avoid layout thrash.
 *
 * Returns `null` while the content isn't attached or when there's no
 * measurable visible range (e.g. the content is entirely above/below the
 * viewport).
 */
import { useEffect, useState, type RefObject } from 'react';
import {
  buildBlockAnchors,
  computeVisibleRange,
  type Segment,
  type VisibleRange,
} from '@/lib/timeVisualization';

interface UseTimelineViewportOpts {
  /** Ref to the timeline content root (the wrapper around <Timeline />). */
  contentRef: RefObject<HTMLElement | null>;
  /** Strip segments; used to filter which `[data-item-id]` elements are anchors. */
  segments: Segment[];
  /** Bottom edge of the sticky planner chrome (px, viewport-relative). */
  headerBottomPx: number;
}

export function useTimelineViewport({
  contentRef,
  segments,
  headerBottomPx,
}: UseTimelineViewportOpts): VisibleRange | null {
  const [range, setRange] = useState<VisibleRange | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let spanMin = 0;
    for (const s of segments) if (s.endMin > spanMin) spanMin = s.endMin;

    let rafId: number | null = null;
    const schedule = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        recompute();
      });
    };

    const recompute = () => {
      // Read all layout in one batch — no writes between reads.
      const contentRect = content.getBoundingClientRect();
      const anchors = buildBlockAnchors(content, segments);

      const viewportBottom = window.innerHeight;
      const visibleTopInViewport = Math.max(contentRect.top, headerBottomPx);
      const visibleBottomInViewport = Math.min(contentRect.bottom, viewportBottom);

      const relTop = visibleTopInViewport - contentRect.top;
      const relBottom = visibleBottomInViewport - contentRect.top;

      if (relBottom <= relTop || visibleBottomInViewport <= visibleTopInViewport) {
        setRange((prev) => (prev === null ? prev : null));
        return;
      }

      const result = computeVisibleRange(anchors, relTop, relBottom, spanMin);
      // Bail out when the visible range hasn't changed — scroll events fire
      // every animation frame, but the visible window only shifts when the
      // user actually scrolls past a boundary. This keeps React from
      // re-rendering the strip on every scroll frame.
      setRange((prev) => {
        if (!prev && !result) return prev;
        if (prev && result && prev.startMin === result.startMin && prev.endMin === result.endMin) {
          return prev;
        }
        return result;
      });
    };

    // Initial paint
    schedule();

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(content);
    }

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (ro) ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [contentRef, segments, headerBottomPx]);

  return range;
}