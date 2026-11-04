/**
 * DayStrip — Day selection of a multi-day plan on mobile: a tab strip inside the
 * header card, with the menu on the active day. Only shown once a plan has at
 * least two days.
 * Used by: WorkshopPlanner
 */
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { useDayTabs } from '@/hooks/useDayTabs';
import { formatShortDate } from '@/lib/workshop-days';
import { MAX_DAYS } from '@/types/workshop';
import { cn } from '@/lib/utils';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import {
  DayButton,
  DayOptionsMenu,
  DayRenameInput,
  DeleteDayDialog,
  type DayTabsProps,
} from '@/modules/planner/DayTabParts';

export const DayStrip = (props: DayTabsProps) => {
  const { days, activeDayId, liveDayId, dateLocale, onAdd, onDuplicate, onRemove, onMove } = props;
  const { t } = useTranslation('common');
  const { withHint, hintAttrs } = useShortcutLabels();
  const tabs = useDayTabs(props);
  const canAdd = days.length < MAX_DAYS;

  return (
    <div className="order-first flex items-end gap-1 border-b bg-muted/40 px-2 pt-1.5 print:hidden">
      {/* The scroller reaches over the border by 1px without clipping, so the
          active tab can replace that border and join the title row. */}
      <div
        role="group"
        aria-label={t('days.tabsLabel')}
        className="-mb-px flex min-w-0 items-end gap-1 overflow-x-auto pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((day, index) => {
          const isActive = day.id === activeDayId;
          const isRenaming = tabs.renamingId === day.id;
          const date = formatShortDate(day.date, dateLocale);

          return (
            <div
              key={day.id}
              className={cn(
                'flex shrink-0 items-center overflow-hidden rounded-t-lg border border-b-0 text-sm transition-colors',
                isActive ? '-mb-px border-border bg-card text-foreground' : 'border-transparent text-muted-foreground',
              )}
            >
              {isRenaming ? (
                <DayRenameInput
                  value={tabs.renameValue}
                  placeholder={t('days.label', { index: index + 1 })}
                  onChange={tabs.setRenameValue}
                  onCommit={tabs.commitRename}
                  onCancel={tabs.cancelRename}
                  className="mx-1 my-1 h-7 w-36 px-2 py-0 font-medium"
                />
              ) : (
                <DayButton
                  ref={tabs.registerDayButton(day.id)}
                  days={days}
                  index={index}
                  isActive={isActive}
                  isLive={day.id === liveDayId}
                  dateLocale={dateLocale}
                  onClick={() => tabs.handleDayClick(day)}
                  onKeyDown={(event) => tabs.handleDayKeyDown(event, index)}
                  className={cn('rounded-t-lg py-1.5 pl-3', isActive ? 'pr-1 hover:bg-transparent active:bg-transparent' : 'pr-3')}
                >
                  {date && <span className="hidden text-xs text-muted-foreground sm:inline">{date}</span>}
                </DayButton>
              )}
              {isActive && !isRenaming && (
                <DayOptionsMenu
                  days={days}
                  index={index}
                  triggerClassName="mr-1"
                  onRename={tabs.startRename}
                  onDuplicate={onDuplicate}
                  onMove={onMove}
                  onDelete={tabs.requestRemove}
                />
              )}
            </div>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        disabled={!canAdd}
        onClick={() => onAdd()}
        className="mb-0 h-7 w-7 shrink-0 text-muted-foreground"
        title={canAdd ? withHint(t('days.add'), 'addDay') : t('days.maxReached', { count: MAX_DAYS })}
        aria-label={t('days.add')}
        {...hintAttrs('addDay')}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <DeleteDayDialog days={days} day={tabs.confirmDay} onClose={tabs.closeDeleteDialog} onConfirm={onRemove} />
    </div>
  );
};
