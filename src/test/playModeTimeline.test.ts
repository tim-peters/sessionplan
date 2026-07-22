import { describe, it, expect } from 'vitest';
import { flattenTimeline } from '@/lib/playModeTimeline';
import { makeBlock, makeGroup, makeBreakout } from './test-helpers';

describe('flattenTimeline', () => {
  it('returns an empty list for no items', () => {
    expect(flattenTimeline([])).toEqual([]);
  });

  it('flattens a single top-level block', () => {
    const block = makeBlock({ id: 'b1', duration: 10 });
    expect(flattenTimeline([block])).toEqual([
      { id: 'b1', title: block.title, startMin: 0, endMin: 10, type: 'block' },
    ]);
  });

  it('flattens a group: the group spans the children, and children are sequential', () => {
    const c1 = makeBlock({ id: 'c1', duration: 5 });
    const c2 = makeBlock({ id: 'c2', duration: 7 });
    const group = makeGroup([c1, c2], { id: 'g', duration: 12 });
    const flat = flattenTimeline([group]);
    expect(flat).toEqual([
      { id: 'g', title: group.title, startMin: 0, endMin: 12, type: 'group' },
      { id: 'c1', title: c1.title, startMin: 0, endMin: 5, parentId: 'g', type: 'block' },
      { id: 'c2', title: c2.title, startMin: 5, endMin: 12, parentId: 'g', type: 'block' },
    ]);
  });

  it('flattens a top-level breakout with parallel lanes (shared time span)', () => {
    const a0 = makeBlock({ id: 'a0', duration: 10, laneIndex: 0 });
    const a1 = makeBlock({ id: 'a1', duration: 15, laneIndex: 0 });
    const b0 = makeBlock({ id: 'b0', duration: 8, laneIndex: 1 });
    const breakout = makeBreakout([a0, a1, b0], { id: 'br', duration: 25, lanes: 2 });
    const flat = flattenTimeline([breakout]);
    const breakoutEntry = flat.find((f) => f.id === 'br')!;
    expect(breakoutEntry).toEqual({ id: 'br', title: breakout.title, startMin: 0, endMin: 25, type: 'breakout' });

    const a0Entry = flat.find((f) => f.id === 'a0')!;
    const a1Entry = flat.find((f) => f.id === 'a1')!;
    const b0Entry = flat.find((f) => f.id === 'b0')!;
    expect(a0Entry.startMin).toBe(0);
    expect(a0Entry.endMin).toBe(10);
    expect(a1Entry.startMin).toBe(10);
    expect(a1Entry.endMin).toBe(25);
    expect(b0Entry.startMin).toBe(0);
    expect(b0Entry.endMin).toBe(8);
    for (const child of [a0Entry, a1Entry, b0Entry]) {
      expect(child.parentId).toBe('br');
    }
  });

  it('applies a starting offset', () => {
    const block = makeBlock({ id: 'b', duration: 5 });
    expect(flattenTimeline([block], 30)).toEqual([
      { id: 'b', title: block.title, startMin: 30, endMin: 35, type: 'block' },
    ]);
  });

  it('snaps the offset to a fixedStartTime when sessionStartMinutes is provided', () => {
    const block = makeBlock({ id: 'b', duration: 5, fixedStartTime: '10:00' });
    // Session starts at 09:00 (= 540 min). 10:00 = 600 min → offset = 60.
    const flat = flattenTimeline([block], 0, 540);
    expect(flat[0].startMin).toBe(60);
    expect(flat[0].endMin).toBe(65);
  });

  it('snaps a child inside a group to a fixedStartTime', () => {
    const c1 = makeBlock({ id: 'c1', duration: 5 });
    const c2 = makeBlock({ id: 'c2', duration: 5, fixedStartTime: '09:30' });
    const group = makeGroup([c1, c2], { id: 'g', duration: 10 });
    const flat = flattenTimeline([group], 0, 540);
    const c2Entry = flat.find((f) => f.id === 'c2')!;
    expect(c2Entry.startMin).toBe(30); // 09:30 - 09:00
    expect(c2Entry.endMin).toBe(35);
  });

  it('snaps a breakout child in its own lane to a fixedStartTime', () => {
    const a0 = makeBlock({ id: 'a0', duration: 5, laneIndex: 0 });
    const a1 = makeBlock({ id: 'a1', duration: 5, laneIndex: 0, fixedStartTime: '10:00' });
    const breakout = makeBreakout([a0, a1], { id: 'br', duration: 60, lanes: 2 });
    const flat = flattenTimeline([breakout], 0, 540); // sessionStart 09:00
    const a1Entry = flat.find((f) => f.id === 'a1')!;
    expect(a1Entry.startMin).toBe(60); // 10:00 - 09:00
    expect(a1Entry.endMin).toBe(65);
  });

  it('accumulates the top-level offset across multiple items', () => {
    const a = makeBlock({ id: 'a', duration: 10 });
    const b = makeBlock({ id: 'b', duration: 5 });
    const flat = flattenTimeline([a, b]);
    expect(flat[0].endMin).toBe(10);
    expect(flat[1].startMin).toBe(10);
    expect(flat[1].endMin).toBe(15);
  });

  it('recurses into a breakout nested inside a group', () => {
    const a = makeBlock({ id: 'a', duration: 5, laneIndex: 0 });
    const b = makeBlock({ id: 'b', duration: 5, laneIndex: 1 });
    const breakout = makeBreakout([a, b], { id: 'br', duration: 5, lanes: 2 });
    const group = makeGroup([breakout], { id: 'g', duration: 5 });
    const flat = flattenTimeline([group]);
    expect(flat.find((f) => f.id === 'a')?.parentId).toBe('br');
    expect(flat.find((f) => f.id === 'b')?.parentId).toBe('br');
  });
});
