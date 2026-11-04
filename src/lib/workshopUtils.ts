/**
 * workshopUtils — Pure tree-traversal and duration utilities for WorkshopItem[].
 *
 * Role: All recursive operations on the workshop item tree (find, update, remove,
 *       duration aggregation), clock times of items, and the items that the
 *       add actions create. No React, no side effects.
 * Used by: useWorkshop, useDragHandlers, the planner and timeline
 */
import { WorkshopData, WorkshopItem, BlockType, DEFAULT_WORKSHOP_TITLE, generateId } from '@/types/workshop';
import { DEFAULT_BLOCK_DURATION, DEFAULT_BREAKOUT_DURATION, DEFAULT_LANES } from '@/lib/workshopDefaults';
import { minutesToTime, timeToMinutes } from '@/lib/clock-time';
import type { TFunction } from 'i18next';

// Frozen: the stored names that mark a built-in block type as not renamed in
// existing plans and share links. These are not translations (those live in
// public/locales), so changing a translation or adding a language leaves this
// list untouched. Never change or remove existing entries.
const UNCUSTOMIZED_BLOCK_TYPE_NAMES = new Map<string, readonly string[]>([
  ['input', ['🎤 Vortrag/Input', '🎤 Lecture/Input']],
  ['activity', ['🏃 Übung/Aktivität', '🏃 Exercise/Activity']],
  ['discussion', ['💬 Diskussion', '💬 Discussion']],
  ['break', ['☕ Pause', '☕ Break']],
  ['energizer', ['⚡ Energizer']],
]);

/**
 * Returns the display name for a block type.
 * For a built-in block type that was not renamed, returns the locale-translated name.
 * For renamed and user-created block types, returns the stored name.
 */
export const getBlockTypeName = (type: BlockType, t: TFunction): string => {
  return UNCUSTOMIZED_BLOCK_TYPE_NAMES.get(type.id)?.includes(type.name)
    ? t(`blockTypes.${type.id}`)
    : type.name;
};

/**
 * Returns the display title for a workshop. The built-in default is translated,
 * while titles entered by the user are returned unchanged.
 */
export const getWorkshopTitle = (title: string, t: TFunction): string => {
  return title === DEFAULT_WORKSHOP_TITLE ? t('planner.defaultWorkshopTitle') : title;
};

/**
 * Returns a copy of the workshop with its title and block type names as they
 * are displayed, for exports that show names to people. Never persist the result.
 */
export const withDisplayNames = (data: WorkshopData, t: TFunction): WorkshopData => ({
  ...data,
  workshop: { ...data.workshop, title: getWorkshopTitle(data.workshop.title, t) },
  blockTypes: data.blockTypes.map((type) => ({ ...type, name: getBlockTypeName(type, t) })),
});

/**
 * Finds an item by ID in a nested item structure
 */
export const findItemById = (
  items: WorkshopItem[],
  id: string
): WorkshopItem | null => {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Finds an item and its parent ID in a nested structure
 */
export const findItemAndParent = (
  items: WorkshopItem[],
  id: string,
  parentId: string | null = null
): { item: WorkshopItem | null; parentId: string | null } => {
  for (const item of items) {
    if (item.id === id) {
      return { item, parentId };
    }
    if (item.children) {
      const result = findItemAndParent(item.children, id, item.id);
      if (result.item) return result;
    }
  }
  return { item: null, parentId: null };
};

/**
 * Finds the parent ID of an item
 */
export const findParentId = (
  items: WorkshopItem[],
  targetId: string,
  parentId: string | null = null
): string | null | undefined => {
  for (const item of items) {
    if (item.id === targetId) return parentId;
    if (item.children) {
      const result = findParentId(item.children, targetId, item.id);
      if (result !== undefined) return result;
    }
  }
  return undefined;
};

/**
 * Updates an item deeply in the nested structure
 */
export const updateItemInTree = (
  items: WorkshopItem[],
  id: string,
  updates: Partial<WorkshopItem>
): WorkshopItem[] => {
  return items.map(item => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    if (item.children) {
      return { ...item, children: updateItemInTree(item.children, id, updates) };
    }
    return item;
  });
};

