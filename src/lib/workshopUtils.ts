/**
 * workshopUtils — Pure tree-traversal and duration utilities for WorkshopItem[].
 *
 * Role: All recursive operations on the workshop item tree (find, update, remove,
 *       duration aggregation) live here. No React, no side effects.
 * Used by: useWorkshop, WorkshopPlanner drag handlers
 */
import { WorkshopItem, BlockType, DEFAULT_WORKSHOP_TITLE } from '@/types/workshop';
import type { TFunction } from 'i18next';

// Well-known default block type IDs that have locale translations
const DEFAULT_BLOCK_TYPE_KEYS: Record<string, string> = {
  input: 'blockTypes.input',
  activity: 'blockTypes.activity',
  break: 'blockTypes.break',
  discussion: 'blockTypes.discussion',
  energizer: 'blockTypes.energizer',
};

/**
 * Returns the display name for a block type.
 * For the 5 built-in IDs, returns the locale-translated name.
 * For user-created block types, returns the stored name.
 */
export const getBlockTypeName = (type: BlockType, t: TFunction): string => {
  const key = DEFAULT_BLOCK_TYPE_KEYS[type.id];
  return key ? t(key) : type.name;
};

/**
 * Returns the display title for a workshop. The built-in default is translated,
 * while titles entered by the user are returned unchanged.
 */
export const getWorkshopTitle = (title: string, t: TFunction): string => {
  return title === DEFAULT_WORKSHOP_TITLE ? t('planner.defaultWorkshopTitle') : title;
};

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

/**
 * Recursively calculates the total duration of a workshop item tree.
 * Groups recurse into children; blocks/breakouts use their stored duration.
 */
export const calculateTotalDuration = (items: WorkshopItem[]): number => {
  return items.reduce((total, item) => total + item.duration, 0);
};
