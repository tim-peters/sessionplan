/**
 * useDragHandlers — Centralised drag-and-drop state and handlers for the
 * planner's top-level DndContext. Encapsulates:
 *   - the 4 drag state fields (activeId, activeData, activeParentId, dropIndicator)
 *   - the 3 lifecycle handlers (handleDragStart, handleDragOver, handleDragEnd)
 *   - the sidebar-specific drop handler (handleSidebarDrag)
 *   - the memoised custom collision detection
 *
 */
import { useState, useCallback, useMemo } from 'react';
import { TFunction } from 'i18next';
import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
  WorkshopItem,
  generateId,
} from '@/types/workshop';
import {
  createBlockOfType,
  createItemFromLibrary,
  createNewBlock,
  createNewBreakout,
  createNewGroup,
  findItemById,
  findItemAndParent,
  findParentId,
  getItemIndex,
  getBlockTypeName,
} from '@/lib/workshopUtils';
import { createCustomCollisionDetection } from '@/lib/collisionDetection';
import {
  DROP_ZONE_BOTTOM,
  DROP_ZONE_TOP,
  getContainedItemId,
  isContainerId,
  isDropZoneId,
  isLaneId,
} from '@/lib/dndConstants';
import type { ActiveData, DropIndicator } from '@/types/dnd';

interface UseDragHandlersArgs {
  workshopItems: WorkshopItem[];
  addItem: (item: Omit<WorkshopItem, 'id'>, parentId?: string) => void;
  updateItem: (id: string, updates: Partial<WorkshopItem>) => void;
  moveItem: (
    itemId: string,
    targetParentId: string | null,
    targetIndex?: number,
    additionalUpdates?: Partial<WorkshopItem>,
  ) => void;
  reorderItems: (items: WorkshopItem[]) => void;
  t: TFunction;
}

export interface DragHandlers {
  activeId: string | null;
  activeData: ActiveData | undefined;
  activeParentId: string | null;
  dropIndicator: DropIndicator | null;
  customCollisionDetection: ReturnType<typeof createCustomCollisionDetection>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

type SidebarDragData = Exclude<ActiveData, { type: 'breakout-lane' }>;

const buildNewItem = (
  data: SidebarDragData,
  t: TFunction,
): { newBlock: Omit<WorkshopItem, 'id'>; sidebarBlockTypeName?: string } => {
  switch (data.type) {
    case 'blocktype':
      return {
        newBlock: createBlockOfType(data.blockType, t),
        sidebarBlockTypeName: getBlockTypeName(data.blockType, t),
      };
    case 'new-block':
      return { newBlock: createNewBlock(t) };
    case 'new-group':
      return { newBlock: createNewGroup(t) };
    case 'new-breakout':
      return { newBlock: createNewBreakout(t) };
    default:
      return { newBlock: createItemFromLibrary(data.item) };
  }
};

// Cards being sorted carry sortable data of their own, without one of these types.
const SIDEBAR_DRAG_TYPES: ReadonlySet<string> = new Set<SidebarDragData['type']>([
  'blocktype',
  'library',
  'new-block',
  'new-group',
  'new-breakout',
]);

const isSidebarDrag = (data: ActiveData | undefined): data is SidebarDragData =>
  !!data && SIDEBAR_DRAG_TYPES.has(data.type);

export const useDragHandlers = ({
  workshopItems,
  addItem,
  updateItem,
  moveItem,
  reorderItems,
  t,
}: UseDragHandlersArgs): DragHandlers => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<ActiveData | undefined>(undefined);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  const customCollisionDetection = useMemo(
    () => createCustomCollisionDetection(workshopItems, activeParentId),
    [workshopItems, activeParentId],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      setActiveId(id);
      setActiveData(event.active.data.current as ActiveData | undefined);

      const data = event.active.data.current as ActiveData | undefined;
      const parentId = data?.type === 'breakout-lane' ? data.parentId : findParentId(workshopItems, id);
      setActiveParentId(parentId ?? null);
    },
    [workshopItems],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;

      if (!over || !activeId) {
        setDropIndicator(null);
        return;
      }

      const overId = over.id as string;

      // Skip indicator for special drop zones (they show their own visual feedback)
      if (isLaneId(overId) || isDropZoneId(overId)) {
        setDropIndicator(null);
        return;
      }

      // Check if we're dragging from sidebar or add buttons
      const sidebarDrag = isSidebarDrag(activeData);

      if (sidebarDrag) {
        const overParentId = findParentId(workshopItems, overId);
        if (overParentId === null) {
          setDropIndicator({ overId, position: 'before' });
        } else {
          setDropIndicator(null);
        }
        return;
      }

      const overParentId = findParentId(workshopItems, overId);

