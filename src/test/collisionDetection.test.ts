import { describe, it, expect } from 'vitest';
import { createCustomCollisionDetection } from '@/lib/collisionDetection';
import { makeBlock, makeGroup } from './test-helpers';
import { vi } from 'vitest';

// We exercise the public factory and stub @dnd-kit's helpers via a
// pointerWithin/closestCenter mock to make assertions deterministic.
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
  return {
    ...actual,
    pointerWithin: vi.fn(() => []),
    closestCenter: vi.fn(() => []),
  };
});

import * as dndKit from '@dnd-kit/core';

const makeRect = (left: number, top: number, width = 100, height = 50) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});

const baseArgs = (overrides: Partial<Parameters<ReturnType<typeof createCustomCollisionDetection>>[0]> = {}) => ({
  active: { id: 'a', data: { current: { type: 'blocktype' } } } as never,
  collisionRect: makeRect(0, 0) as never,
  droppableRects: new Map() as never,
  droppableContainers: [] as never,
  pointerCoordinates: { x: 0, y: 0 } as never,
  ...overrides,
});

describe('createCustomCollisionDetection', () => {
  it('routes sidebar drags through the sidebar drag path', () => {
    const detect = createCustomCollisionDetection([], null);
    detect(baseArgs());
    expect(dndKit.pointerWithin).toHaveBeenCalled();
    expect(dndKit.closestCenter).toHaveBeenCalled();
  });

  it('routes timeline drags through the timeline path', () => {
    const detect = createCustomCollisionDetection([], null);
    detect(
      baseArgs({
        active: { id: 'b', data: { current: { type: 'timeline-item' } } } as never,
      }),
    );
    // pointerWithin is still called; closestCenter only when no item collisions
    expect(dndKit.pointerWithin).toHaveBeenCalled();
  });

  it('returns an empty list when no collisions are detected', () => {
    vi.mocked(dndKit.pointerWithin).mockReturnValueOnce([]);
    vi.mocked(dndKit.closestCenter).mockReturnValueOnce([]);

    const detect = createCustomCollisionDetection([], null);
    const result = detect(baseArgs());
    expect(result).toEqual([]);
  });

  it('prefers breakout-lane drop zones for sidebar drags', () => {
    vi.mocked(dndKit.pointerWithin).mockReturnValueOnce([
      { id: 'some-item', data: { droppableContainer: { id: 'some-item' }, value: 0 } },
      { id: 'parent-1-lane-0', data: { droppableContainer: { id: 'parent-1-lane-0' }, value: 0 } },
    ]);
    vi.mocked(dndKit.closestCenter).mockReturnValueOnce([]);

    const detect = createCustomCollisionDetection([], null);
    const result = detect(baseArgs());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('parent-1-lane-0');
  });

  it('prefers top / bottom drop zones for sidebar drags', () => {
    vi.mocked(dndKit.pointerWithin).mockReturnValueOnce([
      { id: 'some-item', data: { droppableContainer: { id: 'some-item' }, value: 0 } },
      { id: 'drop-zone-bottom', data: { droppableContainer: { id: 'drop-zone-bottom' }, value: 0 } },
    ]);
    vi.mocked(dndKit.closestCenter).mockReturnValueOnce([]);

    const detect = createCustomCollisionDetection([], null);
    const result = detect(baseArgs());
    expect(result[0].id).toBe('drop-zone-bottom');
  });

  it('uses findParentId to prefer same-level items for timeline drags', () => {
    const child1 = makeBlock({ id: 'child1' });
    const child2 = makeBlock({ id: 'child2' });
    const group = makeGroup([child1, child2], { id: 'g1' });

    vi.mocked(dndKit.pointerWithin).mockReturnValueOnce([]);
    vi.mocked(dndKit.closestCenter).mockReturnValueOnce([
      { id: 'child1', data: { value: 0.5 } },
      { id: 'top-level', data: { value: 0.6 } },
    ]);

    const detect = createCustomCollisionDetection([group], 'g1');
    const result = detect(
      baseArgs({
        active: { id: 'child2', data: { current: { type: 'timeline-item' } } } as never,
      }),
    );
    // child1 shares parent 'g1' with the active item; top-level is cross-level.
    // The factory prefers same-level (and only falls back to cross-level if it
    // is much closer), so child1 wins here.
    expect(result[0].id).toBe('child1');
  });
});
