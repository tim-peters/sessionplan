import type { BlockType, Person, WorkshopItem } from '@/types/workshop';
import { calculateBlockTime, calculateNestedBlockTime, findItemById } from '@/lib/workshopUtils';
import type { PlayState } from '@/lib/playModeUtils';

/** Callbacks a group or breakout card forwards for its children, addressed by child ID. */
export interface ChildItemCallbacks {
  onUpdateChild?: (childId: string, updates: Partial<WorkshopItem>) => void;
  onDeleteChild?: (childId: string) => void;
  onDuplicateChild?: (childId: string) => void;
  onSaveChildToLibrary?: (childId: string) => void;
  onEditChildDetails?: (childId: string) => void;
  onEditChildDetailsOnTime?: (childId: string) => void;
  onCalculateChildTime?: (parentItem: WorkshopItem, childIndex: number) => string | null;
  onCreateBelowChild?: (childId: string) => void;
  onDeleteChildAndFocusPrev?: (childId: string) => void;
}

/** The card-level actions of one child, bound from its parent's callbacks. */
export const bindChildActions = (child: WorkshopItem, callbacks: ChildItemCallbacks) => ({
  onUpdate: (updates: Partial<WorkshopItem>) => callbacks.onUpdateChild?.(child.id, updates),
  onDelete: () => callbacks.onDeleteChild?.(child.id),
  onDuplicate: () => callbacks.onDuplicateChild?.(child.id),
  onSaveToLibrary: () => callbacks.onSaveChildToLibrary?.(child.id),
  onEditDetails: () => callbacks.onEditChildDetails?.(child.id),
  // Left undefined so that the card falls back to opening the details normally.
  onEditDetailsOnTime: callbacks.onEditChildDetailsOnTime && (() => callbacks.onEditChildDetailsOnTime?.(child.id)),
});

/** `bindChildActions` plus the title-field keyboard actions of a block. */
export const bindChildBlockActions = (child: WorkshopItem, callbacks: ChildItemCallbacks) => ({
  ...bindChildActions(child, callbacks),
  onCreateBelow: (item: WorkshopItem) => callbacks.onCreateBelowChild?.(item.id),
  onDeleteAndFocusPrev: (item: WorkshopItem) => callbacks.onDeleteChildAndFocusPrev?.(item.id),
});

export interface ContainerCardProps extends ChildItemCallbacks {
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
  onEditDetailsOnTime: () => void;
  onCreateBelow: (item: WorkshopItem) => void;
  onDeleteAndFocusPrev: (item: WorkshopItem) => void;
  onAddChild: (type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  onAddToChild: (childId: string, type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  playState?: PlayState;
  childPlayStates?: Map<string, PlayState>;
}

export interface TimelineItemHandlers {
  onUpdateItem: (id: string, updates: Partial<WorkshopItem>) => void;
  onDeleteItem: (id: string) => void;
  onDuplicate: (item: WorkshopItem) => void;
  onSaveToLibrary: (item: WorkshopItem) => void;
  openEditDialog: (item: WorkshopItem, focusField?: 'fixedStartTime') => void;
  onAddChildBlock: (parentId: string, laneIndex?: number) => void;
  onAddChildBreakout: (parentId: string) => void;
  onCreateBelow: (item: WorkshopItem) => void;
  onDeleteAndFocusPrev: (item: WorkshopItem) => void;
}

/** Binds the props of a group or breakout card at the top level of the timeline. */
export const bindContainerCardProps = (
  item: WorkshopItem,
  index: number,
  items: WorkshopItem[],
  startTime: string | null,
  handlers: TimelineItemHandlers,
  shared: {
    blockTypes: BlockType[];
    persons: Person[];
    showFullPreviewText: boolean;
    blockPlayStates?: Map<string, PlayState>;
  },
): ContainerCardProps => {
  const timeDisplay = calculateBlockTime(startTime, items, index);

  const withChild = (action: (child: WorkshopItem) => void) => (childId: string) => {
    const child = findItemById(items, childId);
    if (child) action(child);
  };

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
    onCreateBelow: handlers.onCreateBelow,
    onDeleteAndFocusPrev: handlers.onDeleteAndFocusPrev,
    onAddChild: (type, laneIndex) => {
      if (type === 'block') handlers.onAddChildBlock(item.id, laneIndex);
      else if (type === 'breakout') handlers.onAddChildBreakout(item.id);
    },
    onAddToChild: (childId, type, laneIndex) => {
      if (type === 'block') handlers.onAddChildBlock(childId, laneIndex);
    },
    onUpdateChild: handlers.onUpdateItem,
    onDeleteChild: handlers.onDeleteItem,
    onDuplicateChild: withChild(handlers.onDuplicate),
    onSaveChildToLibrary: withChild(handlers.onSaveToLibrary),
    onEditChildDetails: withChild((child) => handlers.openEditDialog(child)),
    onEditChildDetailsOnTime: withChild((child) => handlers.openEditDialog(child, 'fixedStartTime')),
    onCalculateChildTime: (parentItem, childIndex) => calculateNestedBlockTime(timeDisplay, parentItem, childIndex),
    onCreateBelowChild: withChild(handlers.onCreateBelow),
    onDeleteChildAndFocusPrev: withChild(handlers.onDeleteAndFocusPrev),
    playState: shared.blockPlayStates?.get(item.id),
    childPlayStates: shared.blockPlayStates,
  };
};
