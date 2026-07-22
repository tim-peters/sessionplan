import { describe, it, expect } from 'vitest';
import {
  findItemById,
  findItemAndParent,
  findParentId,
  updateItemInTree,
  removeItemFromTree,
  getItemIndex,
  calculateChildrenDuration,
  calculateBreakoutDuration,
  updateGroupDurations,
  calculateTotalDuration,
  getBlockTypeName,
} from '@/lib/workshopUtils';
import { WorkshopItem, BlockType } from '@/types/workshop';
import { makeBlock, makeGroup, makeBreakout } from './test-helpers';

const fakeT = ((key: string) => `t:${key}`) as unknown as Parameters<typeof getBlockTypeName>[1];

describe('findItemById', () => {
  it('returns null on an empty list', () => {
    expect(findItemById([], 'x')).toBeNull();
  });

  it('finds a top-level item by id', () => {
    const a = makeBlock({ id: 'a' });
    const b = makeBlock({ id: 'b' });
    expect(findItemById([a, b], 'b')).toBe(b);
  });

  it('finds a deeply nested item by id', () => {
    const leaf = makeBlock({ id: 'leaf' });
    const inner = makeGroup([leaf], { id: 'inner' });
    const outer = makeGroup([inner], { id: 'outer' });
    expect(findItemById([outer], 'leaf')).toBe(leaf);
  });

  it('returns null if the id is not present', () => {
    const a = makeBlock({ id: 'a' });
    expect(findItemById([a], 'missing')).toBeNull();
  });
});

describe('findItemAndParent', () => {
  it('returns null parentId for top-level items', () => {
    const a = makeBlock({ id: 'a' });
    const result = findItemAndParent([a], 'a');
    expect(result.item).toBe(a);
    expect(result.parentId).toBeNull();
  });

  it('returns the parent id for nested items', () => {
    const leaf = makeBlock({ id: 'leaf' });
    const parent = makeGroup([leaf], { id: 'parent' });
    const result = findItemAndParent([parent], 'leaf');
    expect(result.item).toBe(leaf);
    expect(result.parentId).toBe('parent');
  });

  it('returns null item when not found', () => {
    const result = findItemAndParent([], 'missing');
    expect(result.item).toBeNull();
    expect(result.parentId).toBeNull();
  });
});

describe('findParentId', () => {
  it('returns null for a top-level item', () => {
    const a = makeBlock({ id: 'a' });
    expect(findParentId([a], 'a')).toBeNull();
  });

  it('returns undefined when the item is not present', () => {
    const a = makeBlock({ id: 'a' });
    expect(findParentId([a], 'missing')).toBeUndefined();
  });

  it('returns the direct parent id', () => {
    const leaf = makeBlock({ id: 'leaf' });
    const parent = makeGroup([leaf], { id: 'parent' });
    expect(findParentId([parent], 'leaf')).toBe('parent');
  });
});

describe('updateItemInTree', () => {
  it('updates a top-level item immutably', () => {
    const a = makeBlock({ id: 'a', title: 'old' });
    const updated = updateItemInTree([a], 'a', { title: 'new' });
    expect(updated[0].title).toBe('new');
    expect(a.title).toBe('old'); // not mutated
  });

  it('updates a nested item', () => {
    const leaf = makeBlock({ id: 'leaf', title: 'old' });
    const parent = makeGroup([leaf], { id: 'parent' });
    const updated = updateItemInTree([parent], 'leaf', { title: 'new' });
    const updatedLeaf = findItemById(updated, 'leaf');
    expect(updatedLeaf?.title).toBe('new');
    expect(parent.children?.[0].title).toBe('old');
  });

  it('returns the original structure unchanged when id is not found', () => {
    const a = makeBlock({ id: 'a' });
    const updated = updateItemInTree([a], 'missing', { title: 'x' });
    expect(updated).toEqual([a]);
  });
});

describe('removeItemFromTree', () => {
  it('removes a top-level item', () => {
    const a = makeBlock({ id: 'a' });
    const b = makeBlock({ id: 'b' });
    expect(removeItemFromTree([a, b], 'a')).toEqual([b]);
  });

  it('removes a nested item and leaves siblings intact', () => {
    const keep = makeBlock({ id: 'keep', title: 'keep' });
    const drop = makeBlock({ id: 'drop' });
    const parent = makeGroup([keep, drop], { id: 'parent' });
    const result = removeItemFromTree([parent], 'drop');
    expect(findItemById(result, 'drop')).toBeNull();
    expect(findItemById(result, 'keep')).not.toBeNull();
  });

  it('is a no-op when the id is not present', () => {
    const a = makeBlock({ id: 'a' });
    expect(removeItemFromTree([a], 'missing')).toEqual([a]);
  });
});

