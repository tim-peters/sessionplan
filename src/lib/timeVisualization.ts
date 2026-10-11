/**
 * timeVisualization — Pure derivation of the TimeVisualizationStrip track.
 *
 * Maps the workshop item tree to a small, render-ready list of segments
 * (block / breakout) whose start/end times are wall-clock minutes since the
 * session start. Gap-preserving (fixedStartTime jumps render as empty track
 * because we omit the in-between offsets).
 *
 * Also provides the pure piecewise linear mapping between timeline pixel
 * space and minute space — consumed by the viewport indicator on the strip.
 *
 * Role: pure utility — no React, no DOM. Called by both the React component
 *       and the unit tests.
 * Used by: src/modules/planner/TimeVisualizationStrip.tsx,
 *         src/hooks/useTimelineViewport.ts,
 *         src/test/timeVisualization.test.ts
 */
import { WorkshopItem, BlockType } from '@/types/workshop';
import { timeToMinutes } from '@/lib/playModeUtils';

export type SegmentKind = 'block' | 'breakout' | 'group';

/** Render-ready segment for the visualization strip. */
export interface Segment {
  /** WorkshopItem id. */
  id: string;
  /** Display title (used for tooltip). */
  title: string;
  /** Start in minutes since the session's startTime. May be negative when an
   *  item has fixedStartTime earlier than the session start. The strip
   *  component is responsible for clamping visual position. */
  startMin: number;
  /** End in minutes since the session's startTime. */
  endMin: number;
  /** BlockType id, or null if the item has no block type. */
  blockTypeId: string | null;
  /** Resolved hex color (from the matching BlockType), or a fallback. */
  color: string;
  /** Container breakout vs. plain block (rendering hint). */
  kind: SegmentKind;
}

/** Neutral fallback color for blocks/groups that have no blockType set. */
const NEUTRAL_COLOR = '#9CA3AF';

/** Fallback color for breakouts that have no blockTypeId. Matches the app's
 *  breakout pink (same hue/family as `--block-breakout` in src/index.css). */
const BREAKOUT_FALLBACK_COLOR = 'hsl(330 81% 60%)';

/**
 * Walks the workshop item tree once and returns a Map<id, blockTypeId>.
 * Used to enrich items (the Strip model is intentionally decoupled from
 * FlatBlock, which doesn't carry blockTypeId).
 */
