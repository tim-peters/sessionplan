import { describe, it, expect } from 'vitest';
import {
  buildBlockAnchors,
  computeLiveCurrentMinute,
  computeSegments,
  computeTotalSpanMin,
  computeVisibleRange,
  formatMinAsHHMM,
  hasRenderableSegments,
  minuteAtPixel,
  pixelAtMinute,
  type BlockAnchor,
} from '@/lib/timeVisualization';
import { makeBlock, makeGroup, makeBreakout, makeWorkshop } from './test-helpers';

const BLOCK_TYPES = [
  { id: 'input', name: 'Input', color: '#2C8DFE' },
  { id: 'break', name: 'Pause', color: '#6B7280' },
];

const withType = (id: string, blockTypeId: string | null, extra: Partial<ReturnType<typeof makeBlock>> = {}) =>
  makeBlock({ id, blockTypeId, ...extra });

describe('computeSegments', () => {
  it('returns an empty list for no items', () => {
    expect(computeSegments([], '10:00', BLOCK_TYPES)).toEqual([]);
  });

  it('returns an empty list when all items have zero duration', () => {
    const items = [withType('b1', 'input', { duration: 0 })];
    expect(computeSegments(items, '10:00', BLOCK_TYPES)).toEqual([]);
  });

  it('emits one segment per top-level block with the resolved block type color', () => {
    const items = [
      withType('b1', 'input', { duration: 10, title: 'Welcome' }),
      withType('b2', null, { duration: 5, title: 'Empty block' }),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({
      id: 'b1',
      title: 'Welcome',
      startMin: 0,
      endMin: 10,
      blockTypeId: 'input',
      color: '#2C8DFE',
      kind: 'block',
    });
    // No blockTypeId → falls back to neutral color
    expect(segs[1]).toMatchObject({
      id: 'b2',
      blockTypeId: null,
      color: '#9CA3AF',
    });
  });

  it('preserves gaps created by fixedStartTime (empty track between segments)', () => {
    const items = [
      withType('a', null, { duration: 10, title: 'A' }),
      withType('b', null, { duration: 5, fixedStartTime: '10:30', title: 'B' }),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs).toHaveLength(2);
    // Item B has fixedStartTime 10:30 = session-relative offset 30; gap of 20 min.
    expect(segs[0].startMin).toBe(0);
    expect(segs[0].endMin).toBe(10);
    expect(segs[1].startMin).toBe(30);
    expect(segs[1].endMin).toBe(35);
    expect(computeTotalSpanMin(segs)).toBe(35);
  });

  it('renders each child of a group as its own segment AND emits the group container', () => {
    const items = [
      makeGroup(
        [
          withType('c1', 'input', { duration: 5, title: 'C1' }),
          withType('c2', 'break', { duration: 5, title: 'C2' }),
        ],
        { id: 'g', title: 'Wrap' },
      ),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs.map((s) => s.id)).toEqual(['c1', 'c2', 'g']);
    expect(segs[0]).toMatchObject({ id: 'c1', kind: 'block', startMin: 0, endMin: 5, color: '#2C8DFE' });
    expect(segs[1]).toMatchObject({ id: 'c2', kind: 'block', startMin: 5, endMin: 10, color: '#6B7280' });
    expect(segs[2]).toMatchObject({
      id: 'g',
      title: 'Wrap',
      kind: 'group',
      startMin: 0,
      endMin: 10,
    });
  });

  it('renders a breakout as ONE segment spanning the full breakout duration', () => {
    const items = [
      makeBreakout(
        [
          withType('l0a', 'input', { duration: 10, laneIndex: 0, title: 'L0a' }),
          withType('l0b', 'input', { duration: 5, laneIndex: 0, title: 'L0b' }),
          withType('l1a', 'break', { duration: 15, laneIndex: 1, title: 'L1a' }),
        ],
        { id: 'br', duration: 15 },
      ),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({
      id: 'br',
      startMin: 0,
      endMin: 15,
      kind: 'breakout',
      // Breakout has no blockTypeId → fallback to the app's breakout pink.
      color: 'hsl(330 81% 60%)',
    });
  });

  it('uses the breakout\'s own blockType color when one is assigned', () => {
    const items = [
      makeBreakout([], { id: 'br', duration: 10, blockTypeId: 'input' }),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ id: 'br', kind: 'breakout', color: '#2C8DFE' });
  });

  it('renders a breakout nested inside a group as a single segment (skip lane children), plus the group', () => {
    const items = [
      makeGroup(
        [
          makeBreakout(
            [
              withType('l0', 'input', { duration: 5, laneIndex: 0, title: 'L0' }),
              withType('l1', 'input', { duration: 5, laneIndex: 1, title: 'L1' }),
            ],
            { id: 'br', duration: 5 },
          ),
        ],
        { id: 'g' },
      ),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs.map((s) => s.id)).toEqual(['br', 'g']);
    expect(segs[0]).toMatchObject({ startMin: 0, endMin: 5, kind: 'breakout' });
    expect(segs[1]).toMatchObject({ id: 'g', kind: 'group', startMin: 0, endMin: 5 });
  });

  it('skips zero-duration segments even when surrounded by renderable ones', () => {
    const items = [
      withType('a', 'input', { duration: 10 }),
      withType('zero', null, { duration: 0 }),
      withType('b', 'break', { duration: 5 }),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('spans from 0 to max(endMin) when items have fixedStartTime that jumps past them', () => {
    const items = [
      withType('a', null, { duration: 10 }),
      withType('b', null, { duration: 5, fixedStartTime: '11:30' }), // session 10:00 → offset 90
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(computeTotalSpanMin(segs)).toBe(95); // 90 + 5
    expect(segs[1].startMin).toBe(90);
  });

  it('uses the items param defensively when startTime is null', () => {
    const items = [withType('a', 'input', { duration: 10 })];
    const segs = computeSegments(items, null, BLOCK_TYPES);
    expect(segs).toHaveLength(1);
    expect(segs[0].startMin).toBe(0);
    expect(segs[0].endMin).toBe(10);
  });

  it('handles a fully empty workshop', () => {
    const ws = makeWorkshop();
    expect(computeSegments(ws.items, ws.workshop.startTime, ws.blockTypes)).toEqual([]);
  });

  it('renders children of a group nested inside another group AND emits both group containers', () => {
    // group → group → [block, block]
    const inner = makeGroup(
      [
        withType('innerA', 'input', { duration: 5, title: 'Inner A' }),
        withType('innerB', 'break', { duration: 5, title: 'Inner B' }),
      ],
      { id: 'inner', duration: 10 },
    );
    const outer = makeGroup([inner], { id: 'outer', duration: 10 });
    const segs = computeSegments([outer], '10:00', BLOCK_TYPES);

    // Walker pushes children first, then the wrapping group, then the outer
    // group. Order is cosmetic — rendering uses absolute positions — but we
    // assert it here so any future reorder is a conscious decision.
    expect(segs.map((s) => s.id)).toEqual(['innerA', 'innerB', 'inner', 'outer']);
    expect(segs.map((s) => s.kind)).toEqual(['block', 'block', 'group', 'group']);
    // Both groups span the full 0..10 minute range.
    expect(segs[2]).toMatchObject({ id: 'inner', startMin: 0, endMin: 10, kind: 'group' });
    expect(segs[3]).toMatchObject({ id: 'outer', startMin: 0, endMin: 10, kind: 'group' });
    expect(segs[0]).toMatchObject({ id: 'innerA', startMin: 0, endMin: 5, color: '#2C8DFE' });
    expect(segs[1]).toMatchObject({ id: 'innerB', startMin: 5, endMin: 10, color: '#6B7280' });
  });

  it('renders a breakout nested inside a nested group as a single segment plus both groups', () => {
    // group → group → breakout (with two lanes)
    const breakout = makeBreakout(
      [
        withType('l0', 'input', { duration: 5, laneIndex: 0, title: 'L0' }),
        withType('l1', 'break', { duration: 5, laneIndex: 1, title: 'L1' }),
      ],
      { id: 'br', duration: 5 },
    );
    const inner = makeGroup([breakout], { id: 'inner', duration: 5 });
    const outer = makeGroup([inner], { id: 'outer', duration: 5 });
    const segs = computeSegments([outer], '10:00', BLOCK_TYPES);

    expect(segs.map((s) => s.id)).toEqual(['br', 'inner', 'outer']);
    expect(segs.map((s) => s.kind)).toEqual(['breakout', 'group', 'group']);
    expect(segs[1]).toMatchObject({ id: 'inner', kind: 'group', startMin: 0, endMin: 5 });
    expect(segs[2]).toMatchObject({ id: 'outer', kind: 'group', startMin: 0, endMin: 5 });
    expect(segs[0]).toMatchObject({ startMin: 0, endMin: 5, kind: 'breakout' });
  });

  it('honours fixedStartTime snapping when session start is 00:00', () => {
    // Regression for the `sessionStartMin || undefined` bug: 00:00 == 0 was
    // falsy and silently disabled snapping. fixedStartTime='00:30' must
    // produce offset 30.
    const items = [
      withType('a', 'input', { duration: 10 }),
      withType('b', 'break', { duration: 5, fixedStartTime: '00:30' }),
    ];
    const segs = computeSegments(items, '00:00', BLOCK_TYPES);
    expect(segs[1].startMin).toBe(30);
    expect(segs[1].endMin).toBe(35);
  });

  it('preserves negative offsets when fixedStartTime is before session start', () => {
    // Session starts at 10:00, but block B is anchored to 09:30 → offset -30.
    // The data layer keeps the negative value; the strip clamps visual position.
    const items = [
      withType('a', 'input', { duration: 60 }),
      withType('b', 'break', { duration: 5, fixedStartTime: '09:30' }),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs[1].startMin).toBe(-30);
    expect(segs[1].endMin).toBe(-25);
  });

  it('does not pass an undefined sessionStartMin to the walker when startTime is set', () => {
    // Smoke test: ensure fixedStartTime snapping actually fires for a 00:00 start
    // by checking the maximum end advances past the natural sequential end.
    const items = [
      withType('a', 'input', { duration: 10 }),
      withType('b', 'input', { duration: 5, fixedStartTime: '02:00' }),
    ];
    const segs = computeSegments(items, '00:00', BLOCK_TYPES);
    expect(segs[1].startMin).toBe(120);
    expect(computeTotalSpanMin(segs)).toBe(125);
  });

  it('extends a group\'s endMin past its declared duration when a child jumps via fixedStartTime', () => {
    // Group has children summing to 10min, but one child anchors to minute 25
    // (15 min gap). The group segment should span 0..30 to cover the jump.
    const items = [
      makeGroup(
        [
          withType('a', null, { duration: 10, title: 'A' }),
          withType('b', null, { duration: 5, fixedStartTime: '10:25', title: 'B' }),
        ],
        { id: 'g' },
      ),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    const group = segs.find((s) => s.kind === 'group')!;
    expect(group).toBeDefined();
    expect(group.startMin).toBe(0);
    expect(group.endMin).toBe(30); // 25 (b's start) + 5 (b's duration)
  });

  it('skips zero-duration group segments', () => {
    // Empty group (no children) → no positive-duration group segment emitted.
    const items = [makeGroup([], { id: 'g' })];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    expect(segs).toEqual([]);
  });

  it('groups carry a neutral color (groups are rendered as decorative lines)', () => {
    const items = [
      makeGroup(
        [withType('a', null, { duration: 5 })],
        { id: 'g' },
      ),
    ];
    const segs = computeSegments(items, '10:00', BLOCK_TYPES);
    const group = segs.find((s) => s.kind === 'group')!;
    expect(group.color).toBe('#9CA3AF');
  });
});

describe('computeTotalSpanMin', () => {
  it('returns 0 for empty input', () => {
    expect(computeTotalSpanMin([])).toBe(0);
  });
  it('returns the max endMin across segments', () => {
    const segs = computeSegments(
      [withType('a', 'input', { duration: 10 }), withType('b', 'break', { duration: 5 })],
      '10:00',
      BLOCK_TYPES,
    );
    expect(computeTotalSpanMin(segs)).toBe(15);
  });
});

describe('hasRenderableSegments', () => {
  it('returns false for empty input', () => {
    expect(hasRenderableSegments([])).toBe(false);
  });
  it('returns true when at least one segment has positive duration', () => {
    const segs = computeSegments([withType('a', 'input', { duration: 5 })], '10:00', BLOCK_TYPES);
    expect(hasRenderableSegments(segs)).toBe(true);
  });
});

describe('formatMinAsHHMM', () => {
  it('formats minutes since 00:00', () => {
    expect(formatMinAsHHMM(0)).toBe('00:00');
    expect(formatMinAsHHMM(9 * 60 + 30)).toBe('09:30');
    expect(formatMinAsHHMM(14 * 60 + 5)).toBe('14:05');
  });
  it('clamps to two-digit hour and wraps at 24', () => {
    expect(formatMinAsHHMM(25 * 60)).toBe('01:00');
  });
  it('rounds fractional minutes', () => {
    expect(formatMinAsHHMM(9.6)).toBe('00:10');
  });
  it('treats negatives as zero', () => {
    expect(formatMinAsHHMM(-5)).toBe('00:00');
  });
});

describe('computeLiveCurrentMinute', () => {
  it('returns null when Live Mode is off', () => {
    expect(computeLiveCurrentMinute({ isActive: false, elapsedMinutes: 30 })).toBeNull();
  });

  it('returns null when Live Mode is on but elapsed is unknown (null)', () => {
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: null })).toBeNull();
  });

  it('returns the elapsed minute when Live Mode is active', () => {
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: 12.5 })).toBe(12.5);
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: 0 })).toBe(0);
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: 90 })).toBe(90);
  });

  it('clamps negative elapsed values to 0', () => {
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: -5 })).toBe(0);
  });

  it('returns null for non-finite elapsed values', () => {
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: NaN })).toBeNull();
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: Infinity })).toBeNull();
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: -Infinity })).toBeNull();
  });

  it('does not clamp values above the planned span — caller decides that', () => {
    // Live Mode can run past the planned end (extend +5 min button).
    // The helper surfaces the raw value; the strip component clamps visually.
    expect(computeLiveCurrentMinute({ isActive: true, elapsedMinutes: 500 })).toBe(500);
  });
});