/**
 * Removes an item from the nested structure
 */
export const removeItemFromTree = (
  items: WorkshopItem[],
  id: string
): WorkshopItem[] => {
  return items
    .filter(item => item.id !== id)
    .map(item => {
      if (item.children) {
        return { ...item, children: removeItemFromTree(item.children, id) };
      }
      return item;
    });
};

/**
 * Gets the index of an item in a flat list
 */
export const getItemIndex = (items: WorkshopItem[], id: string): number => {
  return items.findIndex(item => item.id === id);
};

/**
 * Calculates the total duration of children in a group.
 * For breakouts, uses their duration directly (parallel time).
 * For blocks, sums their durations (sequential time).
 */
export const calculateChildrenDuration = (children?: WorkshopItem[]): number => {
  if (!children || children.length === 0) return 0;
  return children.reduce((sum, child) => {
    // For breakouts, use their duration directly (parallel time, not sum of children)
    // For blocks and groups, add their duration (sequential time)
    return sum + child.duration;
  }, 0);
};

/**
 * Calculates the maximum duration across all lanes in a breakout
 */
export const calculateBreakoutDuration = (item: WorkshopItem): number => {
  if (!item.children || item.children.length === 0) return 0;
  
  const lanes = item.lanes || 2;
  const laneDurations: number[] = [];
  
  // Calculate duration for each lane
  for (let laneIndex = 0; laneIndex < lanes; laneIndex++) {
    const laneChildren = item.children.filter(child => (child.laneIndex ?? 0) === laneIndex);
    const laneDuration = laneChildren.reduce((sum, child) => sum + child.duration, 0);
    laneDurations.push(laneDuration);
  }
  
  // Return the maximum duration across all lanes
  return Math.max(...laneDurations, 0);
};

/**
 * Updates group and breakout duration based on children, if not locked
 */
export const updateGroupDurations = (items: WorkshopItem[]): WorkshopItem[] => {
  return items.map(item => {
    // Update children first (recursive)
    const updatedItem = item.children 
      ? { ...item, children: updateGroupDurations(item.children) }
      : item;
    
    // Update duration if it's a group and not locked
    if (updatedItem.type === 'group' && !updatedItem.durationLocked && updatedItem.children) {
      const childrenDuration = calculateChildrenDuration(updatedItem.children);
      return { ...updatedItem, duration: childrenDuration };
    }
    
    // Update duration if it's a breakout and not locked
    if (updatedItem.type === 'breakout' && !updatedItem.durationLocked && updatedItem.children) {
      const maxLaneDuration = calculateBreakoutDuration(updatedItem);
      return { ...updatedItem, duration: maxLaneDuration };
    }
    
    return updatedItem;
  });
};

/** The block a sidebar block type creates, whether it is clicked, dragged or added by shortcut. */
export const createBlockOfType = (blockType: BlockType, t: TFunction): Omit<WorkshopItem, 'id'> => ({
  type: 'block',
  blockTypeId: blockType.id,
  title: getBlockTypeName(blockType, t),
  duration: DEFAULT_BLOCK_DURATION,
  notes: '',
  material: '',
});

/** A new untyped block with its default title and duration. */
export const createNewBlock = (t: TFunction): Omit<WorkshopItem, 'id'> => ({
  type: 'block',
  blockTypeId: null,
  title: t('block.newBlock'),
  duration: DEFAULT_BLOCK_DURATION,
  notes: '',
  material: '',
});

/** A new empty group, its duration following its children. */
export const createNewGroup = (t: TFunction): Omit<WorkshopItem, 'id'> => ({
  type: 'group',
  blockTypeId: null,
  title: t('block.newGroup'),
  duration: 0,
  notes: '',
  material: '',
  children: [],
  durationLocked: false,
});

/** A new empty breakout with the default number of rooms. */
export const createNewBreakout = (t: TFunction): Omit<WorkshopItem, 'id'> => ({
  type: 'breakout',
  blockTypeId: null,
  title: t('block.newBreakout'),
  duration: DEFAULT_BREAKOUT_DURATION,
  notes: '',
  material: '',
  children: [],
  parallel: true,
  lanes: DEFAULT_LANES,
  sameInAllBreakouts: false,
});

