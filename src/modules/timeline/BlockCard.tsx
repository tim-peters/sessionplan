import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { DurationInput } from './atoms/DurationInput';
import { DragHandle } from './atoms/DragHandle';
import { PersonAvatarList } from './atoms/PersonAvatarList';
import { ItemActionsMenu } from './ItemActionsMenu';
import { BlockTitleInput } from './BlockTitleInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/primitives/select';
import { cn } from '@/lib/utils';
import { getBlockTypeName } from '@/lib/workshopUtils';
import { BlockPreview } from './BlockPreview';
import { PlayState } from '@/lib/playModeUtils';

interface BlockCardProps {
  item: WorkshopItem;
  blockType: BlockType | undefined;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
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
  depth?: number;
  playState?: PlayState;
}

export const BlockCard = ({
  item,
  blockType,
  blockTypes,
  persons,
  showFullPreviewText = false,
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
  depth = 0,
  playState,
}: BlockCardProps) => {
  const { t } = useTranslation('common');
  // Use sortable for dragging
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  
  // Nested blocks should have same layout as main blocks, but with drag handle
  if (isNested) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className={cn(
          'relative',
          isDragging && 'opacity-50'
        )}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEditDetails();
          }}
          className={cn(
            'block-card shadow-none fade-in cursor-pointer',
            playState === 'current' && 'ring-2 ring-primary',
            playState === 'past' && 'opacity-40 grayscale',
          )}
        >
        {/* Color indicator */}
        {blockType && (
          <div
            className="block-type-indicator"
            style={{ backgroundColor: blockType.color }}
          />
        )}

        <div className="flex items-start gap-1 sm:gap-3 p-4 pl-2 pr-0 sm:pl-5 sm:pr-4">
          {/* Drag handle for reordering */}
          <DragHandle attributes={attributes} listeners={listeners} />

          {/* Time column for nested blocks */}
          <div className="flex flex-col items-start w-11 shrink-0 xl:flex hidden print:hidden">
            {timeDisplay && (
              <div className="flex items-center gap-0.5">
                {item.fixedStartTime && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUpdate({ fixedStartTime: undefined }); }}
                    className="text-primary hover:text-muted-foreground transition-colors"
                    title={t('block.unlockStartTime')}
                  >
                    <Lock className="h-2.5 w-2.5" />
                  </button>
                )}
            <span
              className="text-xs font-medium text-primary ml-1 time-badge is-clickable"
              onClick={(e) => { e.stopPropagation(); (onEditDetailsOnTime ?? onEditDetails)(); }}
            >{timeDisplay}</span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              {playState === 'current' && (
                <span className="text-primary animate-blink text-sm leading-none absolute -mt-[1.2rem] -ml-3">•</span>
              )}
              <div className="flex flex-col items-start gap-1">
                <DurationInput
                  value={item.duration}
                  onChange={(e) => onUpdate({ duration: parseInt(e.target.value) || 0 })}
                  className="w-10 h-6"
                  min={0}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-muted-foreground ml-2">Min.</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Time and duration for print - shown above title */}
            {(timeDisplay || item.duration) && (
              <div className="hidden print:flex items-center gap-2 mb-1 text-xs">
                {timeDisplay && (
                  <span className="font-medium text-primary">{timeDisplay}</span>
                )}
                {timeDisplay && <span className="text-muted-foreground">•</span>}
                <span className="text-foreground">{item.duration} Min.</span>
              </div>
            )}
            
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {/* Title */}
                <BlockTitleInput
                  item={item}
                  onUpdate={onUpdate}
                  onCreateBelow={onCreateBelow}
                  onDeleteAndFocusPrev={onDeleteAndFocusPrev}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-start gap-2 justify-end">

                {/* Block type selector - inline */}
                {parentType !== 'breakout' && (
                  <div onClick={(e) => e.stopPropagation()} className="md:block hidden print:block">
                    <Select
                      value={item.blockTypeId || ''}
                      onValueChange={(value) => onUpdate({ blockTypeId: value })}
                    >
                      <SelectTrigger className="w-auto h-7 text-xs gap-2 border-none bg-muted/50 hover:bg-muted print:hidden">
                        <SelectValue placeholder={t('block.typePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {blockTypes.map((bt) => (
                          <SelectItem key={bt.id} value={bt.id}>
                            <span className="flex items-center gap-2">
                              <span>{getBlockTypeName(bt, t)}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Persons */}
                <PersonAvatarList personIds={item.personIds || []} persons={persons} />

                {/* Actions */}
                <div className={cn(parentType === 'breakout' && 'hidden sm:block')}>
                  <ItemActionsMenu
                    onEditDetails={onEditDetails}
                    onDuplicate={onDuplicate}
                    onSaveToLibrary={onSaveToLibrary}
                    onDelete={onDelete}
                  />
                </div>
              </div>
            </div>

            <BlockPreview notes={item.notes} material={item.material} showFullText={showFullPreviewText} onUpdate={onUpdate} />
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex gap-4',
      playState === 'past' && 'opacity-50 grayscale',
    )}>
      {/* Time column - left side */}
      <div className="hidden sm:flex flex-col items-end w-20 print:w-10 shrink-0 pt-4 print:flex">
        {timeDisplay && (
          <div className="flex items-center gap-1">
            {item.fixedStartTime && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate({ fixedStartTime: undefined }); }}
                className="text-primary hover:text-muted-foreground transition-colors print:hidden"
                title={t('block.unlockStartTime')}
              >
                <Lock className="h-3 w-3" />
              </button>
            )}
            <span
              className="time-badge font-medium text-primary print:-mr-2 is-clickable -mt-2"
              onClick={(e) => { e.stopPropagation(); (onEditDetailsOnTime ?? onEditDetails)(); }}
            >{timeDisplay}</span>
          </div>
        )}
        <div className="flex items-center gap-1 mt-1">
          {playState === 'current' && (
            <span className="text-primary animate-blink text-sm leading-none -mt-[1.2rem]">•</span>
          )}
          <div className="flex flex-col items-center gap-1">
            <DurationInput
              value={item.duration}
              onChange={(e) => onUpdate({ duration: parseInt(e.target.value) || 0 })}
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
            'block-card shadow-none fade-in flex-1 cursor-pointer',
            isDragging && 'dragging opacity-50',
            playState === 'current' && 'ring-2 ring-primary rounded-lg',
          )}
      >
        {/* Color indicator */}
        {blockType && (
          <div
            className="block-type-indicator"
            style={{ backgroundColor: blockType.color }}
          />
        )}

        <div className="flex items-start gap-3 p-4 pl-5">
          {/* Drag handle */}
          <DragHandle attributes={attributes} listeners={listeners} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile time/duration info */}
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
                  onChange={(e) => onUpdate({ duration: parseInt(e.target.value) || 0 })}
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
                <BlockTitleInput
                  item={item}
                  onUpdate={onUpdate}
                  onCreateBelow={onCreateBelow}
                  onDeleteAndFocusPrev={onDeleteAndFocusPrev}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                {/* Block type selector - inline */}
                <div className="hidden sm:block print:block" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={item.blockTypeId || ''}
                    onValueChange={(value) => onUpdate({ blockTypeId: value })}
                  >
                    <SelectTrigger className="w-auto h-7 text-xs gap-2 border-none bg-muted/50 hover:bg-muted print:hidden">
                      <SelectValue placeholder={t('block.typePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {blockTypes.map((bt) => (
                        <SelectItem key={bt.id} value={bt.id}>
                          <span className="flex items-center gap-2">
                            <span>{getBlockTypeName(bt, t)}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Persons */}
                <PersonAvatarList personIds={item.personIds || []} persons={persons} className="mt-1" />
                
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
  );
};
