import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { Plus, SquareSplitHorizontal } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { containerId } from '@/lib/dndConstants';
import { bindChildActions, bindChildBlockActions, type ChildItemCallbacks } from '@/lib/timelineItemProps';
import { calculateChildrenDuration, calculateFixedStartGap } from '@/lib/workshopUtils';
import { ContainerDurationInput } from './atoms/ContainerDurationInput';
import { DragHandle } from './atoms/DragHandle';
import { DurationLockButton } from './atoms/DurationLockButton';
import { ExpandToggle } from './atoms/ExpandToggle';
import { ItemStartTime } from './atoms/ItemStartTime';
import { cn } from '@/lib/utils';
import { BlockPreview } from './BlockPreview';
import { useDragDropContext } from '@/hooks/useDragDropContext';
import { BlockCard } from './BlockCard';
import { BreakoutCard } from './BreakoutCard';
import { PlayState } from '@/lib/playModeUtils';
import { PersonAvatarList } from './atoms/PersonAvatarList';
import { ItemActionsMenu } from './ItemActionsMenu';
import { GapIndicator } from './atoms/GapIndicator';
import { BlockTitleInput } from './BlockTitleInput';
import { useIsLg } from '@/hooks/use-lg';
import { useHoverHighlightHandlers } from '@/hooks/useHoverHighlight';