function buildBlockTypeIdIndex(items: WorkshopItem[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const walk = (list: WorkshopItem[]) => {
    for (const it of list) {
      out.set(it.id, it.blockTypeId);
      if (it.children) walk(it.children);
    }
  };
  walk(items);
  return out;
}

function makeSegment(
  item: WorkshopItem,
  startMin: number,
  endMin: number,
  blockTypeIdByItemId: Map<string, string | null>,
  colorByBlockTypeId: Map<string, string>,
): Segment {
  const blockTypeId = blockTypeIdByItemId.get(item.id) ?? null;
  // Breakouts without a blockTypeId fall back to the app's breakout pink; all
  // other items fall back to a neutral gray.
  const fallback =
    item.type === 'breakout' ? BREAKOUT_FALLBACK_COLOR : NEUTRAL_COLOR;
  const color =
    (blockTypeId ? colorByBlockTypeId.get(blockTypeId) : undefined) ?? fallback;
  const kind: SegmentKind =
    item.type === 'breakout' ? 'breakout' : item.type === 'group' ? 'group' : 'block';
  return {
    id: item.id,
    title: item.title,
    startMin,
    endMin,
    blockTypeId,
    color,
    kind,
  };
}

interface WalkResult {
  /** Offset to use for the next sibling after this group/list. */
  finalOffsetMin: number;
  /** Wall-clock end (max endMin) observed inside this subtree — used so a
   *  group's effective wall-clock span covers children that jumped past their
   *  parent's declared duration via fixedStartTime. */
  maxEndMin: number;
}

/**
 * Recursively walks a list of items, emitting Segments and tracking offsets.
 *
 * Semantics intentionally differ from `flattenTimeline` (which is used by Live
 * Mode and doesn't recurse into nested groups):
 *  - Blocks at any depth are emitted as their own segment.
 *  - Groups ARE emitted as a decorative 'group' segment AND the walker
 *    recurses into their children. The group's end spans the union of its
 *    declared duration and any wall-clock jumps its children made via
 *    fixedStartTime. Nested groups are emitted at every level — no
 *    deduplication.
 *  - Breakouts are emitted as ONE segment; their lane children share the
 *    span and are skipped.
 *  - fixedStartTime jumps the running offset to an absolute wall-clock value
 *    relative to sessionStartMin.
 */
function walkItems(
  items: WorkshopItem[],
  startOffsetMin: number,
  sessionStartMin: number | undefined,
  blockTypeIdByItemId: Map<string, string | null>,
  colorByBlockTypeId: Map<string, string>,
  result: Segment[],
): WalkResult {
  let offset = startOffsetMin;
  let maxEnd = startOffsetMin;

  for (const item of items) {
    // Snap to a fixed start time if set. The offset is the wall-clock minutes
    // since the session start, so a fixedStartTime before the session yields
    // a negative offset (the strip will clamp visual position).
    if (item.fixedStartTime && sessionStartMin !== undefined) {
      offset = timeToMinutes(item.fixedStartTime) - sessionStartMin;
    }

    const itemStart = offset;

    if (item.type === 'group') {
      // Children first, then the group segment itself. Order in the result
      // list is purely cosmetic (rendering uses absolute positions), so this
      // is fine.
      const childResult = walkItems(
        item.children ?? [],
        itemStart,
        sessionStartMin,
        blockTypeIdByItemId,
        colorByBlockTypeId,
        result,
      );
      // Outer offset advances by the group's declared duration (sum of child
      // durations), matching flattenTimeline's group semantics. Wall-clock
      // jumps inside the group are surfaced via childResult.maxEndMin.
      const groupDuration = (item.children ?? []).reduce((sum, c) => sum + c.duration, 0);
      const groupEnd = itemStart + groupDuration;
      offset = groupEnd;
      // Group span: at least the declared duration; extended to cover any
      // child fixedStartTime jumps past it.
      const groupSpanEnd = Math.max(childResult.maxEndMin, groupEnd);
      result.push(makeSegment(item, itemStart, groupSpanEnd, blockTypeIdByItemId, colorByBlockTypeId));
      if (groupSpanEnd > maxEnd) maxEnd = groupSpanEnd;
    } else if (item.type === 'breakout') {
      const itemEnd = itemStart + item.duration;
      result.push(makeSegment(item, itemStart, itemEnd, blockTypeIdByItemId, colorByBlockTypeId));
      offset = itemEnd;
      if (itemEnd > maxEnd) maxEnd = itemEnd;
      // Children of a breakout share the span — don't recurse into them.
    } else {
      const itemEnd = itemStart + item.duration;
      result.push(makeSegment(item, itemStart, itemEnd, blockTypeIdByItemId, colorByBlockTypeId));
      offset = itemEnd;
      if (itemEnd > maxEnd) maxEnd = itemEnd;
    }
  }

  return { finalOffsetMin: offset, maxEndMin: maxEnd };
}

/**
 * Filter rules for the strip:
 *
 *  - Top-level blocks                     → include.
 *  - Top-level breakouts                  → include as ONE segment (parallel lanes share the span).
 *  - Groups (any depth)                   → include as a decorative line segment;
 *                                           their children are also included.
 *  - Children of a breakout (lanes)       → NOT rendered (shared span).
 *  - Zero-duration segments               → skipped.
 */
export function computeSegments(
  items: WorkshopItem[],
  startTime: string | null,
  blockTypes: BlockType[],
): Segment[] {
  if (items.length === 0) return [];

  // Only pass sessionStartMin when the workshop has a start time. Using `||`
  // here would treat '00:00' (== 0 min) as "unset" and silently disable
  // fixedStartTime snapping.
  const sessionStartMin = startTime ? timeToMinutes(startTime) : undefined;

  const blockTypeIdByItemId = buildBlockTypeIdIndex(items);
  const colorByBlockTypeId = new Map(blockTypes.map((bt) => [bt.id, bt.color]));

  const result: Segment[] = [];
  walkItems(items, 0, sessionStartMin, blockTypeIdByItemId, colorByBlockTypeId, result);

  return result.filter((s) => s.endMin > s.startMin);
}

/** Total wall-clock span of the segments (0 → max endMin). Returns 0 when empty. */
export function computeTotalSpanMin(segments: Segment[]): number {
  if (segments.length === 0) return 0;
  let max = 0;
  for (const s of segments) if (s.endMin > max) max = s.endMin;
  return max;
}

/** Has at least one segment with positive duration? */
export function hasRenderableSegments(segments: Segment[]): boolean {
  return segments.some((s) => s.endMin > s.startMin);
}

/**
 * Format absolute minutes (since 00:00) as a "HH:MM" string for tooltips.
 * The hour component is wrapped modulo 24 — sessions that cross midnight
 * roll over. We accept this as the simpler, less-surprising behaviour.
 */
export function formatMinAsHHMM(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Resolve the "current minute" of a running Live Mode session for the time-
 * visualization strip. Returns `null` whenever the position isn't meaningful
 * (Live Mode off, elapsed not yet known, or value isn't finite).
 *
 * The minute is computed from the elapsed minutes since the session started
 * — the same number `usePlayMode` already tracks. This works in all
 * situations, including between blocks during a `fixedStartTime` gap where
 * the active block is undefined but the session is still advancing.
 *
 * Negative values are clamped to 0; positive values are returned as-is so
 * the caller can clamp them to the strip's total span (Live Mode can run
 * past the planned span via the "extend +5 min" button).
 */
export function computeLiveCurrentMinute(input: {
  isActive: boolean;
  elapsedMinutes: number | null;
}): number | null {
  if (!input.isActive) return null;
  if (input.elapsedMinutes === null) return null;
  if (!Number.isFinite(input.elapsedMinutes)) return null;
  return Math.max(0, input.elapsedMinutes);
}

// ── Viewport indicator: piecewise linear pixel ↔ minute mapping ─────────────

/**
 * A timeline block's vertical anchor in pixel + minute space.
 *
 * `topPx` / `bottomPx` are measured relative to the timeline content root
 * (NOT the viewport). `startMin` / `endMin` come straight from `Segment`.
 */
export interface BlockAnchor {
  id: string;
  topPx: number;
  bottomPx: number;
  startMin: number;
  endMin: number;
}

/**
 * Result of mapping a visible pixel range into minute space.
 * `endMin >= startMin` and both are clamped to `[0, spanMin]`.
 */
export interface VisibleRange {
  startMin: number;
  endMin: number;
}

/**
 * Find the minute value at a given Y pixel (relative to the timeline content
 * root). Uses piecewise linear interpolation across the anchor list.
 *
 *  - Y ≤ first anchor's top  → extrapolate from (0, 0) to (first.topPx, first.startMin).
 *  - Y ≥ last anchor's bottom → extrapolate using the last anchor's px-per-minute rate.
 *  - Within an anchor         → linear from (topPx, startMin) to (bottomPx, endMin).
 *  - Between anchors          → linear from (prev.endMin) to (next.startMin).
 *  - Empty anchors            → 0.
 *  - Degenerate anchor (zero height AND zero duration) → returns its startMin.
 */
export function minuteAtPixel(Y: number, anchors: BlockAnchor[]): number {
  if (anchors.length === 0) return 0;

  const sorted = [...anchors].sort((a, b) => a.topPx - b.topPx);

  const first = sorted[0];
  if (Y <= first.topPx) {
    if (first.topPx <= 0) return first.startMin;
    return (Y / first.topPx) * first.startMin;
  }

  const last = sorted[sorted.length - 1];
  if (Y >= last.bottomPx) {
    const heightPx = last.bottomPx - last.topPx;
    const durationMin = last.endMin - last.startMin;
    // Degenerate anchor (zero or negative size): fall back to a stable value
    // instead of dividing by ~0 and producing huge minute numbers.
    if (heightPx <= 0 || durationMin <= 0) {
      return last.endMin;
    }
    const pxPerMin = heightPx / durationMin;
    // Cap the rate from below to avoid pathological extrapolation when the
    // anchor's height and duration are both very small.
    const safeRate = Math.max(pxPerMin, 0.001);
    return last.endMin + (Y - last.bottomPx) / safeRate;
  }

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (Y >= a.topPx && Y <= a.bottomPx) {
      const pxRange = Math.max(1, a.bottomPx - a.topPx);
      const t = (Y - a.topPx) / pxRange;
      return a.startMin + t * (a.endMin - a.startMin);
    }
    const next = sorted[i + 1];
    if (next && Y > a.bottomPx && Y < next.topPx) {
      const pxRange = Math.max(1, next.topPx - a.bottomPx);
      const t = (Y - a.bottomPx) / pxRange;
      return a.endMin + t * (next.startMin - a.endMin);
    }
  }

  return 0;
}

/**
 * Given a visible pixel range (top/bottom relative to the content root) and
 * the total wall-clock span, return the visible minute range. Returns null
 * when there's nothing visible (e.g. the viewport is entirely above or below
 * the content) or when no anchors are available.
 *
 * The result is clamped to `[0, spanMin]` and normalized so that
 * `endMin >= startMin` regardless of which edge sits higher in the viewport.
 */
export function computeVisibleRange(
  anchors: BlockAnchor[],
  visibleTopPx: number,
  visibleBottomPx: number,
  spanMin: number,
): VisibleRange | null {
  // Normalize first so callers can pass the edges in either order.
  const lo = Math.min(visibleTopPx, visibleBottomPx);
  const hi = Math.max(visibleTopPx, visibleBottomPx);
  if (hi <= lo) return null;
  if (anchors.length === 0) return null;

  const rawStart = minuteAtPixel(lo, anchors);
  const rawEnd = minuteAtPixel(hi, anchors);
  const clampedLo = Math.max(0, Math.min(spanMin, Math.min(rawStart, rawEnd)));
  const clampedHi = Math.max(0, Math.min(spanMin, Math.max(rawStart, rawEnd)));
  return { startMin: clampedLo, endMin: clampedHi };
}

/**
 * Inverse of `minuteAtPixel`: given a minute value, return the corresponding
 * pixel Y (relative to the timeline content root).
 *
 * Mirrors the same piecewise linear mapping:
 *  - m ≤ first anchor's startMin  → extrapolate from (0, 0) to (first.topPx, first.startMin).
 *  - m ≥ last anchor's endMin     → extrapolate using the last anchor's px-per-minute rate.
 *  - Within an anchor             → linear from (topPx, startMin) to (bottomPx, endMin).
 *  - Between anchors              → linear from (a.endMin → a.bottomPx) to (next.startMin → next.topPx).
 *  - Empty anchors                → 0.
 *  - Degenerate anchor (zero height AND zero duration) → returns the anchor's bottomPx (clamped to contentHeight).
 *
 * Negative `m` is clamped to 0; positive `m` is allowed to extrapolate past
 * the last anchor. The returned pixel is capped at `contentHeight` so callers
 * can keep the result inside the scrollable content.
 */
export function pixelAtMinute(
  m: number,
  anchors: BlockAnchor[],
  contentHeight: number,
): number {
  if (anchors.length === 0) return 0;

  const sorted = [...anchors].sort((a, b) => a.topPx - b.topPx);
  m = Math.max(0, m);

  const first = sorted[0];
  if (m <= first.startMin) {
    if (first.startMin <= 0) return first.topPx;
    return (m / first.startMin) * first.topPx;
  }

  const last = sorted[sorted.length - 1];
  if (m >= last.endMin) {
    const heightPx = last.bottomPx - last.topPx;
    const durationMin = last.endMin - last.startMin;
    if (heightPx <= 0 || durationMin <= 0) {
      return Math.min(contentHeight, last.bottomPx);
    }
    const pxPerMin = heightPx / durationMin;
    return Math.min(contentHeight, last.bottomPx + (m - last.endMin) * pxPerMin);
  }

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (m >= a.startMin && m <= a.endMin) {
      const minRange = Math.max(0.0001, a.endMin - a.startMin);
      const t = (m - a.startMin) / minRange;
      return a.topPx + t * (a.bottomPx - a.topPx);
    }
    const next = sorted[i + 1];
    if (next && m > a.endMin && m < next.startMin) {
      const minRange = Math.max(0.0001, next.startMin - a.endMin);
      const t = (m - a.endMin) / minRange;
      return a.bottomPx + t * (next.topPx - a.bottomPx);
    }
  }

  return 0;
}