// ── Viewport indicator: piecewise linear pixel ↔ minute mapping ───────────

// Two non-overlapping anchors covering 0..60min across 200px.
const ANCHORS: BlockAnchor[] = [
  { id: 'a', topPx: 0, bottomPx: 100, startMin: 0, endMin: 30 },
  { id: 'b', topPx: 120, bottomPx: 200, startMin: 40, endMin: 60 },
];

describe('minuteAtPixel', () => {
  it('returns 0 for empty anchors', () => {
    expect(minuteAtPixel(50, [])).toBe(0);
  });

  it('extrapolates linearly before the first anchor', () => {
    // First anchor sits at topPx=100, startMin=30. Halfway there = 15min.
    expect(minuteAtPixel(50, ANCHORS)).toBe(15);
  });

  it('returns the anchor\'s startMin when Y is exactly at the anchor\'s top edge', () => {
    expect(minuteAtPixel(0, ANCHORS)).toBe(0);
    expect(minuteAtPixel(100, ANCHORS)).toBe(30);
  });

  it('interpolates linearly within an anchor', () => {
    // Anchor a: topPx=0→0min, bottomPx=100→30min. Halfway = 15min.
    expect(minuteAtPixel(50, ANCHORS)).toBe(15);
    // 3/4 = 22.5
    expect(minuteAtPixel(75, ANCHORS)).toBeCloseTo(22.5);
  });

  it('interpolates linearly between two anchors', () => {
    // Between anchor a (ends at 100px, 30min) and anchor b (starts at 120px, 40min).
    // At 110px we're halfway → 35min.
    expect(minuteAtPixel(110, ANCHORS)).toBe(35);
  });

  it('interpolates linearly within the last anchor', () => {
    // Anchor b: 120px→40min, 200px→60min. 160px = halfway → 50min.
    expect(minuteAtPixel(160, ANCHORS)).toBe(50);
  });

  it('extrapolates past the last anchor using its px/min rate', () => {
    // Anchor b rate = 80px / 20min = 4 px/min. At 240px, that's 10min past
    // b.endMin → 70min total.
    expect(minuteAtPixel(240, ANCHORS)).toBeCloseTo(70);
  });

  it('handles unsorted anchor input by sorting internally', () => {
    const unsorted: BlockAnchor[] = [
      { id: 'b', topPx: 120, bottomPx: 200, startMin: 40, endMin: 60 },
      { id: 'a', topPx: 0, bottomPx: 100, startMin: 0, endMin: 30 },
    ];
    expect(minuteAtPixel(50, unsorted)).toBe(15);
    expect(minuteAtPixel(160, unsorted)).toBe(50);
  });

  it('does not crash on a single zero-height anchor', () => {
    const single: BlockAnchor[] = [{ id: 's', topPx: 0, bottomPx: 0, startMin: 0, endMin: 10 }];
    // Degenerate anchor (no width, no height, no rate) → returns the
    // anchor's endMin for any Y past the top edge (no extrapolation rate).
    expect(minuteAtPixel(0, single)).toBe(0);
    expect(minuteAtPixel(50, single)).toBe(10);
  });
});