interface GroupCardProps extends ChildItemCallbacks {
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
  onAddToChild?: (childId: string, type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  onEditDetailsOnTime?: () => void;
  onCreateBelow?: (item: WorkshopItem) => void;
  onDeleteAndFocusPrev?: (item: WorkshopItem) => void;
  parentId?: string | null;
  playState?: PlayState;
  childPlayStates?: Map<string, PlayState>;
}

export const GroupCard = ({
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
  onAddToChild,
  onEditDetailsOnTime,
  onCreateBelow,
  onDeleteAndFocusPrev,
  parentId = null,
  playState,
  childPlayStates,
  ...childCallbacks
}: GroupCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation('common');
  const { activeParentId: contextActiveParentId } = useDragDropContext();
  const isLg = useIsLg();
  // Cross-highlight with the time-visualization strip: hovering the group's
  // title card brightens the group's line in the strip (same mechanism as
  // BlockCard/BreakoutCard).
  const hoverHandlers = useHoverHighlightHandlers(item.id);
  
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: containerId(item.id),
    disabled: !isExpanded || contextActiveParentId === item.id,
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
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const durationDifference = item.duration - calculateChildrenDuration(item.children);
  const totalBlocks = item.children?.length || 0;
  const startTimeProps = {
    isFixed: !!item.fixedStartTime,
    onUnlock: () => onUpdate({ fixedStartTime: undefined }),
    onEdit: onEditDetailsOnTime ?? onEditDetails,
  };
  const handleToggleDurationLock = () => onUpdate({ durationLocked: !item.durationLocked });
  const { onCalculateChildTime } = childCallbacks;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        'group-container fade-in -mx-8 my-6 print:mx-0',
        isDragging && 'opacity-50',
        playState === 'past' && 'is-past',
      )}
    >
      {/* Title area with background */}
      <div className="px-0">
        {/* Title card */}
        <div
          onClick={onEditDetails}
          {...hoverHandlers}
          className={cn(
            'group-title-area group cursor-pointer bg-block-group-bg border-2 border-dashed border-block-group/60 p-4 hover:bg-block-group/10 transition-colors print:border-gray-200 print:pr-1',
            'relative',
            isExpanded ? 'rounded-t-lg border-b-block-group/40' : 'rounded-lg',
            playState === 'current' && 'border-primary',
          )}
          style={{ borderBottomStyle: isExpanded ? 'solid' : 'dashed', borderBottomWidth: isExpanded ? '.5px' : '2px' }}
        >

          <div className="flex items-start gap-3 pl-2 mt-2 print:pl-0 print:mt-0">
            {/* Mobile: toggle stacked under the drag handle to free horizontal space */}
            <div className="flex flex-col items-start shrink-0 sm:contents print:hidden">
              <DragHandle label={t('actions.move')} attributes={attributes} listeners={listeners} />
              <ExpandToggle isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} stacked className="sm:hidden" />
            </div>

            {/* Duration elements - desktop only */}
            <div className="hidden sm:flex flex-col items-end shrink-0 -mt-2 mr-5 print:hidden">
              {timeDisplay && (
                <ItemStartTime
                  {...startTimeProps}
                  time={timeDisplay}
                  className="flex items-center gap-1"
                  unlockButtonClassName="inline-flex items-center justify-center rounded-md p-1.5 text-primary-text hover:text-foreground transition-colors print:hidden -mr-1"
                  lockIconClassName="h-3 w-3"
                  timeButtonClassName="text-xs font-medium text-primary-text mr-1 time-badge is-clickable"
                />
              )}
              <div className="flex items-center gap-1 mt-1">
                <DurationLockButton
                  isLocked={!!item.durationLocked}
                  onToggle={handleToggleDurationLock}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors print:hidden"
                  iconClassName="h-3 w-3"
                />
                <ContainerDurationInput item={item} onUpdate={onUpdate} className="w-10 h-6" />
              </div>
            <span className="text-xs text-muted-foreground mr-2">Min.</span>
            </div>

            {/* Expand/collapse - desktop position */}
            <ExpandToggle isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} className="hidden sm:inline-flex" />

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Mobile duration - only on mobile */}
              <div className="sm:hidden flex items-center gap-2 mb-2 text-xs print:flex print:mb-0">
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
                  <DurationLockButton
                    isLocked={!!item.durationLocked}
                    onToggle={handleToggleDurationLock}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors print:hidden"
                    iconClassName="h-3.5 w-3.5"
                  />
                  <ContainerDurationInput item={item} onUpdate={onUpdate} className="w-12 h-6 print:w-8" />
                  <span className="text-muted-foreground">Min.</span>
                </div>
              </div>
              
              <div className="flex flex-wrap sm:flex-nowrap justify-between gap-2 sm:gap-4 items-start">
                <div className="w-full sm:w-auto sm:flex-1 min-w-0">
                  <BlockTitleInput
                    item={item}
                    onUpdate={onUpdate}
                    onCreateBelow={onCreateBelow}
                    onDeleteAndFocusPrev={onDeleteAndFocusPrev}
                    placeholderKey="block.groupTitlePlaceholder"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                  {/* Group type label - mobile: text flush with the title above */}
                  <span
                    className="inline-block -ml-2 sm:ml-0 text-xs px-2 py-0.5 rounded-full font-medium bg-block-group-bg text-block-group-foreground"
                  >
                    Gruppe
                    {totalBlocks > 0 && (
                      <>
                        {' • '}
                        {t('block.count', { count: totalBlocks })}
                      </>
                    )}
                  </span>

                  {/* Persons */}
                  <PersonAvatarList personIds={item.personIds || []} persons={persons} />
                  
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
        </div>
      </div>

      {/* Children area - extended with dashed border */}
      {isExpanded && (
        <div 
          ref={setDroppableRef}
          className={cn(
            'group-children-area pt-6 pb-4 px-8 print:px-0 print:pr-1',
            'border-2 border-dashed border-block-group/60 border-t-0 rounded-b-lg  print:border-gray-200',
            'bg-block-group-bg',
            playState === 'current' && 'border-primary',
            isOver && 'border-block-group/90 bg-block-group/10',
            (!item.children || item.children.length === 0) && 'min-h-[120px] sm:pl-40 '
          )}
        >
          {item.children && item.children.length > 0 ? (
            <SortableContext
              items={item.children.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {item.children.map((child, childIndex) => {
                  const childTimeDisplay = onCalculateChildTime?.(item, childIndex) || null;
                  const gapMinutes = childIndex === 0
                    ? calculateFixedStartGap(child.fixedStartTime, timeDisplay)
                    : calculateFixedStartGap(
                        child.fixedStartTime,
                        onCalculateChildTime?.(item, childIndex - 1),
                        item.children![childIndex - 1].duration,
                      );

                  return (
                    <Fragment key={child.id}>
                      <GapIndicator minutes={gapMinutes ?? 0} size="sm" />
                      {child.type === 'breakout' ? (
                        <BreakoutCard
                          {...childCallbacks}
                          {...bindChildActions(child, childCallbacks)}
                          onCreateBelowChild={undefined}
                          onDeleteChildAndFocusPrev={undefined}
                          item={child}
                          blockTypes={blockTypes}
                          persons={persons}
                          showFullPreviewText={showFullPreviewText}
                          timeDisplay={childTimeDisplay}
                          onAddChild={(type, laneIndex) => onAddToChild?.(child.id, type, laneIndex)}
                          parentId={item.id}
                          playState={childPlayStates?.get(child.id)}
                          childPlayStates={childPlayStates}
                        />
                      ) : (
                        <BlockCard
                          {...bindChildBlockActions(child, childCallbacks)}
                          item={child}
                          blockType={blockTypes.find((bt) => bt.id === child.blockTypeId)}
                          blockTypes={blockTypes}
                          persons={persons}
                          showFullPreviewText={showFullPreviewText}
                          timeDisplay={childTimeDisplay}
                          parentId={item.id}
                          parentType="group"
                          playState={childPlayStates?.get(child.id)}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </SortableContext>
          ) : (
            <div className="text-center pt-8 pb-5 text-muted-foreground text-sm flex flex-col items-center justify-center">
              <p className="font-medium">{t('block.noBlocksInGroup')}</p>
              <p className="text-xs mt-1 opacity-70">{t('block.dragHereGroup')}</p>
            </div>
          )}
          
          {/* Duration difference indicator */}
          {item.children && item.children.length > 0 && durationDifference !== 0 && (
            <div className="mt-4">
              <GapIndicator minutes={durationDifference} size="md" />
            </div>
          )}
          
          {/* Add child buttons */}
          {onAddChild && (!isLg || !item.children || item.children.length === 0) && (
            <div className="my-3 print:hidden">
              <div className="flex gap-2 justify-center">
                {([
                  { type: 'block', icon: Plus, label: t('block.addBlock') },
                  { type: 'breakout', icon: SquareSplitHorizontal, label: t('sidebar.addBreakout') },
                ] as const).map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 text-xs hover:text-foreground",
                      item.children.length > 0 ? "text-muted-foreground" : "text-foreground"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddChild(type);
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
