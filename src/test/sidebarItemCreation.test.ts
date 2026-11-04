import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { TFunction } from 'i18next';
import { BlockType, WorkshopItem } from '@/types/workshop';
import { useDragHandlers } from '@/hooks/useDragHandlers';
import { createBlockOfType, createItemFromLibrary } from '@/lib/workshopUtils';
import { DEFAULT_BLOCK_DURATION } from '@/lib/workshopDefaults';
import type { ActiveData } from '@/types/dnd';
import { makeBlock, makeBreakout, makeGroup } from './test-helpers';

const t = ((key: string) => key) as unknown as TFunction;
const customType: BlockType = { id: 'custom', name: 'Check-in', color: '#000000' };

const dropAtEnd = (data: ActiveData) => {
  const addItem = vi.fn();
  const { result } = renderHook(() =>
    useDragHandlers({
      workshopItems: [],
      addItem,
      updateItem: vi.fn(),
      moveItem: vi.fn(),
      reorderItems: vi.fn(),
      t,
    }),
  );
  result.current.handleDragEnd({
    active: { id: 'sidebar', data: { current: data } },
    over: { id: 'drop-zone-bottom', data: {} },
  } as unknown as DragEndEvent);
  return addItem.mock.calls[0][0] as Omit<WorkshopItem, 'id'>;
};

const collectIds = (item: Omit<WorkshopItem, 'id'> & { id?: string }): (string | undefined)[] => [
  item.id,
  ...(item.children ?? []).flatMap(collectIds),
];

describe('createBlockOfType', () => {
  it('uses the block type as title and type', () => {
    expect(createBlockOfType(customType, t)).toEqual({
      type: 'block',
      blockTypeId: 'custom',
      title: 'Check-in',
      duration: DEFAULT_BLOCK_DURATION,
      notes: '',
      material: '',
    });
  });

  it('is what dragging a block type creates', () => {
    expect(dropAtEnd({ type: 'blocktype', blockType: customType })).toEqual(createBlockOfType(customType, t));
  });
});

describe('createItemFromLibrary', () => {
  const breakout = makeBreakout(
    [makeBlock({ id: 'lane-child', laneIndex: 1 })],
    {
      id: 'entry',
      lanes: 4,
      sameInAllBreakouts: true,
      durationLocked: true,
      duration: 45,
      personIds: ['person'],
      laneIndex: 2,
    },
  );

  it('keeps every setting of the entry', () => {
    expect(createItemFromLibrary(breakout)).toMatchObject({
      type: 'breakout',
      lanes: 4,
      sameInAllBreakouts: true,
      durationLocked: true,
      duration: 45,
      personIds: ['person'],
    });
    expect(createItemFromLibrary(breakout).children?.[0].laneIndex).toBe(1);
  });

  it('leaves the ID and the room to the place it is added to', () => {
    const item = createItemFromLibrary(breakout);

    expect(item).not.toHaveProperty('id');
    expect(item).not.toHaveProperty('laneIndex');
  });

  it('gives nested items new IDs each time', () => {
    const entry = makeGroup([makeBreakout([makeBlock({ id: 'deep' })], { id: 'nested' })], { id: 'entry' });

    const ids = [...collectIds(createItemFromLibrary(entry)), ...collectIds(createItemFromLibrary(entry))]
      .filter(Boolean);

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain('nested');
    expect(ids).not.toContain('deep');
  });

  it('is what dragging a library entry creates', () => {
    const dropped = dropAtEnd({ type: 'library', item: breakout });

    expect({ ...dropped, children: undefined }).toEqual({ ...createItemFromLibrary(breakout), children: undefined });
    expect(dropped.children?.[0].id).not.toBe('lane-child');
  });
});
