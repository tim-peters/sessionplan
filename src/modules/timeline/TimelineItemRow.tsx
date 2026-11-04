import type { BlockType, Person, WorkshopItem } from '@/types/workshop';
import type { DropIndicator } from '@/types/dnd';
import type { PlayState } from '@/lib/playModeUtils';
import { bindContainerCardProps, type TimelineItemHandlers } from '@/lib/timelineItemProps';
import { calculateBlockTime, calculateFixedStartGap } from '@/lib/workshopUtils';
import { BlockCard } from './BlockCard';
import { BreakoutCard } from './BreakoutCard';
import { GroupCard } from './GroupCard';
import { GapIndicator } from './atoms/GapIndicator';

interface TimelineItemRowProps {
  item: WorkshopItem;
  index: number;
  items: WorkshopItem[];
  startTime: string | null;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText: boolean;
  dropIndicator?: DropIndicator | null;
  blockPlayStates?: Map<string, PlayState>;
  handlers: TimelineItemHandlers;
}

/** A top-level timeline entry: the gap before it, its drop indicator and its card. */
export const TimelineItemRow = ({
  item,
  index,
  items,
  startTime,
  blockTypes,
  persons,
  showFullPreviewText,
  dropIndicator,
  blockPlayStates,
  handlers,
}: TimelineItemRowProps) => {
  const gapMinutes = index === 0
    ? calculateFixedStartGap(item.fixedStartTime, startTime)
    : calculateFixedStartGap(
        item.fixedStartTime,
        // Also known without a global start time if the previous item has a fixed one.
        calculateBlockTime(startTime, items, index - 1),
        items[index - 1].duration,
      );

  const renderCard = () => {
    if (item.type === 'block') {
      return (
        <BlockCard
          item={item}
          blockType={blockTypes.find((type) => type.id === item.blockTypeId)}
          blockTypes={blockTypes}
          persons={persons}
          showFullPreviewText={showFullPreviewText}
          timeDisplay={calculateBlockTime(startTime, items, index)}
          onUpdate={(updates) => handlers.onUpdateItem(item.id, updates)}
          onDelete={() => handlers.onDeleteItem(item.id)}
          onDuplicate={() => handlers.onDuplicate(item)}
          onSaveToLibrary={() => handlers.onSaveToLibrary(item)}
          onEditDetails={() => handlers.openEditDialog(item)}
          onEditDetailsOnTime={() => handlers.openEditDialog(item, 'fixedStartTime')}
          onCreateBelow={handlers.onCreateBelow}
          onDeleteAndFocusPrev={handlers.onDeleteAndFocusPrev}
          playState={blockPlayStates?.get(item.id)}
        />
      );
    }
    const cardProps = bindContainerCardProps(item, index, items, startTime, handlers, {
      blockTypes,
      persons,
      showFullPreviewText,
      blockPlayStates,
    });
    return item.type === 'group' ? <GroupCard {...cardProps} /> : <BreakoutCard {...cardProps} />;
  };

  return (
    <>
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
        {dropIndicator?.overId === item.id && dropIndicator.position === 'before' && (
          <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-primary z-10 rounded-full">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
          </div>
        )}
        {renderCard()}
      </div>
    </>
  );
};