const NEW_ITEM_FACTORIES = { block: createNewBlock, group: createNewGroup, breakout: createNewBreakout };

export const createNewItem = (type: WorkshopItem['type'], t: TFunction): Omit<WorkshopItem, 'id'> =>
  NEW_ITEM_FACTORIES[type](t);

const copyWithNewIds = (item: WorkshopItem): WorkshopItem => ({
  ...item,
  id: generateId(),
  ...(item.children ? { children: item.children.map(copyWithNewIds) } : {}),
});

/**
 * The item a library entry creates, whether it is clicked or dragged. Keeps all
 * of its settings, gives every nested item its own ID so that an entry can be
 * added repeatedly, and leaves the room to the place it is dropped in.
 */
export const createItemFromLibrary = (libraryItem: WorkshopItem): Omit<WorkshopItem, 'id'> => {
  const { id: _id, laneIndex: _laneIndex, ...item } = copyWithNewIds(libraryItem);
  return item;
};

const withoutFixedStartTimes = ({ fixedStartTime: _fixedStartTime, ...item }: WorkshopItem): WorkshopItem => ({
  ...item,
  ...(item.children ? { children: item.children.map(withoutFixedStartTimes) } : {}),
});

/**
 * The copy "Duplicate" inserts directly after `item`. Keeps all of its settings
 * and its room, and gives every nested item its own ID. Fixed start times stay
 * with the original at every depth: the copy comes after the original, so the
 * same clock time would snap it back on top of it and hide the time it takes.
 */
export const createDuplicateOf = (item: WorkshopItem, t: TFunction): Omit<WorkshopItem, 'id'> => {
  const { id: _id, ...copy } = copyWithNewIds(withoutFixedStartTimes(item));
  return { ...copy, title: `${item.title} ${t('block.copy')}` };
};

/** Reads a duration from a number input: empty, invalid and negative input all become 0. */
export const parseDuration = (value: string): number => Math.max(0, parseInt(value) || 0);

const hasNegativeDuration = (items: WorkshopItem[] | null | undefined): boolean =>
  !!items?.some((item) => item.duration < 0 || hasNegativeDuration(item.children));

const clampItemDurations = (items: WorkshopItem[]): WorkshopItem[] =>
  items.map((item) => {
    const clamped = item.duration < 0 ? { ...item, duration: 0 } : item;
    return clamped.children ? { ...clamped, children: clampItemDurations(clamped.children) } : clamped;
  });

type WithTargetDuration = { targetDuration?: number | null };

const hasNegativeTarget = (meta: WithTargetDuration | null | undefined): boolean =>
  (meta?.targetDuration ?? 0) < 0;

const clampTargetDuration = <T extends WithTargetDuration>(meta: T): T =>
  hasNegativeTarget(meta) ? { ...meta, targetDuration: 0 } : meta;

/**
 * Repairs plans from links, files and Dynamic Links that were saved with a
 * negative item or target duration. Plans without one are returned unchanged,
 * so that their links stay byte-identical.
 */
export const withoutNegativeDurations = (data: WorkshopData): WorkshopData => {
  const repair = <T extends WorkshopItem[] | null | undefined>(items: T): T =>
    (hasNegativeDuration(items) ? updateGroupDurations(clampItemDurations(items!)) : items) as T;

  const isClean =
    !hasNegativeDuration(data.items) &&
    !hasNegativeTarget(data.workshop) &&
    !data.days?.some((day) => hasNegativeDuration(day.items) || hasNegativeTarget(day));
  if (isClean) return data;

  return {
    ...data,
    workshop: clampTargetDuration(data.workshop),
    items: repair(data.items),
    ...(data.days ? { days: data.days.map((day) => clampTargetDuration({ ...day, items: repair(day.items) })) } : {}),
  };
};

/**
 * Recursively calculates the total duration of a workshop item tree.
 * Groups recurse into children; blocks/breakouts use their stored duration.
 */
export const calculateTotalDuration = (items: WorkshopItem[]): number => {
  return items.reduce((total, item) => total + item.duration, 0);
};