describe('computeVisibleRange', () => {
  it('returns null when no anchors are available', () => {
    expect(computeVisibleRange([], 0, 100, 60)).toBeNull();
  });

  it('returns null when the visible pixel range is empty', () => {
    // Equal top/bottom → no range.
    expect(computeVisibleRange(ANCHORS, 100, 100, 60)).toBeNull();
    // Inverted top/bottom → normalised to (100, 200) → non-empty.
    expect(computeVisibleRange(ANCHORS, 200, 100, 60)).not.toBeNull();
  });

  it('maps a fully-contained visible range correctly', () => {
    // View covers 25..75px → within anchor a → 7.5..22.5 min.
    const r = computeVisibleRange(ANCHORS, 25, 75, 60)!;
    expect(r.startMin).toBeCloseTo(7.5);
    expect(r.endMin).toBeCloseTo(22.5);
  });

  it('maps a visible range that spans anchors and gaps', () => {
    // 50..180px → covers end of a (15..30min), the gap (30..40min), and start of b (40..55min).
    const r = computeVisibleRange(ANCHORS, 50, 180, 60)!;
    expect(r.startMin).toBeCloseTo(15);
    expect(r.endMin).toBeCloseTo(55);
  });

  it('clamps the result to [0, spanMin]', () => {
    // Y < 0 still extrapolates linearly from (0, 0) → first anchor.
    const r = computeVisibleRange(ANCHORS, -100, 50, 60)!;
    expect(r.startMin).toBe(0);
    expect(r.endMin).toBeCloseTo(15);
  });

  it('normalizes start <= end regardless of viewport direction', () => {
    const r = computeVisibleRange(ANCHORS, 180, 50, 60)!;
    expect(r.startMin).toBeLessThanOrEqual(r.endMin);
  });
});