describe('getItemIndex', () => {
  it('returns the index of an item', () => {
    const a = makeBlock({ id: 'a' });
    const b = makeBlock({ id: 'b' });
    expect(getItemIndex([a, b], 'b')).toBe(1);
  });
  it('returns -1 when missing', () => {
    expect(getItemIndex([], 'x')).toBe(-1);
  });
});

describe('calculateChildrenDuration', () => {
  it('returns 0 for empty / undefined children', () => {
    expect(calculateChildrenDuration()).toBe(0);
    expect(calculateChildrenDuration([])).toBe(0);
  });

  it('sums durations of all children', () => {
    const a = makeBlock({ duration: 10 });
    const b = makeBlock({ duration: 25 });
    expect(calculateChildrenDuration([a, b])).toBe(35);
  });
});

describe('calculateBreakoutDuration', () => {
  it('returns 0 for a breakout with no children', () => {
    expect(calculateBreakoutDuration(makeBreakout([]))).toBe(0);
  });

  it('returns the longest lane duration, not the sum of all lanes', () => {
    const lane0 = [
      makeBlock({ duration: 10, laneIndex: 0 }),
      makeBlock({ duration: 10, laneIndex: 0 }),
    ];
    const lane1 = [makeBlock({ duration: 5, laneIndex: 1 })];
    const breakout = makeBreakout([...lane0, ...lane1], { lanes: 2 });
    expect(calculateBreakoutDuration(breakout)).toBe(20);
  });

  it('defaults to lane 0 when laneIndex is missing', () => {
    const breakout = makeBreakout(
      [makeBlock({ duration: 7 }), makeBlock({ duration: 13, laneIndex: 0 })],
      { lanes: 1 },
    );
    expect(calculateBreakoutDuration(breakout)).toBe(20);
  });
});

describe('updateGroupDurations', () => {
  it('recomputes group durations from children when not locked', () => {
    const a = makeBlock({ duration: 5 });
    const b = makeBlock({ duration: 7 });
    const group = makeGroup([a, b], { id: 'g', duration: 999 });
    const updated = updateGroupDurations([group]);
    expect(updated[0].duration).toBe(12);
  });

  it('does not touch a locked group', () => {
    const a = makeBlock({ duration: 5 });
    const group = makeGroup([a], { id: 'g', duration: 999, durationLocked: true });
    const updated = updateGroupDurations([group]);
    expect(updated[0].duration).toBe(999);
  });

  it('recomputes nested groups recursively', () => {
    const leaf = makeBlock({ duration: 10 });
    const inner = makeGroup([leaf], { id: 'inner', duration: 0 });
    const outer = makeGroup([inner], { id: 'outer', duration: 0 });
    const updated = updateGroupDurations([outer]);
    expect(updated[0].duration).toBe(10);
    expect((updated[0].children?.[0] as WorkshopItem).duration).toBe(10);
  });

  it('uses max lane duration for a breakout (not sum)', () => {
    const b0a = makeBlock({ duration: 5, laneIndex: 0 });
    const b0b = makeBlock({ duration: 5, laneIndex: 0 });
    const b1 = makeBlock({ duration: 3, laneIndex: 1 });
    const breakout = makeBreakout([b0a, b0b, b1], { id: 'bo', lanes: 2, duration: 99 });
    const updated = updateGroupDurations([breakout]);
    expect(updated[0].duration).toBe(10);
  });

  it('does not touch a locked breakout', () => {
    const child = makeBlock({ duration: 5, laneIndex: 0 });
    const breakout = makeBreakout([child], { id: 'bo', lanes: 1, duration: 99, durationLocked: true });
    const updated = updateGroupDurations([breakout]);
    expect(updated[0].duration).toBe(99);
  });

  it('leaves regular blocks alone', () => {
    const a = makeBlock({ duration: 5 });
    const updated = updateGroupDurations([a]);
    expect(updated[0].duration).toBe(5);
  });
});

describe('calculateTotalDuration', () => {
  it('sums durations of all top-level items', () => {
    const a = makeBlock({ duration: 10 });
    const g = makeGroup([makeBlock({ duration: 5 })], { duration: 5 });
    expect(calculateTotalDuration([a, g])).toBe(15);
  });
});

describe('getBlockTypeName', () => {
  it('returns the translated name for a built-in type', () => {
    const result = getBlockTypeName({ id: 'input', name: 'fallback', color: '' }, fakeT);
    expect(result).toBe('t:blockTypes.input');
  });

  it('returns the stored name for a custom block type', () => {
    const result = getBlockTypeName(
      { id: 'custom-1', name: 'Custom', color: '' } as BlockType,
      fakeT,
    );
    expect(result).toBe('Custom');
  });
});
