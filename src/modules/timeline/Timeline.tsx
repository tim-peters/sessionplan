import { useState, useCallback, useMemo, useEffect } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { BlockType, Person, WorkshopItem } from '@/types/workshop';
import type { DropIndicator } from '@/types/dnd';
import type { PlayState } from '@/lib/playModeUtils';
import type { TimelineItemHandlers } from '@/lib/timelineItemProps';
import { findItemById } from '@/lib/workshopUtils';
import { cn } from '@/lib/utils';
import { useTimelineItemActions } from '@/hooks/useTimelineItemActions';
import { BlockEditDialog } from './BlockEditDialog';
import { DropZone } from './DropZone';
import { TimelineFooter } from './TimelineFooter';
import { TimelineItemRow } from './TimelineItemRow';
import { WorkshopDescription } from './WorkshopDescription';

interface TimelineProps {
  items: WorkshopItem[];
  /** Render the timeline chrome even without items (empty day of a multi-day plan). */
  renderWhenEmpty?: boolean;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  startTime: string | null;
  targetDuration?: number;
  durationLocked?: boolean;
  onUpdateItem: (id: string, updates: Partial<WorkshopItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<WorkshopItem, 'id'>, parentId?: string) => void;
  onInsertItemAfter: (afterId: string, item: Omit<WorkshopItem, 'id'>) => string | null;
  onSaveToLibrary: (item: WorkshopItem) => void;
  dropIndicator?: DropIndicator | null;
  blockPlayStates?: Map<string, PlayState>;
  onOpenDialog?: () => void;
  date?: string | null;
  description?: string;
  onUpdateDescription?: (desc: string) => void;
  onAddStartTimeClick?: () => void;
  editingItem: WorkshopItem | null;
  onEditingItemChange: (item: WorkshopItem | null) => void;
  onEditFormUnsavedChange?: (hasChanges: boolean) => void;
}

export const Timeline = ({
  items,
  renderWhenEmpty = false,
  blockTypes,
  persons,
  showFullPreviewText = true,
  startTime,
  targetDuration,
  durationLocked,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onInsertItemAfter,
  onSaveToLibrary,
  dropIndicator,
  blockPlayStates,
  onOpenDialog,
  date,
  description,
  onUpdateDescription,
  onAddStartTimeClick,
  editingItem,
  onEditingItemChange,
  onEditFormUnsavedChange,
}: TimelineProps) => {
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

  // Only top-level IDs: nested items have sortable contexts of their own.
  const topLevelItemIds = useMemo(() => items.map((item) => item.id), [items]);

  const {
    handleAddBlock,
    handleAddGroup,
    handleAddBreakout,
    handleCreateBelow,
    handleDeleteAndFocusPrev,
    handleAddChildBlock,
    handleAddChildBreakout,
    handleDuplicate,
  } = useTimelineItemActions({ items, onDeleteItem, onAddItem, onInsertItemAfter });

  if (items.length === 0 && !renderWhenEmpty) return null;

  const itemHandlers: TimelineItemHandlers = {
    onUpdateItem,
    onDeleteItem,
    onDuplicate: handleDuplicate,
    onSaveToLibrary,
    openEditDialog,
    onAddChildBlock: handleAddChildBlock,
    onAddChildBreakout: handleAddChildBreakout,
    onCreateBelow: handleCreateBelow,
    onDeleteAndFocusPrev: handleDeleteAndFocusPrev,
  };

  return (
    <main className='py-6 min-h-[calc(100vh_-_11rem)] md:min-h-[calc(100vh_-_7rem)]'>
      {description !== undefined && (
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
      <SortableContext items={topLevelItemIds} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-3", items.length > 0 ? "-mt-10   print:mt-0" : "mt-0")}>
          <DropZone id="drop-zone-top" position="top" />

          {items.map((item, index) => (
            <TimelineItemRow
              key={item.id}
              item={item}
              index={index}
              items={items}
              startTime={startTime}
              blockTypes={blockTypes}
              persons={persons}
              showFullPreviewText={showFullPreviewText}
              dropIndicator={dropIndicator}
              blockPlayStates={blockPlayStates}
              handlers={itemHandlers}
            />
          ))}

          <TimelineFooter
            items={items}
            startTime={startTime}
            targetDuration={targetDuration}
            durationLocked={durationLocked}
            onAddBlock={handleAddBlock}
            onAddGroup={handleAddGroup}
            onAddBreakout={handleAddBreakout}
          />
        </div>
      </SortableContext>

      <BlockEditDialog
        item={editingItem}
        focusField={editDialogFocusField}
        onUnsavedChangesChange={onEditFormUnsavedChange}
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
    </main>
  );
};