      if (activeParentId !== overParentId) {
        setDropIndicator({ overId, position: 'before' });
      } else {
        setDropIndicator(null);
      }
    },
    [activeId, activeData, activeParentId, workshopItems],
  );

  const handleSidebarDrag = useCallback(
    (event: DragEndEvent, activeDataCurrent: SidebarDragData) => {
      const { over } = event;
      if (!over) return;

      const { newBlock, sidebarBlockTypeName } = buildNewItem(activeDataCurrent, t);

      const trackSidebarCreated = () => {
        if (newBlock.type === 'block') {
        } else if (newBlock.type === 'group') {
        } else if (newBlock.type === 'breakout') {
        }
      };

      const overData = over.data?.current as ActiveData | undefined;
      if (overData?.type === 'breakout-lane') {
        if (newBlock.type !== 'block') return;
        addItem(
          { ...newBlock, laneIndex: overData.laneIndex },
          overData.parentId,
        );
        trackSidebarCreated();
        return;
      }

      if (over.id === DROP_ZONE_TOP) {
        const newItems = [...workshopItems];
        const newItemWithId = { ...newBlock, id: generateId() };
        newItems.splice(0, 0, newItemWithId);
        reorderItems(newItems);
        trackSidebarCreated();
        return;
      }

      if (over.id === DROP_ZONE_BOTTOM) {
        addItem(newBlock);
        trackSidebarCreated();
        return;
      }

      if (isContainerId(over.id)) {
        const containerId = getContainedItemId(over.id as string);
        const targetContainer = findItemById(workshopItems, containerId);
        if (newBlock.type === 'group') return;
        if (newBlock.type === 'breakout' && targetContainer?.type === 'breakout') return;
        addItem(newBlock, containerId);
        trackSidebarCreated();
        return;
      }

      const targetIndex = getItemIndex(workshopItems, over.id as string);
      if (targetIndex !== -1) {
        const newItems = [...workshopItems];
        const newItemWithId = { ...newBlock, id: generateId() };
        newItems.splice(targetIndex, 0, newItemWithId);
        reorderItems(newItems);
      } else {
        addItem(newBlock);
      }
      trackSidebarCreated();
    },
    [addItem, reorderItems, workshopItems, t],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setActiveData(undefined);
      setActiveParentId(null);
      setDropIndicator(null);

      if (!over) return;

      const activeDataCurrent = active.data.current as ActiveData | undefined;
      if (isSidebarDrag(activeDataCurrent)) {
        handleSidebarDrag(event, activeDataCurrent);
        return;
      }

      if (active.id === over.id) return;

      const activeItem = findItemById(workshopItems, active.id as string);
      const isActiveContainer =
        activeItem && (activeItem.type === 'group' || activeItem.type === 'breakout');

      const overData = over.data?.current as ActiveData | undefined;
      if (overData?.type === 'breakout-lane') {
        if (isActiveContainer) return;
        moveItem(active.id as string, overData.parentId, undefined, {
          laneIndex: overData.laneIndex,
        });
        return;
      }

      if (over.id === DROP_ZONE_TOP) {
        moveItem(active.id as string, null, 0);
        return;
      }

      if (over.id === DROP_ZONE_BOTTOM) {
        moveItem(active.id as string, null, workshopItems.length);
        return;
      }

      if (isContainerId(over.id)) {
        const containerId = getContainedItemId(over.id as string);
        const targetContainer = findItemById(workshopItems, containerId);
        if (activeItem?.type === 'group') return;
        if (activeItem?.type === 'breakout' && targetContainer?.type === 'breakout') return;
        moveItem(active.id as string, containerId);
        return;
      }

      const activeContext = findItemAndParent(workshopItems, active.id as string);
      const overContext = findItemAndParent(workshopItems, over.id as string);

      if (activeContext.parentId !== overContext.parentId) {
        if (activeItem?.type === 'group' && overContext.parentId !== null) return;
        if (activeItem?.type === 'breakout' && overContext.parentId !== null) {
          const targetParent = findItemById(workshopItems, overContext.parentId);
          if (targetParent?.type === 'breakout') return;
        }

        let targetIndex: number | undefined;
        if (overContext.parentId === null) {
          targetIndex = getItemIndex(workshopItems, over.id as string);
        } else {
          const targetParent = findItemById(workshopItems, overContext.parentId);
          if (targetParent?.children) {
            targetIndex = getItemIndex(targetParent.children, over.id as string);
          }
        }

        moveItem(active.id as string, overContext.parentId, targetIndex);
        return;
      }

      if (activeContext.parentId === null) {
        const oldIndex = getItemIndex(workshopItems, active.id as string);
        const newIndex = getItemIndex(workshopItems, over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderItems(arrayMove(workshopItems, oldIndex, newIndex));
        }
      } else {
        const parentItem = findItemById(workshopItems, activeContext.parentId);
        if (parentItem?.children) {
          const oldIndex = getItemIndex(parentItem.children, active.id as string);
          const newIndex = getItemIndex(parentItem.children, over.id as string);
          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove(parentItem.children, oldIndex, newIndex);
            updateItem(activeContext.parentId!, { children: reordered });
          }
        }
      }
    },
    [handleSidebarDrag, moveItem, reorderItems, updateItem, workshopItems],
  );

  return {
    activeId,
    activeData,
    activeParentId,
    dropIndicator,
    customCollisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
