import { useTranslation } from 'react-i18next';
import { FolderPlus, Plus, SquareSplitHorizontal } from 'lucide-react';
import { calculateEffectiveDuration, calculateEndTime } from '@/lib/workshopUtils';
import type { WorkshopItem } from '@/types/workshop';
import { DropZone } from './DropZone';
import { DraggableAddButton } from './atoms/DraggableAddButton';
import { GapIndicator } from './atoms/GapIndicator';

interface TimelineFooterProps {
  items: WorkshopItem[];
  startTime: string | null;
  targetDuration?: number;
  durationLocked?: boolean;
  onAddBlock: () => void;
  onAddGroup: () => void;
  onAddBreakout: () => void;
}

/** End of the timeline: bottom drop zone, end time, target difference and the add buttons. */
export const TimelineFooter = ({
  items,
  startTime,
  targetDuration,
  durationLocked,
  onAddBlock,
  onAddGroup,
  onAddBreakout,
}: TimelineFooterProps) => {
  const { t } = useTranslation('common');
  const endTime = calculateEndTime(startTime, items);

  return (
    <>
      <div className="max-w-5xl mx-auto px-0 md:px-6">
        {items.length === 0 && (
          <p className="mt-12 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground sm:ml-24">
            {t('days.emptyDay')}
          </p>
        )}
        <DropZone id="drop-zone-bottom" position="bottom" />

        <div className="flex gap-4 mt-1">
          {endTime ? (
            <div className="hidden sm:flex flex-col items-end w-20 shrink-0 pt-1 print:flex">
              <span className="time-badge font-medium text-primary-text">
                {endTime}
              </span>
            </div>
          ) : (
            <div className="hidden sm:block w-20 shrink-0 print:block" />
          )}
          <div className="flex-1 mb-4">
            {endTime && (
              <span className="time-badge font-medium text-primary-text sm:hidden mb-2 block print:hidden">
                {endTime}
              </span>
            )}
            {durationLocked && !!targetDuration && (
              <GapIndicator minutes={targetDuration - calculateEffectiveDuration(items, startTime)} size="md" />
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-6 -mx-6 sm:mx-0 bottom-4 z-10 flex justify-center mt-2 print:hidden">
        <div className="flex items-center gap-2 overflow-auto pl-0">
          <DraggableAddButton
            type="new-block"
            icon={Plus}
            label={t('block.newBlock').split(' ').at(-1)!}
            shortcutId="addBlock"
            onClick={onAddBlock}
          />
          <DraggableAddButton
            type="new-group"
            icon={FolderPlus}
            label={t('sidebar.group')}
            shortcutId="addGroup"
            onClick={onAddGroup}
          />
          <DraggableAddButton
            type="new-breakout"
            icon={SquareSplitHorizontal}
            label={t('sidebar.breakout')}
            shortcutId="addBreakout"
            onClick={onAddBreakout}
          />
        </div>
      </div>
    </>
  );
};