describe('pixelAtMinute', () => {
  const CONTENT_HEIGHT = 600;

  it('returns 0 for empty anchors', () => {
    expect(pixelAtMinute(30, [], CONTENT_HEIGHT)).toBe(0);
  });

  it('extrapolates linearly before the first anchor', () => {
    // First anchor: topPx=100, startMin=30. Halfway to minute 15 → pixel 50.
    expect(pixelAtMinute(15, ANCHORS, CONTENT_HEIGHT)).toBe(50);
  });

  it('returns the anchor\'s topPx when m is exactly the anchor\'s startMin', () => {
    expect(pixelAtMinute(0, ANCHORS, CONTENT_HEIGHT)).toBe(0);
    expect(pixelAtMinute(30, ANCHORS, CONTENT_HEIGHT)).toBe(100);
  });

  it('interpolates linearly within an anchor', () => {
    // Anchor a: topPx=0→0min, bottomPx=100→30min. Halfway → 50px.
    expect(pixelAtMinute(15, ANCHORS, CONTENT_HEIGHT)).toBe(50);
    // 3/4 = 75px.
    expect(pixelAtMinute(22.5, ANCHORS, CONTENT_HEIGHT)).toBeCloseTo(75);
  });

  it('interpolates linearly between two anchors', () => {
    // Between a (ends at 100px / 30min) and b (starts at 120px / 40min).
    // 35min is halfway → 110px.
    expect(pixelAtMinute(35, ANCHORS, CONTENT_HEIGHT)).toBe(110);
  });

  it('interpolates linearly within the last anchor', () => {
    // Anchor b: 120px→40min, 200px→60min. 50min is halfway → 160px.
    expect(pixelAtMinute(50, ANCHORS, CONTENT_HEIGHT)).toBe(160);
  });

  it('extrapolates past the last anchor using its px/min rate', () => {
    // Anchor b rate = 80px / 20min = 4 px/min. At minute 70 → 240px.
    expect(pixelAtMinute(70, ANCHORS, CONTENT_HEIGHT)).toBeCloseTo(240);
  });

  it('clamps minute values above max(endMin) and below 0', () => {
    // m=120 is above maxEnd=60 → uses last anchor's rate past 60.
    expect(pixelAtMinute(120, ANCHORS, CONTENT_HEIGHT)).toBeCloseTo(60 * 4 + 200);
    // m=-10 → clamped to 0 → extrapolates from (0, 30) backward.
    expect(pixelAtMinute(-10, ANCHORS, CONTENT_HEIGHT)).toBe(0);
  });

  it('clamps the result to contentHeight when extrapolation overflows', () => {
    // Huge minute extrapolates way past the anchors but is capped at contentHeight.
    expect(pixelAtMinute(1_000_000, ANCHORS, CONTENT_HEIGHT)).toBeLessThanOrEqual(CONTENT_HEIGHT);
  });

  it('handles unsorted anchor input by sorting internally', () => {
    const unsorted: BlockAnchor[] = [
      { id: 'b', topPx: 120, bottomPx: 200, startMin: 40, endMin: 60 },
      { id: 'a', topPx: 0, bottomPx: 100, startMin: 0, endMin: 30 },
    ];
    expect(pixelAtMinute(15, unsorted, CONTENT_HEIGHT)).toBe(50);
    expect(pixelAtMinute(50, unsorted, CONTENT_HEIGHT)).toBe(160);
  });

  it('is the inverse of minuteAtPixel for in-anchor values', () => {
    for (const m of [0, 5, 15, 25, 30, 35, 45, 55, 60]) {
      const y = pixelAtMinute(m, ANCHORS, CONTENT_HEIGHT);
      const roundtrip = minuteAtPixel(y, ANCHORS);
      expect(roundtrip).toBeCloseTo(m);
    }
  });

  it('falls back to the last anchor\'s bottomPx when the last anchor is degenerate', () => {
    const single: BlockAnchor[] = [
      { id: 's', topPx: 100, bottomPx: 100, startMin: 0, endMin: 10 },
    ];
    // Last anchor has zero height → returns bottomPx (capped at contentHeight).
    expect(pixelAtMinute(20, single, CONTENT_HEIGHT)).toBe(100);
    expect(pixelAtMinute(20, single, 50)).toBe(50);
  });
});

