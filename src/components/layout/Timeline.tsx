import { useState, useCallback, useMemo, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DragEndEvent,
  useDraggable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { LandingPageContent } from '@/types/landingPage';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import { calculateBlockTime, calculateEffectiveDuration } from '@/lib/workshopStorage';
import { findItemById, findItemAndParent } from '@/lib/workshopUtils';
import { generateId } from '@/types/workshop';
import { focusLastBlockTitleInput, focusBlockTitleInput, scrollToLastBlock } from '@/lib/domUtils';
import type { ActiveData, DropIndicator } from '@/types/dnd';
import { bindItemProps } from '@/lib/timelineItemProps';
import {
  DEFAULT_BLOCK_DURATION,
  DEFAULT_BREAKOUT_DURATION,
  DEFAULT_LANES,
} from '@/lib/workshopDefaults';
import { BlockCard } from '../sections/BlockCard';
import { GroupCard } from '../sections/GroupCard';
import { BreakoutCard } from '../sections/BreakoutCard';
import { BlockEditDialog } from '../sections/BlockEditDialog';
import { DropZone } from '../atoms/DropZone';
import { EmptyStateHero, EmptyStateSEO } from '../states/EmptyState';
import { Plus, FolderPlus, SquareSplitHorizontal } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { cn } from '@/lib/utils';
import { WorkshopDescription } from '../atoms/WorkshopDescription';
import { PlayState } from '@/lib/playModeUtils';
import { GapIndicator } from '../atoms/GapIndicator';

// Draggable button for adding items
const DraggableAddButton = ({
  id,
  type,
  icon: Icon,
  label,
  shortcut,
  onClick,
}: {
  id?: string;
  type: 'new-block' | 'new-group' | 'new-breakout';
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: id ?? `add-${type}`,
    data: { type },
  });

  return (
    <Button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      variant="outline"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={shortcut ? `${label} (${shortcut})` : undefined}
      className={cn(
        'gap-2 shadow-sm m-2 cursor-grab active:cursor-grabbing lg:cursor-grab backdrop-blur-sm supports-[backdrop-filter]:bg-background/70',
        isDragging && 'opacity-50'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
};

interface TimelineProps {
  items: WorkshopItem[];
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  startTime: string | null;
  targetDuration?: number;
  durationLocked?: boolean;
  landingPageContent?: LandingPageContent;
  onReorder: (items: WorkshopItem[]) => void;
  onUpdateItem: (id: string, updates: Partial<WorkshopItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<WorkshopItem, 'id'>, parentId?: string) => void;
  onInsertItemAfter: (afterId: string, item: Omit<WorkshopItem, 'id'>) => string | null;
  onSaveToLibrary: (item: WorkshopItem) => void;
  onMoveItem: (itemId: string, targetParentId: string | null, targetIndex?: number) => void;
  activeId?: string | null;
  activeData?: ActiveData;
  dropIndicator?: DropIndicator | null;
  onTimelineDragEnd?: (event: DragEndEvent) => void;
  blockPlayStates?: Map<string, PlayState>;
  onOpenDialog?: () => void;
  date?: string | null;
  description?: string;
  onUpdateDescription?: (desc: string) => void;
  onUpdateStartTime?: (time: string | null) => void;
  onAddStartTimeClick?: () => void;
  onReopenSession?: (entry: SessionHistoryEntry) => void;
  editingItem: WorkshopItem | null;
  onEditingItemChange: (item: WorkshopItem | null) => void;
}

export const Timeline = ({
  items,
  blockTypes,
  persons,
  showFullPreviewText = true,
  startTime,
  targetDuration,
  durationLocked,
  landingPageContent,
  onReorder,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onInsertItemAfter,
  onSaveToLibrary,
  onMoveItem,
  activeId: externalActiveId,
  activeData: externalActiveData,
  dropIndicator: externalDropIndicator,
  onTimelineDragEnd,
  blockPlayStates,
  onOpenDialog,
  date,
  description,
  onUpdateDescription,
  onUpdateStartTime,
  onAddStartTimeClick,
  onReopenSession,
  editingItem,
  onEditingItemChange,
}: TimelineProps) => {
  const { t } = useTranslation('common');
  const [editDialogFocusField, setEditDialogFocusField] = useState<'fixedStartTime' | undefined>();

  // Keep editingItem in sync when server data refreshes
  useEffect(() => {
    if (!editingItem) return;
    const updated = findItemById(items, editingItem.id);
    if (updated) onEditingItemChange(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const openEditDialog = useCallback((item: WorkshopItem, focusField?: 'fixedStartTime') => {
    onOpenDialog?.();
    setEditDialogFocusField(focusField);
    onEditingItemChange(item);
  }, [onOpenDialog, onEditingItemChange]);

  // Use external props
  const currentDropIndicator = externalDropIndicator;

  // Collect only top-level item IDs for the sortable context (no nested children)
  const allItemIds = useMemo(() => items.map(item => item.id), [items]);

  // Calculate time for nested block within a group or breakout
  const calculateNestedBlockTime = useCallback((
    parentTime: string | null, 
    parentItem: WorkshopItem, 
    childIndex: number
  ): string | null => {
    if (!parentItem.children) return null;
    const child = parentItem.children[childIndex];

    // If the child itself has a fixed start time, return it directly
    if (child?.fixedStartTime) return child.fixedStartTime;

    if (!parentTime) return null;

    if (parentItem.type === 'breakout') {
      const currentLaneIndex = child?.laneIndex ?? 0;

      // Find last fixed anchor in same lane before childIndex
      let anchorIndex = -1;
      for (let i = childIndex - 1; i >= 0; i--) {
        const prev = parentItem.children[i];
        if ((prev.laneIndex ?? 0) === currentLaneIndex && prev.fixedStartTime) {
          anchorIndex = i;
          break;
        }
      }

      const baseTime = anchorIndex >= 0 ? parentItem.children[anchorIndex].fixedStartTime! : parentTime;
      const [h0, m0] = baseTime.split(':').map(Number);
      let totalMinutes = h0 * 60 + m0;

      const startAccum = anchorIndex >= 0 ? anchorIndex : 0;
      for (let i = startAccum; i < childIndex; i++) {
        const prev = parentItem.children[i];
        if ((prev.laneIndex ?? 0) === currentLaneIndex) {
          totalMinutes += prev.duration;
        }
      }

      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // For groups: find last fixed anchor before childIndex
    let anchorIndex = -1;
    for (let i = childIndex - 1; i >= 0; i--) {
      if (parentItem.children[i]?.fixedStartTime) {
        anchorIndex = i;
        break;
      }
    }

    const baseTime = anchorIndex >= 0 ? parentItem.children[anchorIndex].fixedStartTime! : parentTime;
    const [h0, m0] = baseTime.split(':').map(Number);
    let totalMinutes = h0 * 60 + m0;

    const startAccum = anchorIndex >= 0 ? anchorIndex : 0;
    for (let i = startAccum; i < childIndex; i++) {
      totalMinutes += parentItem.children[i].duration;
    }

    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }, []);

  const handleAddBlock = useCallback(() => {
    onAddItem({
      type: 'block',
      blockTypeId: null,
      title: t('block.newBlock'),
      duration: DEFAULT_BLOCK_DURATION,
      notes: '',
      material: '',
    });

    focusLastBlockTitleInput();
    scrollToLastBlock();
  }, [onAddItem, t]);

  const handleAddGroup = useCallback(() => {
    onAddItem({
      type: 'group',
      blockTypeId: null,
      title: t('block.newGroup'),
      duration: 0,
      notes: '',
      material: '',
      children: [],
      durationLocked: false,
    });

    focusLastBlockTitleInput();
    scrollToLastBlock();
  }, [onAddItem, t]);

  const handleAddBreakout = useCallback(() => {
    onAddItem({
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

    focusLastBlockTitleInput();
    scrollToLastBlock();
  }, [onAddItem, t]);

  const handleCreateBelow = useCallback((reference: WorkshopItem) => {
    const defaults: Record<WorkshopItem['type'], Omit<WorkshopItem, 'id'>> = {
      block: {
        type: 'block',
        blockTypeId: null,
        title: t('block.newBlock'),
        duration: DEFAULT_BLOCK_DURATION,
        notes: '',
        material: '',
      },
      group: {
        type: 'group',
        blockTypeId: null,
        title: t('block.newGroup'),
        duration: 0,
        notes: '',
        material: '',
        children: [],
        durationLocked: false,
      },
      breakout: {
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
      },
    };
    const newId = onInsertItemAfter(reference.id, defaults[reference.type]);
    if (newId) {


      focusBlockTitleInput(newId);
    }
  }, [onInsertItemAfter, t]);

  /**
   * Backspace-on-empty-title handler.
   * Finds the previous sibling in the same parent context (top-level items,
   * group children, or breakout children within the same lane) and focuses
   * its title input after deletion. No-op if there is no previous sibling.
   */
  const handleDeleteAndFocusPrev = useCallback((item: WorkshopItem) => {
    const { parentId } = findItemAndParent(items, item.id);
    let prevId: string | null = null;

    if (parentId === null) {
      const idx = items.findIndex(i => i.id === item.id);
      if (idx > 0) prevId = items[idx - 1].id;
    } else {
      const parent = findItemById(items, parentId);
      if (parent?.children) {
        if (parent.type === 'breakout') {
          const laneChildren = parent.children.filter(
            c => (c.laneIndex ?? 0) === (item.laneIndex ?? 0)
          );
          const idxInLane = laneChildren.findIndex(c => c.id === item.id);
          if (idxInLane > 0) prevId = laneChildren[idxInLane - 1].id;
        } else {
          const idx = parent.children.findIndex(c => c.id === item.id);
          if (idx > 0) prevId = parent.children[idx - 1].id;
        }
      }
    }

    if (!prevId) return; // No previous sibling — skip deletion.

    onDeleteItem(item.id);
    focusBlockTitleInput(prevId, 150);
  }, [items, onDeleteItem]);

  const handleAddChildBlock = useCallback((parentId: string, laneIndex?: number) => {
    const newBlock = {
      type: 'block' as const,
      blockTypeId: null,
      title: t('block.newBlock'),
      duration: DEFAULT_BLOCK_DURATION,
      notes: '',
      material: '',
      ...(laneIndex !== undefined && { laneIndex }),
    };
    onAddItem(newBlock, parentId);
  }, [onAddItem, t]);

  const handleAddChildBreakout = useCallback((parentId: string) => {
    const newBreakout = {
      type: 'breakout' as const,
      blockTypeId: null,
      title: t('block.newBreakout'),
      duration: DEFAULT_BREAKOUT_DURATION,
      notes: '',
      material: '',
      children: [],
      parallel: true,
      lanes: DEFAULT_LANES,
      sameInAllBreakouts: false,
    };
    onAddItem(newBreakout, parentId);
  }, [onAddItem, t]);

  const handleDuplicate = useCallback((item: WorkshopItem) => {
    const duplicateItem = {
      type: item.type,
      blockTypeId: item.blockTypeId,
      title: `${item.title} ${t('block.copy')}`,
      duration: item.duration,
      notes: item.notes,
      material: item.material,
      children: item.children?.map(child => ({ ...child })),
    };

    const topLevelIndex = items.findIndex(i => i.id === item.id);
    if (topLevelIndex !== -1) {
      // Insert right after the item in the top-level timeline
      const newItems = [...items];
      newItems.splice(topLevelIndex + 1, 0, { ...duplicateItem, id: generateId() });
      onReorder(newItems);
    } else {
      // Item is nested — insert after it in the parent's children array
      const { parentId } = findItemAndParent(items, item.id);
      if (parentId) {
        const parentItem = findItemById(items, parentId);
        if (parentItem?.children) {
          const childIndex = parentItem.children.findIndex(c => c.id === item.id);
          const newChildren = [...parentItem.children];
          newChildren.splice(childIndex + 1, 0, { ...duplicateItem, id: generateId() });
          onUpdateItem(parentId, { children: newChildren });
        }
      } else {
        // Fallback: add at end
        onAddItem(duplicateItem);
      }
    }

    // Track duplication
    if (item.type === 'block') {
    } else if (item.type === 'group') {
    } else if (item.type === 'breakout') {
    }
  }, [items, onReorder, onUpdateItem, onAddItem, t]);

  const getBlockType = useCallback((typeId: string | null) => {
    return blockTypes.find(bt => bt.id === typeId);
  }, [blockTypes]);

  // Calculate end time
  const endTime = useMemo(() => {
    if (!startTime || items.length === 0) return null;
    const lastIndex = items.length - 1;
    const lastStartStr = calculateBlockTime(startTime, items, lastIndex);
    if (!lastStartStr) return null;
    const [lh, lm] = lastStartStr.split(':').map(Number);
    const endMin = lh * 60 + lm + items[lastIndex].duration;
    const endHours = Math.floor(endMin / 60) % 24;
    const endMinutes = endMin % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }, [startTime, items]);

  return (
    <div className="py-6 md:min-h-[calc(100vh_-_20rem)]">
      {description !== undefined && items.length > 0 && (
        <div className="max-w-5xl mx-auto px-0 md:px-6 mb-3 print:block sm:pl-[6rem] md:pl-[8rem]">
          <WorkshopDescription
            description={description}
            date={date}
            startTime={startTime}
            onAddStartTimeClick={onAddStartTimeClick}
            showFullText={showFullPreviewText}
            onUpdate={onUpdateDescription}
          />
        </div>
      )}
      <SortableContext items={allItemIds} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-3", items.length > 0 ? "-mt-10   print:mt-0" : "mt-0")}>
          {/* Drop zone at the top */}
          <DropZone id="drop-zone-top" position="top" />
          
          {items.map((item, index) => {
            // Compute gap before this item if it has a fixedStartTime
            let gapMinutes: number | null = null;
            if (item.fixedStartTime) {
              if (index === 0 && startTime) {
                const [ph, pm] = startTime.split(':').map(Number);
                const [fh, fm] = item.fixedStartTime.split(':').map(Number);
                gapMinutes = fh * 60 + fm - (ph * 60 + pm);
              } else if (index > 0) {
                const prevItem = items[index - 1];
                // calculateBlockTime returns prevItem.fixedStartTime directly if set,
                // even without a global startTime — so this works with mid-list anchors
                const prevTimeStr = calculateBlockTime(startTime, items, index - 1);
                if (prevTimeStr) {
                  const [ph, pm] = prevTimeStr.split(':').map(Number);
                  const [fh, fm] = item.fixedStartTime.split(':').map(Number);
                  gapMinutes = fh * 60 + fm - (ph * 60 + pm + prevItem.duration);
                }
              }
            }

            return (
              <Fragment key={item.id}>
                {gapMinutes !== null && gapMinutes !== 0 && (
                  <div className="max-w-5xl mx-auto px-0 md:px-6 print:hidden">
                    <div className="flex gap-4">
                      <div className="hidden sm:block w-20 shrink-0" />
                      <div className="flex-1">
                        <GapIndicator minutes={gapMinutes} size="md" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="relative max-w-5xl mx-auto px-0 md:px-6">
                  {/* Drop indicator line */}
                  {currentDropIndicator?.overId === item.id && currentDropIndicator.position === 'before' && (
                    <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-primary z-10 rounded-full">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                    </div>
                  )}
                
                {/* Render appropriate component based on item type */}
                {(() => {
                  if (item.type === 'group') {
                    const p = bindItemProps(
                      item,
                      index,
                      items,
                      startTime,
                      {
                        onUpdateItem,
                        onDeleteItem,
                        onDuplicate: handleDuplicate,
                        onSaveToLibrary,
                        openEditDialog,
                        handleAddChildBlock,
                        handleAddChildBreakout,
                        onUpdateChild: (childId, updates) => onUpdateItem(childId, updates),
                        onDeleteChild: (childId) => onDeleteItem(childId),
                        onDuplicateChild: (child) => handleDuplicate(child),
                        onSaveChildToLibrary: (child) => onSaveToLibrary(child),
                        onEditChildDetails: (child) => openEditDialog(child),
                        onEditChildDetailsOnTime: (child) => openEditDialog(child, 'fixedStartTime'),
                        calculateNestedBlockTime,
                        handleCreateBelow,
                        handleDeleteAndFocusPrev,
                        onCreateBelowChild: (child) => handleCreateBelow(child),
                        onDeleteChildAndFocusPrev: (child) => handleDeleteAndFocusPrev(child),
                        onMoveItem,
                      },
                      {
                        blockTypes,
                        persons,
                        showFullPreviewText,
                        dropIndicator: currentDropIndicator,
                        blockPlayStates,
                        childPlayStates: blockPlayStates,
                      },
                    );
                    return (
                      <GroupCard
                        {...p}
                        startTime={startTime}
                      />
                    );
                  }
                  if (item.type === 'breakout') {
                    const p = bindItemProps(
                      item,
                      index,
                      items,
                      startTime,
                      {
                        onUpdateItem,
                        onDeleteItem,
                        onDuplicate: handleDuplicate,
                        onSaveToLibrary,
                        openEditDialog,
                        handleAddChildBlock,
                        handleAddChildBreakout,
                        onUpdateChild: (childId, updates) => onUpdateItem(childId, updates),
                        onDeleteChild: (childId) => onDeleteItem(childId),
                        onDuplicateChild: (child) => handleDuplicate(child),
                        onSaveChildToLibrary: (child) => onSaveToLibrary(child),
                        onEditChildDetails: (child) => openEditDialog(child),
                        onEditChildDetailsOnTime: (child) => openEditDialog(child, 'fixedStartTime'),
                        calculateNestedBlockTime,
                        handleCreateBelow,
                        handleDeleteAndFocusPrev,
                        onCreateBelowChild: (child) => handleCreateBelow(child),
                        onDeleteChildAndFocusPrev: (child) => handleDeleteAndFocusPrev(child),
                        onMoveItem,
                      },
                      {
                        blockTypes,
                        persons,
                        showFullPreviewText,
                        dropIndicator: currentDropIndicator,
                        blockPlayStates,
                        childPlayStates: blockPlayStates,
                      },
                    );
                    return <BreakoutCard {...p} />;
                  }
                  // block
                  return (
                    <BlockCard
                      item={item}
                      blockType={getBlockType(item.blockTypeId)}
                      blockTypes={blockTypes}
                      persons={persons}
                      showFullPreviewText={showFullPreviewText}
                      timeDisplay={calculateBlockTime(startTime, items, index)}
                      onUpdate={(updates) => onUpdateItem(item.id, updates)}
                      onDelete={() => onDeleteItem(item.id)}
                      onDuplicate={() => handleDuplicate(item)}
                      onSaveToLibrary={() => onSaveToLibrary(item)}
                      onEditDetails={() => openEditDialog(item)}
                      onEditDetailsOnTime={() => openEditDialog(item, 'fixedStartTime')}
                      onCreateBelow={handleCreateBelow}
                      onDeleteAndFocusPrev={handleDeleteAndFocusPrev}
                      playState={blockPlayStates?.get(item.id)}
                    />
                  );
                })()}
                </div>
              </Fragment>
            );})}
          
            {/* End time display and add buttons */}
            {items.length > 0 && (
              <>
                <div className="max-w-5xl mx-auto px-0 md:px-6">
                  {/* Drop zone at the bottom */}
                  <DropZone id="drop-zone-bottom" position="bottom" />
                  
                  {/* End time and duration difference */}
                  <div className="flex gap-4 mt-1">
                    {endTime && (
                      <div className="hidden sm:flex flex-col items-end w-20 shrink-0 pt-1 print:flex">
                        <span className="time-badge font-medium text-primary">
                          {endTime}
                        </span>
                      </div>
                    )}
                    {!endTime && <div className="hidden sm:block w-20 shrink-0 print:block" />}
                    <div className="flex-1 mb-4">
                      {endTime && (
                        <span className="time-badge font-medium text-primary sm:hidden mb-2 block print:hidden">
                          {endTime}
                        </span>
                      )}
                      {/* Duration difference indicator */}
                      {durationLocked && targetDuration && (() => {
                        const totalDuration = calculateEffectiveDuration(items, startTime);
                        const durationDifference = (targetDuration || 0) - totalDuration;
                        return <GapIndicator minutes={durationDifference} size="md" />;
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Add buttons */}
                <div className="sticky bottom-6 -mx-6 sm:mx-0 bottom-4 z-10 flex justify-center mt-2 print:hidden">
                  <div className="flex items-center gap-2 overflow-auto pl-0">
                    <DraggableAddButton
                      type="new-block"
                      icon={Plus}
                      label={t('block.newBlock').split(' ').at(-1)!}
                      shortcut="N"
                      onClick={handleAddBlock}
                    />
                    <DraggableAddButton
                      type="new-group"
                      icon={FolderPlus}
                      label={t('sidebar.group')}
                      shortcut="G"
                      onClick={handleAddGroup}
                    />
                    <DraggableAddButton
                      type="new-breakout"
                      icon={SquareSplitHorizontal}
                      label={t('sidebar.breakout')}
                      shortcut="B"
                      onClick={handleAddBreakout}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </SortableContext>

      {/* Empty state */}
      {items.length === 0 && (
        <>
          <EmptyStateHero onAddBlock={handleAddBlock} landingPageContent={landingPageContent} onReopenSession={onReopenSession} />
          <DropZone id="drop-zone-bottom" position="bottom" />
          <EmptyStateSEO onAddBlock={handleAddBlock} landingPageContent={landingPageContent} />
        </>
      )}

      {/* Edit dialog */}
      <BlockEditDialog
        item={editingItem}
        focusField={editDialogFocusField}
        blockTypes={blockTypes}
        persons={persons}
        onClose={() => onEditingItemChange(null)}
        onAutoSave={(updates) => {
          if (editingItem) {
            onUpdateItem(editingItem.id, updates);
          }
        }}
        onSave={(updates) => {
          if (editingItem) {
            onUpdateItem(editingItem.id, updates);
            onEditingItemChange(null);
          }
        }}
        onDelete={() => {
          if (editingItem) {
            onDeleteItem(editingItem.id);
            onEditingItemChange(null);
          }
        }}
      />
    </div>
  );
};
