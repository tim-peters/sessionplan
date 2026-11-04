import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { Layers } from 'lucide-react';
import { ContainerDurationInput } from './atoms/ContainerDurationInput';
import { DragHandle } from './atoms/DragHandle';
import { DurationInput } from './atoms/DurationInput';
import { DurationLockButton } from './atoms/DurationLockButton';
import { ExpandToggle } from './atoms/ExpandToggle';
import { ItemStartTime } from './atoms/ItemStartTime';
import { Switch } from '@/components/primitives/switch';
import { cn } from '@/lib/utils';
import { BlockPreview } from './BlockPreview';
import { useDragDropContext } from '@/hooks/useDragDropContext';
import { PlayState } from '@/lib/playModeUtils';
import { PersonAvatarList } from './atoms/PersonAvatarList';
import { ItemActionsMenu } from './ItemActionsMenu';
import { BlockTitleInput } from './BlockTitleInput';
import {
  DEFAULT_LANES,
  MIN_LANES,
  MAX_LANES,
} from '@/lib/workshopDefaults';
import { SM_BREAKPOINT } from '@/lib/constants';
import { containerId } from '@/lib/dndConstants';
import type { ChildItemCallbacks } from '@/lib/timelineItemProps';
import { SameInAllLanesView } from './SameInAllLanesView';
import { ParallelLanesView } from './ParallelLanesView';
import { useIsStripHighlighted, useHoverHighlightHandlers } from '@/hooks/useHoverHighlight';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface BreakoutCardProps extends ChildItemCallbacks {
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
  onEditDetailsOnTime?: () => void;
  onCreateBelow?: (item: WorkshopItem) => void;
  onDeleteAndFocusPrev?: (item: WorkshopItem) => void;
  parentId?: string | null;
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
  onEditDetailsOnTime,
  onCreateBelow,
  onDeleteAndFocusPrev,
  parentId = null,
  playState,
  childPlayStates,
  ...childCallbacks
}: BreakoutCardProps) => {
  const { t } = useTranslation('common');
  const [isExpanded, setIsExpanded] = useState(true);
  const { activeParentId: contextActiveParentId } = useDragDropContext();

  // Cross-highlight with the time-visualization strip. The breakout root
  // carries data-item-id, so the handlers live on this element — its inner
  // children (lane blocks) already publish via their own BlockCard instances.
  // Only the strip-originated hover gets the outline; timeline-originated
  // hovers get the card's normal CSS hover affordance.
  const isHighlighted = useIsStripHighlighted(item.id);
  const hoverHandlers = useHoverHighlightHandlers(item.id);

  const isSmUp = useMediaQuery(`(min-width: ${SM_BREAKPOINT}px)`);

  // Set up droppable for sameInAllBreakouts mode
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: containerId(item.id),
    disabled: !(item.sameInAllBreakouts && isExpanded) || contextActiveParentId === item.id,
    data: {
      containerId: item.id,
    },
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      parentId: parentId,
      laneIndex: item.laneIndex,
    },
  });

  // Calculate total blocks across all lanes
  const totalBlocks = item.children?.length || 0;
  const blocksPerLane = item.sameInAllBreakouts
    ? item.children?.filter((c) => (c.laneIndex ?? 0) === 0).length || 0
    : null;
  const blocksInLanes = blocksPerLane === null && item.children && item.lanes
    ? Array.from({ length: item.lanes }, (_, i) =>
        item.children!.filter((c) => (c.laneIndex ?? 0) === i).length,
      )
    : null;
  const minBlocksInLane = blocksInLanes && Math.min(...blocksInLanes);
  const maxBlocksInLane = blocksInLanes && Math.max(...blocksInLanes);

  const startTimeProps = {
    isFixed: !!item.fixedStartTime,
    onUnlock: () => onUpdate({ fixedStartTime: undefined }),
    onEdit: onEditDetailsOnTime ?? onEditDetails,
  };
  const handleToggleDurationLock = () => onUpdate({ durationLocked: !item.durationLocked });

  return (
    <div
      className={cn(
        'flex gap-4',
        playState === 'past' && 'is-past',
      )}
    >
      {/* Time column - left side */}
      <div className="hidden sm:flex flex-col items-end w-20 print:w-10 shrink-0 pt-4 print:flex">
        {timeDisplay && (
          <ItemStartTime
            {...startTimeProps}
            time={timeDisplay}
            className="flex items-center gap-1"
            unlockButtonClassName="inline-flex items-center justify-center rounded-md p-1.5 text-primary-text hover:text-foreground transition-colors print:hidden"
            lockIconClassName="h-3 w-3"
            timeButtonClassName="time-badge font-medium text-primary-text is-clickable"
          />
        )}
        <div className="flex flex-col items-center gap-1 mt-1">
          <DurationLockButton
            isLocked={!!item.durationLocked}
            onToggle={handleToggleDurationLock}
            className="absolute -ml-12 mt-2 inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors print:hidden"
            iconClassName="h-3 w-3"
          />
          <ContainerDurationInput item={item} onUpdate={onUpdate} className="duration-input w-8 h-7 print:pb-0" />
          <span className="text-xs text-muted-foreground">Min.</span>
        </div>
      </div>

      {/* Breakout card - right side */}
      <div
        ref={setNodeRef}
        data-item-id={item.id}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0 : 1,
        }}
        onClick={onEditDetails}
        {...hoverHandlers}
        className={cn(
          'block-card group shadow-none bg-block-breakout-bg rounded-lg border-2 border-dashed border-block-breakout/60 fade-in flex-1 cursor-pointer [&:not(:has(.block-card:hover)):hover]:bg-block-breakout/10 transition-shadow',
          isDragging && 'dragging opacity-50',
          playState === 'current' && 'border-primary',
          isHighlighted && 'time-card-highlight',
        )}
      >
        <div
          className={cn(
            'flex items-start gap-3 p-4 pl-5',
            isExpanded && 'border-b border-b-block-breakout/20',
          )}
        >
          {/* Mobile: toggle stacked under the drag handle to free horizontal space; sm+: inline */}
          <div className="flex flex-col items-start shrink-0 sm:contents">
            <DragHandle label={t('actions.move')} attributes={attributes} listeners={listeners} />
            <ExpandToggle isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} stacked />
          </div>

          <div className="flex-1 min-w-0">
            <div className="sm:hidden flex items-center gap-2 mb-2 text-xs">
              {timeDisplay && (
                <ItemStartTime
                  {...startTimeProps}
                  time={timeDisplay}
                  className="flex items-center gap-1"
                  unlockButtonClassName="inline-flex items-center justify-center rounded-md p-1.5 text-primary-text hover:text-foreground transition-colors print:hidden"
                  lockIconClassName="h-3 w-3"
                  timeButtonClassName="font-medium text-primary-text time-badge is-clickable"
                />
              )}
              <div className="flex items-center gap-1">
                <ContainerDurationInput item={item} onUpdate={onUpdate} className="w-12 h-6" />
                <span className="text-muted-foreground">Min.</span>
                <DurationLockButton
                  isLocked={!!item.durationLocked}
                  onToggle={handleToggleDurationLock}
                  className="ml-1 inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors print:hidden"
                  iconClassName="h-3.5 w-3.5"
                />
              </div>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap justify-between gap-2 sm:gap-4 items-start">
              <div className="w-full sm:w-auto sm:flex-1 min-w-0">
                <BlockTitleInput
                  item={item}
                  onUpdate={onUpdate}
                  onCreateBelow={onCreateBelow}
                  onDeleteAndFocusPrev={onDeleteAndFocusPrev}
                  placeholderKey="block.breakoutTitlePlaceholder"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
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
                      <label
                        htmlFor={`same-${item.id}`}
                        className="text-xs text-muted-foreground cursor-pointer select-none -mr-1"
                      >
                        <span className="hidden sm:inline">{t('dialog.sameInAllRooms').split(' ').slice(0, -1).join(' ')} </span>{t('dialog.sameInAllRooms').split(' ').at(-1)}
                      </label>                      
                      <Switch
                        id={`same-${item.id}`}
                        checked={item.sameInAllBreakouts || false}
                        onCheckedChange={(checked) => onUpdate({ sameInAllBreakouts: checked })}
                        className="scale-75"
                      />
                    </div>
                  </div>

                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-block-breakout-bg text-block-breakout-foreground"
                  >
                    Breakout
                    {totalBlocks > 0 && isSmUp && (
                      <>
                        {' • '}
                        {blocksPerLane !== null
                          ? t('block.count', { count: blocksPerLane })
                          : minBlocksInLane === maxBlocksInLane
                            ? t('block.count', { count: minBlocksInLane! })
                            : `${minBlocksInLane} – ${t('block.count_other', { count: maxBlocksInLane! })}`}
                      </>
                    )}
                  </span>
                </div>

                <PersonAvatarList personIds={item.personIds || []} persons={persons} className="mt-1" />

                {/* Actions - always pinned to the right edge */}
                <ItemActionsMenu
                  onEditDetails={onEditDetails}
                  onDuplicate={onDuplicate}
                  onSaveToLibrary={onSaveToLibrary}
                  onDelete={onDelete}
                  className="ml-auto"
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
              !item.sameInAllBreakouts && `sm:p-4 grid grid-cols-2 gap-0 sm:gap-4 pt-1`,
              // Small screens: never more than 2 rooms side by side, extra rooms wrap
              !item.sameInAllBreakouts && (item.lanes === 3 ? 'sm:grid-cols-3' : null),
              (!item.children || item.children.length === 0) && 'min-h-[100px]',
            )}
          >
            {item.sameInAllBreakouts ? (
              <div className={cn('-m-4 p-4 rounded-b-lg', isOver && 'bg-block-breakout/10 border-primary')}>
                <SameInAllLanesView
                  {...childCallbacks}
                  // A child's time opens its details here without focusing the time field.
                  onEditChildDetailsOnTime={undefined}
                  item={item}
                  blockTypes={blockTypes}
                  persons={persons}
                  showFullPreviewText={showFullPreviewText}
                  onAddChild={onAddChild}
                  childPlayStates={childPlayStates}
                />
              </div>
            ) : (
              <ParallelLanesView
                {...childCallbacks}
                item={item}
                blockTypes={blockTypes}
                persons={persons}
                showFullPreviewText={showFullPreviewText}
                timeDisplay={timeDisplay}
                onAddChild={onAddChild}
                childPlayStates={childPlayStates}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
