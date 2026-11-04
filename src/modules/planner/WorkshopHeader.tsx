import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';
import { WorkshopMetadata } from '@/types/workshop';
import { formatDuration } from '@/lib/workshopStorage';
import { getWorkshopTitle } from '@/lib/workshopUtils';
import { CalendarPlus, PanelLeft } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { EditableFieldPencil } from '@/components/atoms/EditableFieldPencil';
import { DayControls } from '@/modules/planner/DayControls';
import { cn } from '@/lib/utils';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';

interface WorkshopHeaderProps {
  metadata: WorkshopMetadata;
  totalDuration: number;
  onUpdate: (updates: Partial<WorkshopMetadata>) => void;
  onMenuClick: () => void;
  isSidebarCollapsed?: boolean;
  startTimePopoverOpen?: boolean;
  onStartTimePopoverOpenChange?: (open: boolean) => void;
  asHeading?: boolean;
  /** Multi-day plan on desktop: only the session title, the day boxes sit next to the header. */
  titleOnly?: boolean;
  /** Day tab strip of a multi-day plan on mobile, part of the header card. */
  dayTabs?: ReactNode;
  /** Turns a single-day plan into a multi-day plan. */
  onAddDay?: () => void;
  /** Name of the active day of a multi-day plan; the day tabs are not printed. */
  printDayLabel?: string;
}

export const WorkshopHeader = ({
  metadata,
  totalDuration,
  onUpdate,
  onMenuClick,
  isSidebarCollapsed = false,
  startTimePopoverOpen,
  onStartTimePopoverOpenChange,
  asHeading = false,
  titleOnly = false,
  dayTabs,
  onAddDay,
  printDayLabel,
}: WorkshopHeaderProps) => {
  const { t } = useTranslation('common');
  const { withHint, hintAttrs } = useShortcutLabels();
  const TitleWrapper = asHeading ? 'h1' : 'div';
  const displayTitle = getWorkshopTitle(metadata.title, t);


  return (
    <>
    <header data-shortcut-bar className={cn(
      'peer',
      !asHeading ? 'hidden md:flex' : 'flex',
      'flex-col',
      'order-2 w-full flex-1 md:order-none md:w-auto md:flex-none',
      // A long session title must leave room for the day boxes; it gives way first when space runs out.
      titleOnly && 'md:min-w-24 md:max-w-xs md:shrink-[100] print:max-w-none',
      'md:bg-card/95 md:backdrop-blur md:supports-[backdrop-filter]:bg-card/70',
      'border-b md:border md:rounded-2xl shadow-sm overflow-hidden',
      'print:static print:w-full print:bg-card print:rounded-none print:shadow-none print:backdrop-blur-none',
    )}>
      <div className="planner-header-content">
        <div className="flex items-stretch flex-row justify-between gap-0 print:w-full">
          <div className="flex min-w-0 items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className={cn('hidden md:flex shrink-0 print:hidden h-8 w-8 -ml-1', !isSidebarCollapsed && 'lg:hidden')}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
            <TitleWrapper
              aria-label={asHeading ? (displayTitle || t('planner.titlePlaceholder')) : undefined}
              className="inline-grid self-center md:min-w-[8ch] md:max-w-[100ch] -m-1 p-1 overflow-hidden whitespace-nowrap text-ellipsis relative"
            >
              <input
                type="text"
                value={displayTitle}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className={cn(
                  'session-title-input editable-field col-start-1 row-start-1 text-lg font-semibold bg-transparent border-none min-w-0 rounded px-1 overflow-hidden whitespace-nowrap text-ellipsis',
                  // Next to the day boxes the card hugs the title instead of the input's default width.
                  titleOnly && 'w-0 min-w-full',
                )}
                placeholder={t('planner.titlePlaceholder')}
                title={withHint(t('planner.titlePlaceholder'), 'focusTitle')}
                data-session-title-input
                {...hintAttrs('focusTitle')}
              />
              {/* Invisible sizer mirroring the title text, carrying the hover
                  pencil right after the text end (visibility restored on the
                  pencil). Must stay AFTER the input for the
                  `.editable-field:hover ~` CSS hook; pointer-events-none keeps
                  the input clickable underneath. The input's intrinsic width
                  dominates the grid track, so the field size is unchanged.
                  This span is the ONLY place the title exists as a DOM text
                  node inside the h1 — the previous sr-only span was removed
                  because SEO tools read the h1's textContent (ignoring
                  aria-hidden/sr-only) and saw the title duplicated. The h1's
                  accessible name (incl. placeholder fallback when empty) now
                  comes from aria-label on the TitleWrapper instead. */}
              <span
                aria-hidden
                className="editable-field-sizer invisible pointer-events-none col-start-1 row-start-1 text-lg font-semibold px-1 whitespace-pre overflow-hidden whitespace-nowrap text-ellipsis"
              >
                {displayTitle || t('planner.titlePlaceholder')}
                <EditableFieldPencil className="ml-1 visible" />
              </span>
            </TitleWrapper>
            {printDayLabel && (
              <span className="hidden shrink-0 text-lg font-semibold print:inline">· {printDayLabel}</span>
            )}
            {/* Print-only credit */}
            <span className="hidden print:inline text-xs text-muted-foreground shrink-0 mt-2">
              Erstellt mit sessionplan.de
            </span>
          </div>
          {titleOnly ? (
            // The day boxes are not printed, the duration of the active day still is.
            <span className="hidden font-medium text-foreground print:inline">{formatDuration(totalDuration)}</span>
          ) : (
            <DayControls
              metadata={metadata}
              totalDuration={totalDuration}
              onUpdate={onUpdate}
              startTimePopoverOpen={startTimePopoverOpen}
              onStartTimePopoverOpenChange={onStartTimePopoverOpenChange}
              onAddDay={onAddDay}
            />
          )}
        </div>
      </div>
      {dayTabs}
    </header>
    {onAddDay && (
      // Reaches across the row gap, so the pointer can travel from the header to the button.
      <div className="-ml-3 hidden items-center self-stretch pl-3 opacity-0 transition-opacity hover:opacity-100 hover:delay-300 focus-within:opacity-100 peer-hover:opacity-100 peer-hover:delay-300 md:flex print:hidden [@media(hover:none)]:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddDay}
          className="h-8 w-8 rounded-xl border bg-card/60 text-muted-foreground shadow-sm backdrop-blur"
          title={withHint(t('days.add'), 'addDay')}
          aria-label={t('days.add')}
          {...hintAttrs('addDay')}
        >
          <CalendarPlus className="h-4 w-4" />
        </Button>
      </div>
    )}
    </>
  );
};
