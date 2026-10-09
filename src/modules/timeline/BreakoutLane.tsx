import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { Plus } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { BlockCard } from './BlockCard';
import { GapIndicator } from './atoms/GapIndicator';
import { PersonAvatar } from '@/components/atoms/PersonAvatar';
import { useDragDropContext } from '@/hooks/useDragDropContext';
import { useIsLg } from '@/hooks/use-lg';
import { buildLaneId } from '@/lib/dndConstants';
import { cn } from '@/lib/utils';

interface BreakoutLaneProps {
  parentItem: WorkshopItem;
  laneIndex: number;
  laneChildren: WorkshopItem[];
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  parentTimeDisplay?: string | null;
  onCalculateChildTime?: (parentItem: WorkshopItem, childIndex: number) => string | null;
  onUpdateChild?: (childId: string, updates: Partial<WorkshopItem>) => void;
  onDeleteChild?: (childId: string) => void;
  onDuplicateChild?: (childId: string) => void;
  onSaveChildToLibrary?: (childId: string) => void;
  onEditChildDetails?: (childId: string) => void;
  onEditChildDetailsOnTime?: (childId: string) => void;
  onAddChild?: (type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  onCreateBelowChild?: (childId: string) => void;
  onDeleteChildAndFocusPrev?: (childId: string) => void;
  depth: number;
  dropIndicator?: { overId: string; position: 'before' | 'after' } | null;
  childPlayStates?: Map<string, string>;
}

export const BreakoutLane = ({
  parentItem,
  laneIndex,
  laneChildren,
  blockTypes,
  persons,
  showFullPreviewText = false,
  parentTimeDisplay,
  onCalculateChildTime,
  onUpdateChild,
  onDeleteChild,
  onDuplicateChild,
  onSaveChildToLibrary,
  onEditChildDetails,
  onEditChildDetailsOnTime,
  onAddChild,
  onCreateBelowChild,
  onDeleteChildAndFocusPrev,
  depth,
  dropIndicator: _dropIndicator,
  childPlayStates,
}: BreakoutLaneProps) => {
  const { activeParentId: contextActiveParentId, activeData } = useDragDropContext();
  const { t } = useTranslation('common');
  const laneId = buildLaneId(parentItem.id, laneIndex);
  const isLg = useIsLg();

  // Disable the lane dropzone when the user is already dragging a block
  // from this same lane — otherwise dnd-kit's collision detection always picks
  // the lane dropzone (which covers the whole lane rect), and intra-lane
  // sorting breaks. The BlockCard's useSortable data carries a `laneIndex`
  // field, so we check that instead of relying on the ActiveData
  // discriminator (which is reserved for sidebar/library/new-* payloads).
  const isDraggingFromThisLane =
    contextActiveParentId === parentItem.id &&
    activeData !== undefined &&
    'laneIndex' in activeData &&
    (activeData as { laneIndex?: number }).laneIndex === laneIndex;

  const { setNodeRef, isOver } = useDroppable({
    id: laneId,
    disabled: isDraggingFromThisLane,
    data: {
      type: 'breakout-lane',
      parentId: parentItem.id,
      laneIndex,
    },
  });

  const laneChildrenDurationSum = laneChildren
    .filter((child) => child)
    .reduce((sum, child) => sum + child.duration, 0);
  const laneDurationDifference = parentItem.duration - laneChildrenDurationSum;

  const lanePersonIds = parentItem.lanePersons?.[laneIndex] || [];
  const availablePersons = parentItem.personIds
    ? persons.filter((p) => parentItem.personIds?.includes(p.id))
    : [];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-w-0 space-y-2 px-1 md:px-2 py-2 rounded border-2 border-dashed flex flex-col',
        isOver ? 'border-none bg-block-breakout/10' : 'border-transparent',
      )}
    >
      <div className="flex justify-center items-center gap-2 mb-2">
        <div className="text-xs text-center font-medium text-muted-foreground">
          {t('block.room')} {laneIndex + 1}
        </div>
        {availablePersons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {availablePersons.map((person) => {
              const isSelected = lanePersonIds.includes(person.id);
              return (
                <PersonAvatar
                  key={person.id}
                  name={person.name}
                  color={person.color}
                  size="sm"
                  selected={isSelected}
                  dimmed={!isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentLanePersons = parentItem.lanePersons || {};
                    const currentIds = currentLanePersons[laneIndex] || [];
                    const newIds = isSelected
                      ? currentIds.filter((id) => id !== person.id)
                      : [...currentIds, person.id];

                    onUpdateChild?.(parentItem.id, {
                      lanePersons: {
                        ...currentLanePersons,
                        [laneIndex]: newIds,
                      },
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
      {laneChildren.length > 0 ? (
        <>
          <SortableContext
            items={laneChildren.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 flex-1">
              {laneChildren.map((child, laneChildIndex) => {
                const childBlockType = blockTypes.find((bt) => bt.id === child.blockTypeId);
                const actualChildIndex = parentItem.children?.indexOf(child) || 0;

                let gapMinutes: number | null = null;
                if (child.fixedStartTime) {
                  if (laneChildIndex === 0 && parentTimeDisplay) {
                    const [ph, pm] = parentTimeDisplay.split(':').map(Number);
                    const [fh, fm] = child.fixedStartTime.split(':').map(Number);
                    gapMinutes = fh * 60 + fm - (ph * 60 + pm);
                  } else if (laneChildIndex > 0 && onCalculateChildTime) {
                    const prevChild = laneChildren[laneChildIndex - 1];
                    const prevActualIndex = parentItem.children?.indexOf(prevChild) ?? -1;
                    const prevChildTime =
                      prevActualIndex >= 0 ? onCalculateChildTime(parentItem, prevActualIndex) : null;
                    if (prevChildTime) {
                      const [ph, pm] = prevChildTime.split(':').map(Number);
                      const [fh, fm] = child.fixedStartTime.split(':').map(Number);
                      gapMinutes = fh * 60 + fm - (ph * 60 + pm + prevChild.duration);
                    }
                  }
                }

                return (
                  <Fragment key={child.id}>
                    <GapIndicator minutes={gapMinutes ?? 0} size="sm" />
                    <BlockCard
                      item={child}
                      blockType={childBlockType}
                      blockTypes={blockTypes}
                      persons={persons}
                      showFullPreviewText={showFullPreviewText}
                      stackPreviewFields={true}
                      timeDisplay={onCalculateChildTime?.(parentItem, actualChildIndex) || null}
                      onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                      onDelete={() => onDeleteChild?.(child.id)}
                      onDuplicate={() => onDuplicateChild?.(child.id)}
                      onSaveToLibrary={() => onSaveChildToLibrary?.(child.id)}
                      onEditDetails={() => onEditChildDetails?.(child.id)}
                      onEditDetailsOnTime={() => onEditChildDetailsOnTime?.(child.id)}
                      onCreateBelow={(childItem) => onCreateBelowChild?.(childItem.id)}
                      onDeleteAndFocusPrev={(childItem) => onDeleteChildAndFocusPrev?.(childItem.id)}
                      parentId={parentItem.id}
                      parentType="breakout"
                      isNested={true}
                      depth={depth + 1}
                      playState={childPlayStates?.get(child.id) as never}
                    />
                  </Fragment>
                );
              })}
            </div>
          </SortableContext>

          {laneDurationDifference !== 0 && (
            <div className="mt-2">
              <GapIndicator minutes={laneDurationDifference} size="sm" />
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4 border-t text-muted-foreground text-xs flex flex-col items-center justify-center min-h-[60px] flex-1">
          <p>{t('block.noBlocks')}</p>
          <p className="opacity-70 mt-0.5">{t('block.dragHere')}</p>
        </div>
      )}

      {onAddChild && (!isLg || !laneChildren || laneChildren.length === 0) && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onAddChild?.('block', laneIndex);
          }}
          variant="ghost"
          size="sm"
          className={cn(
            'w-full mt-2 h-7 text-xs print:hidden',
            laneChildren.length > 0 && 'text-muted-foreground',
          )}
        >
          <Plus className="h-3 w-3 mr-1" />
          <span className="truncate">{t('block.addBlock')}</span>
        </Button>
      )}
    </div>
  );
};
