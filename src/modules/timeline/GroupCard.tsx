import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { ChevronDown, ChevronRight, Plus, Lock, Unlock, FolderPlus, SquareSplitHorizontal } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { DurationInput } from './atoms/DurationInput';
import { DragHandle } from './atoms/DragHandle';
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

interface GroupCardProps {
  item: WorkshopItem;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  timeDisplay: string | null;
  startTime: string | null;
  onUpdate: (updates: Partial<WorkshopItem>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => void;
  onEditDetails: () => void;
  onAddChild?: (type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  onAddToChild?: (childId: string, type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
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
  depth?: number;
  dropIndicator?: { overId: string; position: 'before' | 'after' } | null;
  playState?: PlayState;
  childPlayStates?: Map<string, PlayState>;
}

export const GroupCard = ({
  item,
  blockTypes,
  persons,
  showFullPreviewText = false,
  timeDisplay,
  startTime,
  onUpdate,
  onDelete,
  onDuplicate,
  onSaveToLibrary,
  onEditDetails,
  onAddChild,
  onAddToChild,
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
  depth = 0,
  dropIndicator,
  playState,
  childPlayStates,
}: GroupCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation('common');
  const { activeParentId: contextActiveParentId } = useDragDropContext();
  const isLg = useIsLg();
  // Cross-highlight with the time-visualization strip: hovering the group's
  // title card brightens the group's line in the strip (same mechanism as
  // BlockCard/BreakoutCard).
  const hoverHandlers = useHoverHighlightHandlers(item.id);
  
  // Set up droppable for group
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `container-${item.id}`,
    disabled: !isExpanded || contextActiveParentId === item.id,
    data: {
      containerId: item.id,
    },
  });
  
  // Use sortable for the group card itself
  const sortable = useSortable({ 
    id: item.id,
    data: {
      parentId: parentId,
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  
  // Calculate children duration sum
  const childrenDurationSum = item.children 
    ? item.children.reduce((sum, child) => {
        // For breakouts, use their duration directly (parallel time)
        // For blocks, add their duration (sequential time)
        return sum + child.duration;
      }, 0)
    : 0;
  
  const durationDifference = item.duration - childrenDurationSum;
  const totalBlocks = item.children?.length || 0;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        'group-container fade-in -mx-8 my-6 print:mx-0',
        isDragging && 'opacity-50',
        playState === 'past' && 'opacity-50 grayscale',
      )}
    >
      {/* Title area with background */}
      <div className="px-0">
        {/* Title card */}
        <div
          onClick={onEditDetails}
          {...hoverHandlers}
          className={cn(
            'group-title-area group cursor-pointer bg-block-group-bg border-2 border-dashed border-block-group/60 p-4 hover:bg-block-group/10 hover:shadow-md transition-shadow print:border-gray-200 print:pr-1',
            'relative',
            isExpanded ? 'rounded-t-lg border-b-block-group/40' : 'rounded-lg',
            playState === 'current' && 'border-primary',
          )}
          style={{ borderBottomStyle: isExpanded ? 'solid' : 'dashed', borderBottomWidth: isExpanded ? '.5px' : '2px' }}
        >

          <div className="flex items-start gap-3 pl-2 mt-2 print:pl-0 print:mt-0">
            <DragHandle attributes={attributes} listeners={listeners} />

            {/* Duration elements - desktop only */}
            <div className="hidden sm:flex flex-col items-end shrink-0 -mt-2 mr-5 print:hidden">
              {timeDisplay && (
                <div className="flex items-center gap-1">
                  {item.fixedStartTime && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdate({ fixedStartTime: undefined }); }}
                      className="text-primary hover:text-foreground transition-colors p-0.5 print:hidden -mr-1"
                      title={t('block.unlockStartTime')}
                    >
                      <Lock className="h-3 w-3" />
                    </button>
                  )}
                  <span
                    className="text-xs font-medium text-primary mr-1 time-badge is-clickable"
                    onClick={(e) => { e.stopPropagation(); (onEditDetailsOnTime ?? onEditDetails)(); }}
                  >{timeDisplay}</span>
                </div>
              )}
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ durationLocked: !item.durationLocked });
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 print:hidden"
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
                    "w-10 h-6",
                    !item.durationLocked && "opacity-50 cursor-pointer"
                  )}
                  min={0}
                />
              </div>
            <span className="text-xs text-muted-foreground mr-2">Min.</span>
            </div>

            {/* Expand/collapse */}
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

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Mobile duration - only on mobile */}
              <div className="sm:hidden flex items-center gap-2 mb-2 text-xs print:flex print:mb-0">
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({ durationLocked: !item.durationLocked });
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 print:hidden"
                    title={item.durationLocked ? t('dialog.unlockDuration') : t('planner.unlockDuration')}
                  >
                    {item.durationLocked ? (
                      <Lock className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
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
                      "w-12 h-6 print:w-8",
                      !item.durationLocked && "opacity-50 cursor-pointer"
                    )}
                    min={0}
                  />
                  <span className="text-muted-foreground">Min.</span>
                </div>
              </div>
              
              <div className="flex justify-between gap-4 items-start">
                <div className="flex-1">
                  <BlockTitleInput
                    item={item}
                    onUpdate={onUpdate}
                    onCreateBelow={onCreateBelow}
                    onDeleteAndFocusPrev={onDeleteAndFocusPrev}
                    placeholderKey="block.groupTitlePlaceholder"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  {/* Group type label */}
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-block-group-bg text-block-group"
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
                  
                  {/* Actions */}
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
                  const childBlockType = blockTypes.find(bt => bt.id === child.blockTypeId);
                  const childTimeDisplay = onCalculateChildTime?.(item, childIndex) || null;

                  // Compute gap before this child if it has a fixedStartTime
                  let gapMinutes: number | null = null;
                  if (child.fixedStartTime) {
                    if (childIndex === 0 && timeDisplay) {
                      const [ph, pm] = timeDisplay.split(':').map(Number);
                      const [fh, fm] = child.fixedStartTime.split(':').map(Number);
                      gapMinutes = fh * 60 + fm - (ph * 60 + pm);
                    } else if (childIndex > 0 && onCalculateChildTime) {
                      const prevChildTime = onCalculateChildTime(item, childIndex - 1);
                      const prevChild = item.children![childIndex - 1];
                      if (prevChildTime) {
                        const [ph, pm] = prevChildTime.split(':').map(Number);
                        const [fh, fm] = child.fixedStartTime.split(':').map(Number);
                        gapMinutes = fh * 60 + fm - (ph * 60 + pm + prevChild.duration);
                      }
                    }
                  }

                  if (child.type === 'breakout') {
                    return (
                      <Fragment key={child.id}>
                        <GapIndicator minutes={gapMinutes ?? 0} size="sm" />
                        <BreakoutCard
                        item={child}
                        blockTypes={blockTypes}
                        persons={persons}
                        showFullPreviewText={showFullPreviewText}
                        timeDisplay={childTimeDisplay}
                        onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                        onDelete={() => onDeleteChild?.(child.id)}
                        onDuplicate={() => onDuplicateChild?.(child.id)}
                        onSaveToLibrary={() => onSaveChildToLibrary?.(child.id)}
                        onEditDetails={() => onEditChildDetails?.(child.id)}
                        onEditDetailsOnTime={() => onEditChildDetailsOnTime?.(child.id)}
                        onAddChild={(type, laneIndex) => onAddToChild?.(child.id, type, laneIndex)}
                        onUpdateChild={onUpdateChild}
                        onDeleteChild={onDeleteChild}
                        onDuplicateChild={onDuplicateChild}
                        onSaveChildToLibrary={onSaveChildToLibrary}
                        onEditChildDetails={onEditChildDetails}
                        onEditChildDetailsOnTime={onEditChildDetailsOnTime}
                        onCalculateChildTime={onCalculateChildTime}
                        parentId={item.id}
                        isNested={false}
                        depth={depth + 1}
                        dropIndicator={dropIndicator}
                        playState={childPlayStates?.get(child.id)}
                        childPlayStates={childPlayStates}
                        />
                      </Fragment>
                    );
                  }
                  
                  // Render block
                  return (
                    <Fragment key={child.id}>
                      <GapIndicator minutes={gapMinutes ?? 0} size="sm" />
                      <BlockCard
                      item={child}
                      blockType={childBlockType}
                      blockTypes={blockTypes}
                      persons={persons}
                      showFullPreviewText={showFullPreviewText}
                      timeDisplay={childTimeDisplay}
                      onUpdate={(updates) => onUpdateChild?.(child.id, updates)}
                      onDelete={() => onDeleteChild?.(child.id)}
                      onDuplicate={() => onDuplicateChild?.(child.id)}
                      onSaveToLibrary={() => onSaveChildToLibrary?.(child.id)}
                      onEditDetails={() => onEditChildDetails?.(child.id)}
                      onEditDetailsOnTime={() => onEditChildDetailsOnTime?.(child.id)}
                      onCreateBelow={(childItem) => onCreateBelowChild?.(childItem.id)}
                      onDeleteAndFocusPrev={(childItem) => onDeleteChildAndFocusPrev?.(childItem.id)}
                      parentId={item.id}
                      parentType="group"
                      isNested={false}
                      depth={depth + 1}
                      playState={childPlayStates?.get(child.id)}
                    />
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
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 text-xs hover:text-foreground",
                    item.children.length > 0 ? "text-muted-foreground" : "text-foreground"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild('block');
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t('block.addBlock')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 text-xs hover:text-foreground",
                    item.children.length > 0 ? "text-muted-foreground" : "text-foreground"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild('breakout');
                  }}
                >
                  <SquareSplitHorizontal className="h-4 w-4" />
                  {t('sidebar.addBreakout')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