// ── buildBlockAnchors (DOM helper, extracted from the duplicated inline loops) ─

describe('buildBlockAnchors', () => {
  // Minimal DOM stand-in: a `querySelectorAll` factory + a `getBoundingClientRect`
  // shim. The helper only reads `dataset.itemId` and `getBoundingClientRect`, so
  // this is all it needs.
  const makeCard = (id: string, top: number, bottom: number) => ({
    dataset: { itemId: id },
    getBoundingClientRect: () => ({
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  });
  const makeContent = (cards: ReturnType<typeof makeCard>[]) =>
    ({
      querySelectorAll: (sel: string) => {
        if (sel !== '[data-item-id]') return [] as unknown as NodeListOf<HTMLElement>;
        return cards as unknown as NodeListOf<HTMLElement>;
      },
      getBoundingClientRect: () => ({
        top: 0,
        bottom: 1000,
        left: 0,
        right: 0,
        width: 0,
        height: 1000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    }) as unknown as HTMLElement;

  it('returns anchors only for card ids that exist in the segments list', () => {
    const content = makeContent([
      makeCard('a', 100, 200),
      makeCard('b', 300, 400),
      makeCard('orphan', 500, 600), // id not in segments
    ]);
    const segs = [
      { id: 'a', startMin: 10, endMin: 20 },
      { id: 'b', startMin: 30, endMin: 40 },
    ];
    const anchors = buildBlockAnchors(content, segs as never);
    expect(anchors.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('returns anchors whose topPx/bottomPx are relative to the content rect', () => {
    // contentRect.top = 0 → topPx/bottomPx equal the cards' raw rect values.
    const content = makeContent([makeCard('a', 100, 250)]);
    const segs = [{ id: 'a', startMin: 0, endMin: 30 }];
    const anchors = buildBlockAnchors(content, segs as never);
    expect(anchors[0]).toMatchObject({ topPx: 100, bottomPx: 250, startMin: 0, endMin: 30 });
  });

  it('returns [] when there are no matching cards', () => {
    const content = makeContent([makeCard('orphan', 0, 100)]);
    const segs = [{ id: 'a', startMin: 0, endMin: 10 }];
    expect(buildBlockAnchors(content, segs as never)).toEqual([]);
  });

  it('returns [] when segments is empty (no anchors to build)', () => {
    const content = makeContent([makeCard('a', 0, 100)]);
    expect(buildBlockAnchors(content, [])).toEqual([]);
  });
});
