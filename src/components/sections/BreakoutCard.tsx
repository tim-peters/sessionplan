import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { ChevronDown, ChevronRight, Plus, Layers, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { DurationInput } from '../atoms/DurationInput';
import { DragHandle } from '../atoms/DragHandle';
import { Checkbox } from '@/components/primitives/checkbox';
import { cn } from '@/lib/utils';
import { BlockPreview } from '../atoms/BlockPreview';
import { useDragDropContext } from '@/hooks/useDragDropContext';
import { PlayState } from '@/lib/playModeUtils';
import { PersonAvatarList } from '../atoms/PersonAvatarList';
import { ItemActionsMenu } from '../atoms/ItemActionsMenu';
import { BlockTitleInput } from '../atoms/BlockTitleInput';
import { useIsLg } from '@/hooks/use-lg';
import {
  DEFAULT_LANES,
  MIN_LANES,
  MAX_LANES,
} from '@/lib/workshopDefaults';
import { containerId } from '@/lib/dndConstants';
import { BreakoutLane } from './breakout/BreakoutLane';
import { SameInAllLanesView } from './breakout/SameInAllLanesView';
import { ParallelLanesView } from './breakout/ParallelLanesView';

interface BreakoutCardProps {
  item: WorkshopItem;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  timeDisplay: string | null;
  onUpdate: (updates: Partial<WorkshopItem>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => void;
  onEditDetails: () => void;
  onAddChild?: (type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  onUpdateChild?: (childId: string, updates: Partial<WorkshopItem>) => void;
  onDeleteChild?: (childId: string) => void;
  onDuplicateChild?: (childId: string) => void;
  onSaveChildToLibrary?: (childId: string) => void;
  onEditChildDetails?: (childId: string) => void;
  onEditDetailsOnTime?: () => void;
  onEditChildDetailsOnTime?: (childId: string) => void;
  onCalculateChildTime?: (parentItem: WorkshopItem, childIndex: number) => string | null;
  onCreateBelow?: (item: WorkshopItem) => void;
  onCreateBelowChild?: (childId: string) => void;
  onDeleteAndFocusPrev?: (item: WorkshopItem) => void;
  onDeleteChildAndFocusPrev?: (childId: string) => void;
  parentId?: string | null;
  isNested?: boolean;
  depth?: number;
  dropIndicator?: { overId: string; position: 'before' | 'after' } | null;
  playState?: PlayState;
  childPlayStates?: Map<string, PlayState>;
}

export const BreakoutCard = ({
  item,
  blockTypes,
  persons,
  showFullPreviewText = false,
  timeDisplay,
  onUpdate,
  onDelete,
  onDuplicate,
  onSaveToLibrary,
  onEditDetails,
  onAddChild,
  onUpdateChild,
  onDeleteChild,
  onDuplicateChild,
  onSaveChildToLibrary,
  onEditChildDetails,
  onEditDetailsOnTime,
  onEditChildDetailsOnTime,
  onCalculateChildTime,
  onCreateBelow,
  onCreateBelowChild,
  onDeleteAndFocusPrev,
  onDeleteChildAndFocusPrev,
  parentId = null,
  isNested = false,
  depth = 0,
  dropIndicator,
  playState,
  childPlayStates,
}: BreakoutCardProps) => {
  const { t } = useTranslation('common');
  const [isExpanded, setIsExpanded] = useState(true);
  const { activeParentId: contextActiveParentId } = useDragDropContext();
  const isLg = useIsLg();

  // Fix the pre-existing innerWidth read-on-render (hydration risk + re-renders
  // on resize) with a useEffect-driven matchMedia for the sm: breakpoint.
  const [isSmUp, setIsSmUp] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 640px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 640px)');
    const onChange = () => setIsSmUp(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Set up droppable for sameInAllBreakouts mode
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: containerId(item.id),
    disabled: !(item.sameInAllBreakouts && isExpanded) || contextActiveParentId === item.id,
    data: {
      containerId: item.id,
    },
  });

  // Use sortable for the breakout card itself
  const sortable = useSortable({
    id: item.id,
    data: {
      parentId: parentId,
      laneIndex: item.laneIndex,
    },
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  // Calculate total blocks across all lanes
  const totalBlocks = item.children?.length || 0;
  const blocksPerLane = item.sameInAllBreakouts
    ? item.children?.filter((c) => (c.laneIndex ?? 0) === 0).length || 0
    : null;
  const minBlocksInLane = blocksPerLane === null && item.children && item.lanes
    ? Math.min(
        ...Array.from({ length: item.lanes }, (_, i) =>
          item.children!.filter((c) => (c.laneIndex ?? 0) === i).length,
        ),
      )
    : null;
  const maxBlocksInLane = blocksPerLane === null && item.children && item.lanes
    ? Math.max(
        ...Array.from({ length: item.lanes }, (_, i) =>
          item.children!.filter((c) => (c.laneIndex ?? 0) === i).length,
        ),
      )
    : null;

  return (
    <div
      className={cn(
        'flex gap-4',
        isNested && 'pl-4',
        playState === 'past' && 'opacity-50 grayscale',
      )}
    >
      {/* Time column - left side */}
      <div className="hidden sm:flex flex-col items-end w-20 print:w-10 shrink-0 pt-4 print:flex">
        {timeDisplay && (
          <div className="flex items-center gap-1">
            {item.fixedStartTime && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate({ fixedStartTime: undefined }); }}
                className="text-primary hover:text-muted-foreground transition-colors p-0.5 print:hidden"
                title={t('block.unlockStartTime')}
              >
                <Lock className="h-3 w-3" />
              </button>
            )}
            <span
              className="time-badge font-medium text-primary is-clickable"
              onClick={(e) => { e.stopPropagation(); (onEditDetailsOnTime ?? onEditDetails)(); }}
            >{timeDisplay}</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-1 mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ durationLocked: !item.durationLocked });
            }}
            className="absolute -ml-12 mt-2 text-muted-foreground hover:text-foreground transition-colors p-0.5 print:hidden"
            title={item.durationLocked ? t('dialog.unlockDuration') : t('planner.unlockDuration')}
          >
            {item.durationLocked ? (
              <Lock className="h-3 w-3 text-primary" />
            ) : (
              <Unlock className="h-3 w-3" />
            )}
          </button>
          <DurationInput
            value={item.duration}
            onChange={(e) => {
              if (!item.durationLocked) return;
              onUpdate({ duration: parseInt(e.target.value) || 0 });
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.durationLocked) {
                onUpdate({ durationLocked: true });
              }
            }}
            className={cn(
              'duration-input w-8 h-7 print:pb-0',
              !item.durationLocked && 'opacity-50 cursor-pointer',
            )}
            min={0}
          />
          <span className="text-xs text-muted-foreground">Min.</span>
        </div>
      </div>

      {/* Breakout card - right side */}
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0 : 1,
        }}
        onClick={onEditDetails}
        className={cn(
          'block-card shadow-none bg-block-breakout-bg rounded-lg border-2 border-dashed border-block-breakout∆/60 fade-in flex-1 cursor-pointer [&:not(:has(.block-card:hover)):hover]:bg-block-breakout/10 transition-shadow',
          isDragging && 'dragging opacity-50',
          playState === 'current' && 'border-primary',
        )}
      >
        <div
          className={cn(
            'flex items-start gap-3 p-4 pl-5',
            isExpanded && 'border-b border-b-block-breakout/20',
          )}
        >
          <DragHandle attributes={attributes} listeners={listeners} />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors print:hidden"
          >
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="sm:hidden flex items-center gap-2 mb-2 text-xs">
              {timeDisplay && (
                <div className="flex items-center gap-1">
                  {item.fixedStartTime && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdate({ fixedStartTime: undefined }); }}
                      className="text-primary print:hidden"
                      title={t('block.unlockStartTime')}
                    >
                      <Lock className="h-3 w-3" />
                    </button>
                  )}
                  <span
                    className="font-medium text-primary time-badge is-clickable"
                    onClick={(e) => { e.stopPropagation(); (onEditDetailsOnTime ?? onEditDetails)(); }}
                  >{timeDisplay}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <DurationInput
                  value={item.duration}
                  onChange={(e) => {
                    if (!item.durationLocked) return;
                    onUpdate({ duration: parseInt(e.target.value) || 0 });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!item.durationLocked) {
                      onUpdate({ durationLocked: true });
                    }
                  }}
                  className={cn('w-12 h-6', !item.durationLocked && 'opacity-50 cursor-pointer')}
                  min={0}
                />
                <span className="text-muted-foreground">Min.</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ durationLocked: !item.durationLocked });
                  }}
                  className="ml-1 text-muted-foreground hover:text-foreground transition-colors p-0.5 print:hidden"
                  title={item.durationLocked ? t('dialog.unlockDuration') : t('planner.unlockDuration')}
                >
                  {item.durationLocked ? (
                    <Lock className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-between gap-4 items-start">
              <div className="flex-1">
                <BlockTitleInput
                  item={item}
                  onUpdate={onUpdate}
                  onCreateBelow={onCreateBelow}
                  onDeleteAndFocusPrev={onDeleteAndFocusPrev}
                  placeholderKey="block.breakoutTitlePlaceholder"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-2 print:hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      <DurationInput
                        value={item.lanes || DEFAULT_LANES}
                        onChange={(e) => {
                          const newLanes = Math.max(
                            MIN_LANES,
                            Math.min(MAX_LANES, parseInt(e.target.value) || DEFAULT_LANES),
                          );
                          onUpdate({ lanes: newLanes });
                        }}
                        className="w-10 h-6"
                        min={MIN_LANES}
                        max={MAX_LANES}
                        title={t('dialog.rooms')}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 pl-2 border-l">
                      <Checkbox
                        id={`same-${item.id}`}
                        checked={item.sameInAllBreakouts || false}
                        onCheckedChange={(checked) => onUpdate({ sameInAllBreakouts: !!checked })}
                      />
                      <label
                        htmlFor={`same-${item.id}`}
                        className="text-xs text-muted-foreground cursor-pointer select-none"
                      >
                        <span className="hidden sm:inline">{t('dialog.sameInAllRooms').split(' ').slice(0, -1).join(' ')} </span>{t('dialog.sameInAllRooms').split(' ').at(-1)}
                      </label>
                    </div>
                  </div>

                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-block-breakout-bg text-block-breakout"
                  >
                    Breakout
                    {totalBlocks > 0 && isSmUp && (
                      <>
                        {' • '}
                        {blocksPerLane !== null
                          ? t('block.count', { count: blocksPerLane })
                          : minBlocksInLane === maxBlocksInLane
                            ? t('block.count', { count: minBlocksInLane })
                            : `${minBlocksInLane}–${maxBlocksInLane} ${t('block.count_other', { count: maxBlocksInLane! })}`}
                      </>
                    )}
                  </span>
                </div>

                <PersonAvatarList personIds={item.personIds || []} persons={persons} className="mt-1" />

                <ItemActionsMenu
                  onEditDetails={onEditDetails}
                  onDuplicate={onDuplicate}
                  onSaveToLibrary={onSaveToLibrary}
                  onDelete={onDelete}
                />
              </div>
            </div>

            <BlockPreview notes={item.notes} material={item.material} showFullText={showFullPreviewText} onUpdate={onUpdate} />
          </div>
        </div>

        {isExpanded && (
          <div
            ref={setDroppableRef}
            className={cn(
              'bg-block-breakout-bg rounded-b-lg',
              item.sameInAllBreakouts && `p-4`,
              !item.sameInAllBreakouts && `sm:p-4 grid gap-0 sm:gap-4 pt-1`,
              !item.sameInAllBreakouts && (item.lanes === 2 ? 'grid-cols-2' : item.lanes === 3 ? 'grid-cols-3' : item.lanes === 4 ? 'grid-cols-4' : 'grid-cols-2'),
              (!item.children || item.children.length === 0) && 'min-h-[100px]',
            )}
          >
            {item.sameInAllBreakouts ? (
              <div className={cn('-m-4 p-4 rounded-b-lg', isOver && 'bg-block-breakout/10 border-primary')}>
                <SameInAllLanesView
                  item={item}
                  blockTypes={blockTypes}
                  persons={persons}
                  showFullPreviewText={showFullPreviewText}
                  onCalculateChildTime={onCalculateChildTime}
                  onUpdateChild={onUpdateChild}
                  onDeleteChild={onDeleteChild}
                  onDuplicateChild={onDuplicateChild}
                  onSaveChildToLibrary={onSaveChildToLibrary}
                  onEditChildDetails={onEditChildDetails}
                  onCreateBelowChild={onCreateBelowChild}
                  onDeleteChildAndFocusPrev={onDeleteChildAndFocusPrev}
                  onAddChild={onAddChild}
                  depth={depth}
                  childPlayStates={childPlayStates as never}
                />
              </div>
            ) : (
              <ParallelLanesView
                item={item}
                blockTypes={blockTypes}
                persons={persons}
                showFullPreviewText={showFullPreviewText}
                timeDisplay={timeDisplay}
                onCalculateChildTime={onCalculateChildTime}
                onUpdateChild={onUpdateChild}
                onDeleteChild={onDeleteChild}
                onDuplicateChild={onDuplicateChild}
                onSaveChildToLibrary={onSaveChildToLibrary}
                onEditChildDetails={onEditChildDetails}
                onEditChildDetailsOnTime={onEditChildDetailsOnTime}
                onAddChild={onAddChild}
                onCreateBelowChild={onCreateBelowChild}
                onDeleteChildAndFocusPrev={onDeleteChildAndFocusPrev}
                depth={depth}
                dropIndicator={dropIndicator}
                childPlayStates={childPlayStates}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