// ── DOM helpers ────────────────────────────────────────────────────────────────

/**
 * Walk the timeline content root once and build a `BlockAnchor[]` for every
 * `[data-item-id]` descendant whose id appears in `segments`. Used by both
 * `useTimelineViewport` (to compute the visible minute range) and
 * `TimeVisualizationStrip` (to build a one-shot layout snapshot on drag/
 * click/keyboard). Centralizing avoids the duplicated querySelector loop.
 */
export function buildBlockAnchors(
  content: HTMLElement,
  segments: Segment[],
): BlockAnchor[] {
  const cards = content.querySelectorAll<HTMLElement>('[data-item-id]');
  if (cards.length === 0 || segments.length === 0) return [];

  const segById = new Map(segments.map((s) => [s.id, s]));
  const contentRect = content.getBoundingClientRect();
  const anchors: BlockAnchor[] = [];
  for (const card of cards) {
    const id = card.dataset.itemId;
    if (!id) continue;
    const seg = segById.get(id);
    if (!seg) continue;
    const rect = card.getBoundingClientRect();
    anchors.push({
      id,
      topPx: rect.top - contentRect.top,
      bottomPx: rect.bottom - contentRect.top,
      startMin: seg.startMin,
      endMin: seg.endMin,
    });
  }
  return anchors;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

/** Hex color matcher — accepts `#rgb` (3-digit) and `#rrggbb` (6-digit). */
const HEX_COLOR_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Parse a 3-digit hex (#abc → #aabbcc) to a 6-digit hex string. */
const expandShortHex = (s: string): string => {
  const r = s[0];
  const g = s[1];
  const b = s[2];
  return r + r + g + g + b + b;
};