/**
 * DayControls — Date, start time and duration of the plan or active day.
 *
 * Role: Shared by the planner header and the active day box of a multi-day
 *       plan. Render one instance at a time: the keyboard shortcuts look up the
 *       `data-date-trigger` / `data-start-time-trigger` buttons.
 * Used by: WorkshopHeader, WorkshopPlanner
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, CalendarPlus, Clock, Lock, Unlock } from 'lucide-react';
import { WorkshopMetadata } from '@/types/workshop';
import { formatDuration } from '@/lib/workshopStorage';
import { parseDuration } from '@/lib/workshopUtils';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import { Button } from '@/components/primitives/button';
import { Input } from '@/components/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/primitives/popover';
import { cn } from '@/lib/utils';

interface DayControlsProps {
  metadata: WorkshopMetadata;
  totalDuration: number;
  onUpdate: (updates: Partial<WorkshopMetadata>) => void;
  startTimePopoverOpen?: boolean;
  onStartTimePopoverOpenChange?: (open: boolean) => void;
  /** Adds a second day; offered next to the open date popover. */
  onAddDay?: () => void;
  /** Foreground instead of muted icons, for the day box's grey background. */
  strongIcons?: boolean;
}

export const DayControls = ({
  metadata,
  totalDuration,
  onUpdate,
  startTimePopoverOpen,
  onStartTimePopoverOpenChange,
  onAddDay,
  strongIcons = false,
}: DayControlsProps) => {
  const { t } = useTranslation('common');
  const { withHint, hintAttrs } = useShortcutLabels();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const idleColor = strongIcons ? 'text-foreground' : 'text-muted-foreground';

  return (
    <div className="flex gap-2 pr-1">
      {/* Date popover */}
      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="plain" size="none"
            className={cn(
              'inline-flex items-center justify-center p-1.5 rounded-md transition-colors shrink-0 print:hidden',
              datePopoverOpen && 'bg-accent',
              metadata.date ? 'text-primary-text' : idleColor
            )}
            title={withHint(t('planner.datePlaceholder'), 'openDate')}
            data-date-trigger
            {...hintAttrs('openDate')}
          >
            <Calendar className="h-4 w-4 print:hidden" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <Input
            type="date"
            value={metadata.date || ''}
            onChange={(e) => onUpdate({ date: e.target.value || null })}
            className="h-8 w-36 text-sm"
          />
          {onAddDay && (
            // Next to the popover box, but part of it: a click here must not dismiss it first.
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDatePopoverOpen(false);
                onAddDay();
              }}
              className="absolute left-full top-1/2 ml-2 h-8 w-8 -translate-y-1/2 rounded-xl border bg-popover text-muted-foreground shadow-md"
              title={withHint(t('days.add'), 'addDay')}
              aria-label={t('days.add')}
            >
              <CalendarPlus className="h-4 w-4" />
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {/* Time popover */}
      <Popover open={startTimePopoverOpen} onOpenChange={onStartTimePopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="plain" size="none"
            className={cn(
              'inline-flex items-center justify-center p-1.5 rounded-md transition-colors shrink-0 print:hidden',
              startTimePopoverOpen && 'bg-accent',
              metadata.startTime ? 'text-primary-text' : idleColor
            )}
            title={withHint(t('planner.startTimePlaceholder'), 'openStartTime')}
            data-start-time-trigger
            {...hintAttrs('openStartTime')}
          >
            <Clock className="h-4 w-4 print:hidden" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <Input
            type="time"
            value={metadata.startTime || ''}
            onChange={(e) => onUpdate({ startTime: e.target.value || null })}
            className="h-8 w-24 text-sm"
          />
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-1">
        {metadata.durationLocked && (
          <Button variant="plain" size="none"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ durationLocked: !metadata.durationLocked });
            }}
            className={cn('inline-flex items-center justify-center rounded-md p-1.5 hover:text-foreground print:hidden', idleColor)}
            title={metadata.durationLocked ? t('planner.unlockDuration') : t('planner.lockDuration')}
          >
            <Lock className="h-4 w-4 text-primary-text" />
          </Button>
        )}
        {metadata.durationLocked ? (
          <>
            <Input
              type="number"
              value={metadata.targetDuration || 0}
              onChange={(e) => onUpdate({ targetDuration: parseDuration(e.target.value) })}
              className="h-8 w-8 px-0 md:-my-2 text-center text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] print:border-none print:p-0"
              min={0}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="font-medium text-sm text-muted-foreground">{t('planner.totalMin')}</span>
          </>
        ) : (
          <>
            <Button variant="plain" size="none"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ durationLocked: true, targetDuration: totalDuration });
              }}
              className={cn('inline-flex items-center justify-center rounded-md p-1.5 hover:text-foreground print:hidden', idleColor)}
              title={t('planner.lockDuration')}
            >
              <Unlock className="h-4 w-4" />
            </Button>
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ durationLocked: true, targetDuration: totalDuration });
              }}
              className="font-medium text-foreground truncate"
            >
              {formatDuration(totalDuration)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
