/**
 * useTimelineItemActions — Item creation, duplication and keyboard-driven
 * deletion for the timeline.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { focusBlockTitleInput, focusLastBlockTitleInput, scrollToLastBlock } from '@/lib/domUtils';
import {
  createDuplicateOf,
  createNewBlock,
  createNewBreakout,
  createNewGroup,
  createNewItem,
  findItemAndParent,
  findItemById,
} from '@/lib/workshopUtils';
import type { WorkshopItem } from '@/types/workshop';

// Whole-statement tracking calls: the public export strips them line by line.
const trackItemCreated = (type: WorkshopItem['type']) => {
};

const trackItemDuplicated = (type: WorkshopItem['type']) => {
};

/** Delay that lets the deleted item's row leave before the previous title takes focus. */
const FOCUS_PREVIOUS_DELAY_MS = 150;

interface UseTimelineItemActionsArgs {
  items: WorkshopItem[];
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<WorkshopItem, 'id'>, parentId?: string) => void;
  onInsertItemAfter: (afterId: string, item: Omit<WorkshopItem, 'id'>) => string | null;
}

interface TimelineItemActions {
  handleAddBlock: () => void;
  handleAddGroup: () => void;
  handleAddBreakout: () => void;
  handleCreateBelow: (reference: WorkshopItem) => void;
  handleDeleteAndFocusPrev: (item: WorkshopItem) => void;
  handleAddChildBlock: (parentId: string, laneIndex?: number) => void;
  handleAddChildBreakout: (parentId: string) => void;
  handleDuplicate: (item: WorkshopItem) => void;
}

/** The sibling before `item`: top-level, within its group, or within its breakout lane. */
const findPreviousSiblingId = (items: WorkshopItem[], item: WorkshopItem): string | null => {
  const { parentId } = findItemAndParent(items, item.id);
  const parent = parentId === null ? null : findItemById(items, parentId);
  if (parentId !== null && !parent?.children) return null;

  const siblings = parent?.children ?? items;
  const sameTrack = parent?.type === 'breakout'
    ? siblings.filter((sibling) => (sibling.laneIndex ?? 0) === (item.laneIndex ?? 0))
    : siblings;
  const index = sameTrack.findIndex((sibling) => sibling.id === item.id);
  return index > 0 ? sameTrack[index - 1].id : null;
};

export const useTimelineItemActions = ({
  items,
  onDeleteItem,
  onAddItem,
  onInsertItemAfter,
}: UseTimelineItemActionsArgs): TimelineItemActions => {
  const { t } = useTranslation('common');

  const addAtEnd = useCallback((item: Omit<WorkshopItem, 'id'>) => {
    onAddItem(item);
    trackItemCreated(item.type);
    focusLastBlockTitleInput();
    scrollToLastBlock();
  }, [onAddItem]);

  const handleAddBlock = useCallback(() => addAtEnd(createNewBlock(t)), [addAtEnd, t]);
  const handleAddGroup = useCallback(() => addAtEnd(createNewGroup(t)), [addAtEnd, t]);
  const handleAddBreakout = useCallback(() => addAtEnd(createNewBreakout(t)), [addAtEnd, t]);

  const handleCreateBelow = useCallback((reference: WorkshopItem) => {
    const newId = onInsertItemAfter(reference.id, createNewItem(reference.type, t));
    if (newId) {
      trackItemCreated(reference.type);
      focusBlockTitleInput(newId);
    }
  }, [onInsertItemAfter, t]);

  /** Backspace on an empty title. No-op without a previous sibling to move the focus to. */
  const handleDeleteAndFocusPrev = useCallback((item: WorkshopItem) => {
    const prevId = findPreviousSiblingId(items, item);
    if (!prevId) return;

    onDeleteItem(item.id);
    focusBlockTitleInput(prevId, FOCUS_PREVIOUS_DELAY_MS);
  }, [items, onDeleteItem]);

  const handleAddChildBlock = useCallback((parentId: string, laneIndex?: number) => {
    onAddItem({ ...createNewBlock(t), ...(laneIndex !== undefined && { laneIndex }) }, parentId);
  }, [onAddItem, t]);

  const handleAddChildBreakout = useCallback((parentId: string) => {
    onAddItem(createNewBreakout(t), parentId);
  }, [onAddItem, t]);

  const handleDuplicate = useCallback((item: WorkshopItem) => {
    if (!onInsertItemAfter(item.id, createDuplicateOf(item, t))) return;

    trackItemDuplicated(item.type);
  }, [onInsertItemAfter, t]);

  return {
    handleAddBlock,
    handleAddGroup,
    handleAddBreakout,
    handleCreateBelow,
    handleDeleteAndFocusPrev,
    handleAddChildBlock,
    handleAddChildBreakout,
    handleDuplicate,
  };
};