/** Calculates the absolute clock time for a block at a given index. */
export const calculateBlockTime = (
  startTime: string | null,
  items: WorkshopItem[],
  targetIndex: number
): string | null => {
  // If this item itself has a fixed start time, return it directly
  if (items[targetIndex]?.fixedStartTime) {
    return items[targetIndex].fixedStartTime!;
  }

  // Find the last fixed-time anchor before targetIndex
  let anchorIndex = -1;
  for (let i = targetIndex - 1; i >= 0; i--) {
    if (items[i]?.fixedStartTime) {
      anchorIndex = i;
      break;
    }
  }

  // Base time: last fixed anchor, or workshop start time
  const baseTime = anchorIndex >= 0 ? items[anchorIndex].fixedStartTime! : startTime;
  if (!baseTime) return null;

  let totalMinutes = timeToMinutes(baseTime);

  // Accumulate durations from anchor (or index 0) up to targetIndex - 1
  const startFrom = anchorIndex >= 0 ? anchorIndex : 0;
  for (let i = startFrom; i < targetIndex; i++) {
    totalMinutes += items[i].duration;
  }

  return minutesToTime(totalMinutes);
};

/**
 * Clock time of a child within its group or breakout. Starts at the parent's
 * time or the child's last fixed anchor; in a breakout only its own lane counts.
 */
export const calculateNestedBlockTime = (
  parentTime: string | null,
  parentItem: WorkshopItem,
  childIndex: number,
): string | null => {
  if (!parentItem.children) return null;
  const child = parentItem.children[childIndex];
  if (child?.fixedStartTime) return child.fixedStartTime;
  if (!parentTime) return null;

  const laneIndex = child?.laneIndex ?? 0;
  const isSameTrack = (other: WorkshopItem) =>
    parentItem.type !== 'breakout' || (other.laneIndex ?? 0) === laneIndex;

  let anchorIndex = -1;
  for (let i = childIndex - 1; i >= 0; i--) {
    const previous = parentItem.children[i];
    if (previous?.fixedStartTime && isSameTrack(previous)) {
      anchorIndex = i;
      break;
    }
  }

  const baseTime = anchorIndex >= 0 ? parentItem.children[anchorIndex].fixedStartTime! : parentTime;
  let totalMinutes = timeToMinutes(baseTime);
  for (let i = Math.max(anchorIndex, 0); i < childIndex; i++) {
    const previous = parentItem.children[i];
    if (isSameTrack(previous)) totalMinutes += previous.duration;
  }
  return minutesToTime(totalMinutes);
};

/** Clock time at which the last item ends; null without a start time or items. */
export const calculateEndTime = (startTime: string | null, items: WorkshopItem[]): string | null => {
  if (!startTime || items.length === 0) return null;
  const lastIndex = items.length - 1;
  const lastStart = calculateBlockTime(startTime, items, lastIndex);
  if (!lastStart) return null;
  return minutesToTime(timeToMinutes(lastStart) + items[lastIndex].duration);
};

/**
 * Minutes between a fixed start time and the end of what precedes it: the
 * reference time plus its duration. Null if the item has no fixed start time
 * or the reference time is unknown.
 */
export const calculateFixedStartGap = (
  fixedStartTime: string | undefined,
  referenceTime: string | null | undefined,
  referenceDuration = 0,
): number | null => {
  if (!fixedStartTime || !referenceTime) return null;
  return timeToMinutes(fixedStartTime) - (timeToMinutes(referenceTime) + referenceDuration);
};

/**
 * Effective total duration, including any buffers/gaps created by fixedStartTime anchors.
 * Computes the wall-clock span from startTime to the end of the last item.
 * Falls back to a simple sum when startTime is not set.
 */
export const calculateEffectiveDuration = (
  items: WorkshopItem[],
  startTime: string | null
): number => {
  if (items.length === 0) return 0;
  if (!startTime) return items.reduce((total, item) => total + item.duration, 0);

  const lastIndex = items.length - 1;
  const lastStartStr = calculateBlockTime(startTime, items, lastIndex);
  if (!lastStartStr) return items.reduce((total, item) => total + item.duration, 0);

  return timeToMinutes(lastStartStr) - timeToMinutes(startTime) + items[lastIndex].duration;
};
