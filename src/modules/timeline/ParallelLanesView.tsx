import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { BreakoutLane } from './BreakoutLane';
import { PlayState } from '@/lib/playModeUtils';
import type { ChildItemCallbacks } from '@/lib/timelineItemProps';

interface ParallelLanesViewProps extends ChildItemCallbacks {
  item: WorkshopItem;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  timeDisplay: string | null;
  onAddChild?: (type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  childPlayStates?: Map<string, PlayState>;
}

export const ParallelLanesView = ({
  item,
  blockTypes,
  persons,
  showFullPreviewText,
  timeDisplay,
  onAddChild,
  childPlayStates,
  ...childCallbacks
}: ParallelLanesViewProps) => {
  return (
    <>
      {Array.from({ length: item.lanes || 2 }).map((_, laneIndex) => {
        const laneChildren =
          item.children?.filter(
            (child) => child && (child.laneIndex ?? 0) === laneIndex,
          ) || [];

        return (
          <BreakoutLane
            {...childCallbacks}
            key={laneIndex}
            parentItem={item}
            laneIndex={laneIndex}
            laneChildren={laneChildren}
            blockTypes={blockTypes}
            persons={persons}
            showFullPreviewText={showFullPreviewText}
            parentTimeDisplay={timeDisplay}
            onAddChild={onAddChild}
            childPlayStates={childPlayStates}
          />
        );
      })}
    </>
  );
}
