/**
 * DayBoxes — Day selection of a multi-day plan on desktop: one box per day next
 * to the header, the active one also holds the date, start time and duration
 * controls. When the boxes do not all fit, only the active one stays and lists
 * all days in a menu. Only shown once a plan has at least two days.
 * Used by: WorkshopPlanner
 */
import { ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { EditableFieldPencil } from '@/components/atoms/EditableFieldPencil';
import { useDayBoxesFit } from '@/hooks/useDayBoxesFit';
import { useDayTabs } from '@/hooks/useDayTabs';
import { MAX_DAYS } from '@/types/workshop';
import { cn } from '@/lib/utils';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import {
  DayButton,
  DayListMenu,
  DayOptionsMenu,
  DayRenameInput,
  DeleteDayDialog,
  type DayTabsProps,
} from '@/modules/planner/DayTabParts';

interface DayBoxesProps extends DayTabsProps {
  /** Rendered in the active day's box. */
  activeControls?: ReactNode;
}

export const DayBoxes = ({ activeControls, ...props }: DayBoxesProps) => {
  const { days, activeDayId, liveDayId, dateLocale, onAdd, onDuplicate, onRemove, onMove } = props;
  const { t } = useTranslation('common');
  const { withHint, hintAttrs } = useShortcutLabels();
  const tabs = useDayTabs(props);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const collapsed = !useDayBoxesFit(containerRef, listRef);
  const canAdd = days.length < MAX_DAYS;

  return (
    // Takes all free space, which is what the boxes are measured against. Collapsed,
    // it starts from the active box, so the session title gives way first.
    <div
      ref={containerRef}
      className={cn(
        'hidden min-w-0 peer-hover:[&_[data-day-add]:enabled]:opacity-100 md:flex',
        collapsed ? 'flex-[1_1_auto]' : 'flex-[1_1_0%]',
      )}
    >
      {/* Reaches across the row gap, so the add button stays while moving over from the header. */}
      <div className="group/days -ml-3 flex min-w-0 items-start gap-1 self-stretch pl-3 print:hidden">
        {/* The padding keeps shadows and focus rings from being clipped. */}
        <div
          ref={listRef}
          role="group"
          aria-label={t('days.tabsLabel')}
          className={cn(
            '-m-1 mr-0 flex min-w-0 items-start gap-2 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            collapsed && 'relative',
          )}
        >
          {days.map((day, index) => {
            const isActive = day.id === activeDayId;
            const isRenaming = tabs.renamingId === day.id;

            return (
              <div
                key={day.id}
                data-shortcut-bar
                className={cn(
                  // Same height as the action bar next to it.
                  'flex h-[2.875rem] shrink-0 items-center overflow-hidden rounded-xl border bg-card/95 text-sm shadow-sm backdrop-blur transition-colors supports-[backdrop-filter]:bg-card/70',
                  isActive
                    ? 'text-foreground border-foreground/25'
                    // supports-[…] would otherwise win over a plain hover background.
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground supports-[backdrop-filter]:hover:bg-accent',
                  // Out of the flow but still measured, to find out when all boxes fit again.
                  collapsed && !isActive && 'invisible absolute left-0 top-0 w-max',
                )}
              >
                {isRenaming ? (
                  // Grows with the text like the session title; its padding keeps the title in place.
                  <span className={cn('ml-2.5 inline-grid max-w-[12.5rem] grid-cols-[minmax(0,1fr)]', isActive ? 'mr-5' : 'mr-3')}>
                    <DayRenameInput
                      value={tabs.renameValue}
                      placeholder={t('days.label', { index: index + 1 })}
                      onChange={tabs.setRenameValue}
                      onCommit={tabs.commitRename}
                      onCancel={tabs.cancelRename}
                      className="editable-field col-start-1 row-start-1 h-auto w-0 min-w-full rounded border-0 bg-transparent px-1 py-0 font-medium ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <span aria-hidden className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre px-1 font-medium">
                      {tabs.renameValue || t('days.label', { index: index + 1 })}
                    </span>
                  </span>
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
                    className={cn('rounded-xl pl-3.5 hover:bg-transparent active:bg-transparent', isActive ? 'pr-6' : 'pr-4')}
                  >
                    {/* In the right padding, so the box width does not change on hover. */}
                    {isActive && <EditableFieldPencil className="absolute right-1.5 top-1/2 mt-0 -translate-y-1/2" />}
                  </DayButton>
                )}
                {collapsed && isActive && !isRenaming && (
                  <DayListMenu
                    days={days}
                    activeDayId={activeDayId}
                    liveDayId={liveDayId}
                    dateLocale={dateLocale}
                    onPick={tabs.selectWithFocus}
                    onAdd={() => {
                      tabs.focusActiveDayNext();
                      onAdd();
                    }}
                  />
                )}
                {/* Darkens instead of painting a solid colour, so the box stays translucent. */}
                <div className={cn('flex items-center gap-2 self-stretch pl-2 pr-1.5', isActive && 'bg-black/5 dark:bg-black/25')}>
                  {isActive && activeControls}
                  <DayOptionsMenu
                    days={days}
                    index={index}
                    // The hovered box already has the accent background.
                    triggerClassName={cn(!isActive && 'hover:bg-foreground/10')}
                    onRename={tabs.startRename}
                    onDuplicate={onDuplicate}
                    onMove={onMove}
                    onDelete={tabs.requestRemove}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            disabled={!canAdd}
            onClick={() => onAdd()}
            data-day-add=""
            className="mt-[7px] h-8 w-8 shrink-0 rounded-xl border bg-card/60 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity focus-visible:opacity-100 disabled:opacity-0 group-hover/days:opacity-100 group-hover/days:disabled:opacity-50 [@media(hover:none)]:opacity-100"
            title={canAdd ? withHint(t('days.add'), 'addDay') : t('days.maxReached', { count: MAX_DAYS })}
            aria-label={t('days.add')}
            {...hintAttrs('addDay')}
          >
            <CalendarPlus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <DeleteDayDialog days={days} day={tabs.confirmDay} onClose={tabs.closeDeleteDialog} onConfirm={onRemove} />
    </div>
  );
};
