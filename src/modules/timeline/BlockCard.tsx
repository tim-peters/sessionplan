import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { useTranslation } from 'react-i18next';
import { DurationInput } from './atoms/DurationInput';
import { ItemStartTime } from './atoms/ItemStartTime';
import { DragHandle } from './atoms/DragHandle';
import { PersonAvatarList } from './atoms/PersonAvatarList';
import { ItemActionsMenu } from './ItemActionsMenu';
import { BlockTitleInput } from './BlockTitleInput';
import { BlockTypeSelector } from './BlockTypeSelector';
import { cn } from '@/lib/utils';
import { parseDuration } from '@/lib/workshopUtils';
import { BlockPreview } from './BlockPreview';
import { PlayState } from '@/lib/playModeUtils';
import { useIsStripHighlighted, useHoverHighlightHandlers } from '@/hooks/useHoverHighlight';

interface BlockCardProps {
  item: WorkshopItem;
  blockType: BlockType | undefined;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  stackPreviewFields?: boolean;
  /** Render time & duration in one row above the title instead of a side column (narrow breakout lanes). */
  stackTimeAboveTitle?: boolean;
  timeDisplay: string | null;
  onUpdate: (updates: Partial<WorkshopItem>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => void;
  onEditDetails: () => void;
  onEditDetailsOnTime?: () => void;
  onCreateBelow?: (item: WorkshopItem) => void;
  onDeleteAndFocusPrev?: (item: WorkshopItem) => void;
  parentId?: string | null;
  parentType?: 'group' | 'breakout' | null;
  isNested?: boolean;
  playState?: PlayState;
}

export const BlockCard = ({
  item,
  blockType,
  blockTypes,
  persons,
  showFullPreviewText = false,
  stackPreviewFields = false,
  stackTimeAboveTitle = false,
  timeDisplay,
  onUpdate,
  onDelete,
  onDuplicate,
  onSaveToLibrary,
  onEditDetails,
  onEditDetailsOnTime,
  onCreateBelow,
  onDeleteAndFocusPrev,
  parentId = null,
  parentType = null,
  isNested = false,
  playState,
}: BlockCardProps) => {
  const { t } = useTranslation('common');
  // Cross-highlight with the time-visualization strip. The card shows the
  // `time-card-highlight` outline only when the hover originated in the
  // strip (so the timeline's own native CSS hover is the sole affordance
  // when the user hovers a card directly).
  const isHighlighted = useIsStripHighlighted(item.id);
  const hoverHandlers = useHoverHighlightHandlers(item.id);
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const startTimeProps = {
    isFixed: !!item.fixedStartTime,
    onUnlock: () => onUpdate({ fixedStartTime: undefined }),
    onEdit: onEditDetailsOnTime ?? onEditDetails,
  };
  const blockTypeSelector = (
    <BlockTypeSelector blockTypes={blockTypes} selectedId={item.blockTypeId} onUpdate={onUpdate} />
  );
  const actionsMenu = (
    <ItemActionsMenu
      onEditDetails={onEditDetails}
      onDuplicate={onDuplicate}
      onSaveToLibrary={onSaveToLibrary}
      onDelete={onDelete}
    />
  );
  const preview = (
    <BlockPreview
      notes={item.notes}
      material={item.material}
      showFullText={showFullPreviewText}
      stackFields={stackPreviewFields}
      showEmptyPlaceholders={parentType !== 'breakout'}
      onUpdate={onUpdate}
    />
  );
  const titleInput = (
    <BlockTitleInput
      item={item}
      onUpdate={onUpdate}
      onCreateBelow={onCreateBelow}
      onDeleteAndFocusPrev={onDeleteAndFocusPrev}
      onClick={(e) => e.stopPropagation()}
    />
  );
  const colorIndicator = blockType && (
    <div
      className="block-type-indicator"
      style={{ backgroundColor: blockType.color }}
    />
  );

  // Nested blocks should have same layout as main blocks, but with drag handle
  if (isNested) {
    return (
      <div
        ref={setNodeRef}
        data-item-id={item.id}
        style={style}
        {...hoverHandlers}
        className={cn(
          'relative',
          isDragging && 'opacity-50',
          isHighlighted && 'time-card-highlight',
        )}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEditDetails();
          }}
          className={cn(
            'block-card group shadow-none fade-in cursor-pointer',
            playState === 'current' && 'ring-2 ring-primary',
            playState === 'past' && 'is-past',
          )}
        >
        {colorIndicator}

        <div className={cn(
          'flex items-start gap-1 p-4 pl-2 pr-0',
          stackTimeAboveTitle ? 'sm:gap-2 sm:pl-4 sm:pr-2' : 'sm:gap-3 sm:pl-5 sm:pr-4',
        )}>
          {/* Drag handle for reordering */}
          <DragHandle label={t('actions.move')} attributes={attributes} listeners={listeners} />

          {/* Time column for nested blocks */}
          {!stackTimeAboveTitle && (
          <div className="flex flex-col items-start w-11 shrink-0 xl:flex hidden print:hidden">
            {timeDisplay && (
              <ItemStartTime
                {...startTimeProps}
                time={timeDisplay}
                className="flex items-center gap-0.5"
                unlockButtonClassName="text-primary-text hover:text-muted-foreground transition-colors"
                lockIconClassName="h-2.5 w-2.5"
                timeButtonClassName="text-xs font-medium text-primary-text ml-1 time-badge is-clickable"
              />
            )}
            <div className="flex items-center gap-1 mt-1">
              {playState === 'current' && (
                <span className="text-primary-text animate-blink text-sm leading-none absolute -mt-[1.2rem] -ml-3">•</span>
              )}
              <div className="flex flex-col items-start gap-1">
                <DurationInput
                  value={item.duration}
                  onChange={(e) => onUpdate({ duration: parseDuration(e.target.value) })}
                  className="w-10 h-6"
                  min={0}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-muted-foreground ml-2">Min.</span>
              </div>
            </div>
          </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 relative">
            {stackTimeAboveTitle ? (
              /* Time and duration in one row above the title */
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 mb-1 sm:pr-6 text-xs">
                {playState === 'current' && (
                  <span className="text-primary-text animate-blink text-sm leading-none">•</span>
                )}
                {timeDisplay && (
                  <ItemStartTime
                    {...startTimeProps}
                    time={timeDisplay}
                    className="flex items-center gap-0.5"
                    unlockButtonClassName="text-primary-text hover:text-muted-foreground transition-colors print:hidden"
                    lockIconClassName="h-2.5 w-2.5"
                    timeButtonClassName="text-xs font-medium text-primary-text ml-0.5 time-badge is-clickable"
                  />
                )}
                <div className="flex items-center gap-1">
                  <DurationInput
                    value={item.duration}
                    onChange={(e) => onUpdate({ duration: parseDuration(e.target.value) })}
                    className="w-8 h-6"
                    min={0}
                    aria-label={t('dialog.duration')}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* Unit dropped on phones so time & duration fit one line in a half-width lane */}
                  <span className="text-muted-foreground hidden sm:inline print:inline">Min.</span>
                </div>
                {/* Actions live here so the title keeps the full lane width */}
                <div className="absolute top-0 right-0 hidden sm:block print:hidden">
                  {actionsMenu}
                </div>
              </div>
            ) : (timeDisplay || item.duration) && (
              <div className="hidden print:flex items-center gap-2 mb-1 text-xs">
                {timeDisplay && (
                  <span className="font-medium text-primary-text">{timeDisplay}</span>
                )}
                {timeDisplay && <span className="text-muted-foreground">•</span>}
                <span className="text-foreground">{item.duration} Min.</span>
              </div>
            )}
            
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {/* Title */}
                {titleInput}
              </div>
              <div className="flex items-start gap-2 justify-end">

                {/* Block type selector - inline */}
                {parentType !== 'breakout' && (
                  <div onClick={(e) => e.stopPropagation()} className="md:block hidden print:block">
                    {blockTypeSelector}
                  </div>
                )}

                {/* Persons */}
                <PersonAvatarList personIds={item.personIds || []} persons={persons} />

                {/* Actions */}
                {!stackTimeAboveTitle && (
                <div className={cn(parentType === 'breakout' && 'hidden sm:block')}>
                  {actionsMenu}
                </div>
                )}
              </div>
            </div>

            {preview}
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-item-id={item.id}
      {...hoverHandlers}
      className={cn(
      'flex gap-4',
      playState === 'past' && 'is-past',
      isHighlighted && 'time-card-highlight',
    )}>
      {/* Time column - left side */}
      <div className="hidden sm:flex flex-col items-end w-20 print:w-10 shrink-0 pt-4 print:flex">
        {timeDisplay && (
          <ItemStartTime
            {...startTimeProps}
            time={timeDisplay}
            className="flex items-center gap-1"
            unlockButtonClassName="text-primary-text hover:text-muted-foreground transition-colors print:hidden"
            lockIconClassName="h-3 w-3"
            timeButtonClassName="time-badge font-medium text-primary-text print:-mr-2 is-clickable -mt-2"
          />
        )}
        <div className="flex items-center gap-1 mt-1">
          {playState === 'current' && (
            <span className="text-primary-text animate-blink text-sm leading-none -mt-[1.2rem]">•</span>
          )}
          <div className="flex flex-col items-center gap-1">
            <DurationInput
              value={item.duration}
              onChange={(e) => onUpdate({ duration: parseDuration(e.target.value) })}
              onClick={(e) => e.stopPropagation()}
              className="duration-input w-8 h-7 print:pb-0"
              min={0}
            />
            <span className="text-xs text-muted-foreground">Min.</span>
          </div>
        </div>
      </div>

      {/* Block card - right side */}
      <div
        ref={setNodeRef}
        style={style}
        onClick={onEditDetails}
          className={cn(
            'block-card group shadow-none fade-in flex-1 cursor-pointer',
            isDragging && 'dragging opacity-50',
            playState === 'current' && 'ring-2 ring-primary rounded-lg',
          )}
      >
        {colorIndicator}

        <div className="flex items-start gap-3 p-4 pl-5">
          {/* Drag handle */}
          <DragHandle label={t('actions.move')} attributes={attributes} listeners={listeners} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile time/duration info */}
            <div className="sm:hidden flex items-center gap-2 mb-2 text-xs">
              {timeDisplay && (
                <ItemStartTime
                  {...startTimeProps}
                  time={timeDisplay}
                  className="flex items-center gap-1"
                  unlockButtonClassName="text-primary-text print:hidden"
                  lockIconClassName="h-3 w-3"
                  timeButtonClassName="font-medium text-primary-text time-badge is-clickable"
                />
              )}
              <div className="flex items-center gap-1">
                <DurationInput
                  value={item.duration}
                  onChange={(e) => onUpdate({ duration: parseDuration(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-12 h-6"
                  min={0}
                />
                <span className="text-muted-foreground">Min.</span>
              </div>
            </div>
            <div className="flex justify-between gap-4 items-start">
              <div className="flex-1">
                {/* Title */}
                {titleInput}
              </div>
              <div className="flex items-center gap-2 justify-end">
                {/* Block type selector - inline */}
                <div className="hidden sm:block print:block" onClick={(e) => e.stopPropagation()}>
                  {blockTypeSelector}
                </div>

                {/* Persons */}
                <PersonAvatarList personIds={item.personIds || []} persons={persons} className="mt-1" />
                
                {/* Actions */}
                {actionsMenu}
              </div>
            </div>

            {preview}
          </div>
        </div>
      </div>
    </div>
  );
};
