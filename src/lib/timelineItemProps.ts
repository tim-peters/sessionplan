import { DragEndEvent } from '@dnd-kit/core';
import { BlockType, Person, WorkshopItem } from '@/types/workshop';
import { calculateBlockTime } from '@/lib/workshopStorage';
import { findItemById } from '@/lib/workshopUtils';
import { PlayState } from '@/lib/playModeUtils';

export interface ItemProps {
  item: WorkshopItem;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText: boolean;
  timeDisplay: string | null;
  onUpdate: (updates: Partial<WorkshopItem>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => void;
  onEditDetails: () => void;
  onEditDetailsOnTime?: () => void;
  onCreateBelow?: (item: WorkshopItem) => void;
  onDeleteAndFocusPrev?: (item: WorkshopItem) => void;
  onAddChild?: (type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  onAddToChild?: (childId: string, type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  onUpdateChild?: (childId: string, updates: Partial<WorkshopItem>) => void;
  onDeleteChild?: (childId: string) => void;
  onDuplicateChild?: (childId: string) => void;
  onSaveChildToLibrary?: (childId: string) => void;
  onEditChildDetails?: (childId: string) => void;
  onEditChildDetailsOnTime?: (childId: string) => void;
  onCalculateChildTime?: (parentItem: WorkshopItem, childIndex: number) => string | null;
  onCreateBelowChild?: (childId: string) => void;
  onDeleteChildAndFocusPrev?: (childId: string) => void;
  onMoveItem: (itemId: string, targetParentId: string | null, targetIndex?: number) => void;
  dropIndicator: { overId: string; position: 'before' | 'after' } | null;
  playState?: PlayState;
  childPlayStates?: Map<string, PlayState>;
  blockPlayStates?: Map<string, PlayState>;
  parentId?: string | null;
  isNested?: boolean;
  depth?: number;
}

/**
 * Bind the standard 25-item prop set to a top-level timeline item.
 * Used by the items.map() body to forward the same handlers to GroupCard /
 * BreakoutCard / BlockCard regardless of item type.
 */
export const bindItemProps = (
  item: WorkshopItem,
  index: number,
  items: WorkshopItem[],
  startTime: string | null,
  handlers: {
    onUpdateItem: (id: string, updates: Partial<WorkshopItem>) => void;
    onDeleteItem: (id: string) => void;
    onDuplicate: (item: WorkshopItem) => void;
    onSaveToLibrary: (item: WorkshopItem) => void;
    openEditDialog: (item: WorkshopItem, focusField?: 'fixedStartTime') => void;
    handleAddChildBlock: (parentId: string, laneIndex?: number) => void;
    handleAddChildBreakout: (parentId: string) => void;
    onUpdateChild: (childId: string, updates: Partial<WorkshopItem>) => void;
    onDeleteChild: (childId: string) => void;
    onDuplicateChild: (child: WorkshopItem) => void;
    onSaveChildToLibrary: (child: WorkshopItem) => void;
    onEditChildDetails: (child: WorkshopItem) => void;
    onEditChildDetailsOnTime: (child: WorkshopItem, focusField?: 'fixedStartTime') => void;
    calculateNestedBlockTime: (
      parentTime: string | null,
      parentItem: WorkshopItem,
      childIndex: number,
    ) => string | null;
    handleCreateBelow: (item: WorkshopItem) => void;
    handleDeleteAndFocusPrev: (item: WorkshopItem) => void;
    onCreateBelowChild: (child: WorkshopItem) => void;
    onDeleteChildAndFocusPrev: (child: WorkshopItem) => void;
    onMoveItem: (itemId: string, targetParentId: string | null, targetIndex?: number) => void;
  },
  shared: {
    blockTypes: BlockType[];
    persons: Person[];
    showFullPreviewText: boolean;
    dropIndicator: { overId: string; position: 'before' | 'after' } | null;
    blockPlayStates?: Map<string, PlayState>;
    childPlayStates?: Map<string, PlayState>;
  },
): ItemProps => {
  const parentTime = calculateBlockTime(startTime, items, index);
  const timeDisplay = parentTime;

  const findChild = (childId: string) => findItemById(items, childId);

  return {
    item,
    blockTypes: shared.blockTypes,
    persons: shared.persons,
    showFullPreviewText: shared.showFullPreviewText,
    timeDisplay,
    onUpdate: (updates) => handlers.onUpdateItem(item.id, updates),
    onDelete: () => handlers.onDeleteItem(item.id),
    onDuplicate: () => handlers.onDuplicate(item),
    onSaveToLibrary: () => handlers.onSaveToLibrary(item),
    onEditDetails: () => handlers.openEditDialog(item),
    onEditDetailsOnTime: () => handlers.openEditDialog(item, 'fixedStartTime'),
    onCreateBelow: handlers.handleCreateBelow,
    onDeleteAndFocusPrev: handlers.handleDeleteAndFocusPrev,
    onAddChild: (type, laneIndex) => {
      if (type === 'block') handlers.handleAddChildBlock(item.id, laneIndex);
      else if (type === 'breakout') handlers.handleAddChildBreakout(item.id);
    },
    onAddToChild: (childId, type, laneIndex) => {
      if (type === 'block') handlers.handleAddChildBlock(childId, laneIndex);
    },
    onUpdateChild: handlers.onUpdateChild,
    onDeleteChild: handlers.onDeleteChild,
    onDuplicateChild: (childId) => {
      const child = findChild(childId);
      if (child) handlers.onDuplicateChild(child);
    },
    onSaveChildToLibrary: (childId) => {
      const child = findChild(childId);
      if (child) handlers.onSaveChildToLibrary(child);
    },
    onEditChildDetails: (childId) => {
      const child = findChild(childId);
      if (child) handlers.onEditChildDetails(child);
    },
    onEditChildDetailsOnTime: (childId) => {
      const child = findChild(childId);
      if (child) handlers.onEditChildDetailsOnTime(child);
    },
    onCalculateChildTime: (parentItem, childIndex) =>
      handlers.calculateNestedBlockTime(parentTime, parentItem, childIndex),
    onCreateBelowChild: (childId) => {
      const child = findChild(childId);
      if (child) handlers.onCreateBelowChild(child);
    },
    onDeleteChildAndFocusPrev: (childId) => {
      const child = findChild(childId);
      if (child) handlers.onDeleteChildAndFocusPrev(child);
    },
    onMoveItem: handlers.onMoveItem,
    dropIndicator: shared.dropIndicator,
    playState: shared.blockPlayStates?.get(item.id),
    childPlayStates: shared.childPlayStates,
    blockPlayStates: shared.blockPlayStates,
    parentId: null,
    isNested: false,
    depth: 0,
  };
};

// Suppress unused-imports for DragEndEvent if it becomes unused after the refactor.
// Keeping the import so this file can grow into a typed handlers module.
export type _UnusedDragEndEvent = DragEndEvent;
