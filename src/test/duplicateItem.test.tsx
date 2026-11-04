/**
 * Duplicating a timeline item, driven through the real item menu, the real
 * Timeline and the real useWorkshop state.
 */
import { useEffect, useRef } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { DndContext } from '@dnd-kit/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { LibraryProvider } from '@/contexts/LibraryContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { DragDropProvider } from '@/hooks/useDragDropContext';
import { useWorkshop } from '@/hooks/useWorkshop';
import { calculateBlockTime } from '@/lib/workshopStorage';
import { Timeline } from '@/modules/timeline/Timeline';
import { WorkshopItem } from '@/types/workshop';
import { clearAllStorage, makeBlock, makeBreakout, makeGroup, makeWorkshop } from './test-helpers';

const allIds = (items: WorkshopItem[]): string[] =>
  items.flatMap((item) => [item.id, ...allIds(item.children ?? [])]);

const Planner = ({
  items,
  onItems,
}: {
  items: WorkshopItem[];
  onItems: (items: WorkshopItem[]) => void;
}) => {
  const workshop = useWorkshop();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    workshop.loadWorkshop(makeWorkshop({ items }));
  }, [workshop, items]);

  useEffect(() => {
    onItems(workshop.workshop.items);
  }, [workshop.workshop.items, onItems]);

  return (
    <Timeline
      items={workshop.workshop.items}
      blockTypes={workshop.workshop.blockTypes}
      persons={workshop.workshop.persons}
      startTime={workshop.workshop.workshop.startTime}
      onUpdateItem={workshop.updateItem}
      onDeleteItem={workshop.deleteItem}
      onAddItem={workshop.addItem}
      onInsertItemAfter={workshop.insertItemAfter}
      onSaveToLibrary={() => {}}
      editingItem={null}
      onEditingItemChange={() => {}}
    />
  );
};

/** Renders a plan and returns its live items. */
const renderPlan = (items: WorkshopItem[]) => {
  const current: { items: WorkshopItem[] } = { items: [] };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HelmetProvider>
        <MemoryRouter>
          <LocaleProvider>
            <LibraryProvider>
              <DndContext>
                <DragDropProvider
                  value={{ activeId: null, activeData: undefined, activeParentId: null, dropIndicator: null }}
                >
                  <Planner items={items} onItems={(next) => { current.items = next; }} />
                </DragDropProvider>
              </DndContext>
            </LibraryProvider>
          </LocaleProvider>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
  return current;
};

/** Opens the item's own menu (the nearest one around its title) and chooses Duplicate. */
const duplicate = (id: string) => {
  const title = document.querySelector(`input[data-block-id="${id}"]`);
  if (!title) throw new Error(`No title input for ${id}`);

  let scope: Element | null = title;
  let trigger: Element | null = null;
  while (scope && !trigger) {
    // Accessible names are the i18n keys: no translations are loaded in tests.
    trigger = scope.querySelector('button[aria-label="actions.menu"]');
    scope = scope.parentElement;
  }
  if (!trigger) throw new Error(`No item menu for ${id}`);

  fireEvent.keyDown(trigger, { key: 'Enter' });
  act(() => {
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'actions.duplicate' }));
  });
};

const everySetting = {
  blockTypeId: 'bt-1',
  duration: 25,
  notes: 'Some notes',
  material: 'Flip chart',
  personIds: ['p1', 'p2'],
  durationLocked: true,
};

