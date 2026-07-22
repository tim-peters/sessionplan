import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { BreakoutLane } from './BreakoutLane';
import { PlayState } from '@/lib/playModeUtils';

interface ParallelLanesViewProps {
  item: WorkshopItem;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  timeDisplay: string | null;
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
  childPlayStates?: Map<string, PlayState>;
}

export const ParallelLanesView = ({
  item,
  blockTypes,
  persons,
  showFullPreviewText,
  timeDisplay,
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
  dropIndicator,
  childPlayStates,
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
            key={laneIndex}
            parentItem={item}
            laneIndex={laneIndex}
            laneChildren={laneChildren}
            blockTypes={blockTypes}
            persons={persons}
            showFullPreviewText={showFullPreviewText}
            parentTimeDisplay={timeDisplay}
            onCalculateChildTime={onCalculateChildTime}
            onUpdateChild={onUpdateChild}
            onDeleteChild={onDeleteChild}
            onDuplicateChild={onDuplicateChild}
            onSaveChildToLibrary={onSaveChildToLibrary}
            onEditChildDetails={onEditChildDetails}
            onEditChildDetailsOnTime={onEditChildDetailsOnTime}
            onAddChild={(type, laneIdx) => onAddChild?.(type, laneIdx)}
            onCreateBelowChild={onCreateBelowChild}
            onDeleteChildAndFocusPrev={onDeleteChildAndFocusPrev}
            depth={depth}
            dropIndicator={dropIndicator}
            childPlayStates={childPlayStates as never}
          />
        );
      })}
    </>
  );
}