describe('duplicating a timeline item', () => {
  beforeEach(() => {
    clearAllStorage();
    window.history.replaceState(null, '', '/');
  });

  describe('at the top level', () => {
    it('keeps every setting of a block and inserts the copy right after it', () => {
      const plan = renderPlan([
        makeBlock({ id: 'source', title: 'Intro', ...everySetting }),
        makeBlock({ id: 'after' }),
      ]);

      duplicate('source');

      expect(plan.items.map((item) => item.id)).toEqual(['source', plan.items[1].id, 'after']);
      const copy = plan.items[1];
      expect(copy.id).not.toBe('source');
      expect(copy).toMatchObject({ type: 'block', ...everySetting });
      expect(copy.title).toContain('Intro');
      expect(copy.title).not.toBe('Intro');
    });

    it('keeps the room settings and room people of a breakout', () => {
      const plan = renderPlan([
        makeBreakout([makeBlock({ id: 'lane-child', laneIndex: 1, duration: 40 })], {
          id: 'source',
          parallel: false,
          lanes: 4,
          sameInAllBreakouts: true,
          durationLocked: true,
          duration: 60,
          personIds: ['p1'],
          lanePersons: { 0: ['p1'], 2: ['p2'] },
        }),
      ]);

      duplicate('source');

      expect(plan.items[1]).toMatchObject({
        type: 'breakout',
        parallel: false,
        lanes: 4,
        sameInAllBreakouts: true,
        durationLocked: true,
        duration: 60,
        personIds: ['p1'],
        lanePersons: { 0: ['p1'], 2: ['p2'] },
      });
      expect(plan.items[1].children?.[0].laneIndex).toBe(1);
    });

    it('gives a group every nested item its own ID', () => {
      const plan = renderPlan([
        makeGroup(
          [
            makeBreakout([makeBlock({ id: 'deep', laneIndex: 1 })], { id: 'nested-breakout' }),
            makeBlock({ id: 'nested-block' }),
          ],
          { id: 'source' },
        ),
      ]);

      duplicate('source');

      const ids = allIds(plan.items);
      expect(ids).toHaveLength(8);
      expect(new Set(ids).size).toBe(8);
      expect(allIds([plan.items[0]])).toEqual(['source', 'nested-breakout', 'deep', 'nested-block']);
      expect(plan.items[1].children?.[0].children?.[0]).toMatchObject({ laneIndex: 1 });
    });
  });

  describe('inside a group', () => {
    it('inserts the copy after the child with every setting and updates the group duration', () => {
      const plan = renderPlan([
        makeGroup(
          [
            makeBlock({ id: 'source', title: 'Child', ...everySetting }),
            makeBlock({ id: 'after', duration: 5 }),
          ],
          { id: 'group', duration: 30 },
        ),
        makeBlock({ id: 'outside' }),
      ]);

      duplicate('source');

      const [group, outside] = plan.items;
      expect(outside.id).toBe('outside');
      expect(group.children?.map((child) => child.id)).toEqual(['source', group.children?.[1].id, 'after']);
      expect(group.children?.[1]).toMatchObject(everySetting);
      expect(group.duration).toBe(55);
      expect(new Set(allIds(plan.items)).size).toBe(5);
    });

    it('gives a duplicated nested breakout new IDs and keeps its rooms', () => {
      const plan = renderPlan([
        makeGroup(
          [makeBreakout([makeBlock({ id: 'deep', laneIndex: 1 })], { id: 'source', lanes: 3 })],
          { id: 'group' },
        ),
      ]);

      duplicate('source');

      const copy = plan.items[0].children?.[1];
      expect(copy).toMatchObject({ type: 'breakout', lanes: 3 });
      expect(copy?.children?.[0]).toMatchObject({ laneIndex: 1 });
      expect(copy?.children?.[0].id).not.toBe('deep');
      expect(new Set(allIds(plan.items)).size).toBe(5);
    });
  });

  describe('inside a breakout lane', () => {
    it('stays in its room, directly after the original', () => {
      const plan = renderPlan([
        makeBreakout(
          [
            makeBlock({ id: 'room-1', laneIndex: 0 }),
            makeBlock({ id: 'source', title: 'Lane child', laneIndex: 2, ...everySetting }),
            makeBlock({ id: 'after', laneIndex: 2 }),
          ],
          { id: 'breakout', lanes: 3 },
        ),
      ]);

      duplicate('source');

      const children = plan.items[0].children ?? [];
      expect(children.map((child) => child.laneIndex)).toEqual([0, 2, 2, 2]);
      expect(children.map((child) => child.id)).toEqual(['room-1', 'source', children[2].id, 'after']);
      expect(children[2]).toMatchObject(everySetting);
      expect(new Set(allIds(plan.items)).size).toBe(5);
    });

    it('stays in its room when the breakout is itself inside a group', () => {
      const plan = renderPlan([
        makeGroup(
          [makeBreakout([makeBlock({ id: 'source', laneIndex: 1 })], { id: 'breakout', lanes: 2 })],
          { id: 'group' },
        ),
      ]);

      duplicate('source');

      const children = plan.items[0].children?.[0].children ?? [];
      expect(children.map((child) => child.laneIndex)).toEqual([1, 1]);
      expect(new Set(allIds(plan.items)).size).toBe(4);
    });
  });

  describe('a fixed start time', () => {
    it('stays with the original, so the copy follows it instead of overlapping it', () => {
      const plan = renderPlan([
        makeBlock({ id: 'source', duration: 30, fixedStartTime: '10:00' }),
        makeBlock({ id: 'after', duration: 10 }),
      ]);

      duplicate('source');

      expect(plan.items[0].fixedStartTime).toBe('10:00');
      expect(plan.items[1]).not.toHaveProperty('fixedStartTime');
      expect(plan.items.map((_, index) => calculateBlockTime('09:00', plan.items, index))).toEqual([
        '10:00',
        '10:30',
        '11:00',
      ]);
    });

    it('is dropped from nested items of the copy too', () => {
      const plan = renderPlan([
        makeGroup(
          [
            makeBlock({ id: 'child', duration: 10, fixedStartTime: '09:15' }),
            makeBreakout([makeBlock({ id: 'deep', laneIndex: 1, fixedStartTime: '09:30' })], { id: 'nested' }),
          ],
          { id: 'source', fixedStartTime: '09:15' },
        ),
      ]);

      duplicate('source');

      const [original, copy] = plan.items;
      expect(original.fixedStartTime).toBe('09:15');
      expect(original.children?.[0].fixedStartTime).toBe('09:15');
      expect(original.children?.[1].children?.[0].fixedStartTime).toBe('09:30');
      expect(JSON.stringify(copy)).not.toContain('fixedStartTime');
    });
  });
});
