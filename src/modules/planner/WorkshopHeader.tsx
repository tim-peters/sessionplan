import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { WorkshopMetadata } from '@/types/workshop';
import { formatDuration } from '@/lib/workshopStorage';
import { getWorkshopTitle } from '@/lib/workshopUtils';
import { Calendar, Clock, PanelLeft, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { Input } from '@/components/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/primitives/popover';
import { EditableFieldPencil } from '@/components/atoms/EditableFieldPencil';
import { cn } from '@/lib/utils';

interface WorkshopHeaderProps {
  metadata: WorkshopMetadata;
  totalDuration: number;
  onUpdate: (updates: Partial<WorkshopMetadata>) => void;
  onMenuClick: () => void;
  isSidebarCollapsed?: boolean;
  startTimePopoverOpen?: boolean;
  onStartTimePopoverOpenChange?: (open: boolean) => void;
  asHeading?: boolean;
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
}: WorkshopHeaderProps) => {
  const { t } = useTranslation('common');
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const TitleWrapper = asHeading ? 'h1' : 'div';
  const displayTitle = getWorkshopTitle(metadata.title, t);


  return (
    <header className={cn(
      !asHeading ? 'hidden sm:flex' : 'flex',
      'order-2 w-full flex-1 sm:order-none sm:w-auto sm:flex-none',
      'sm:bg-card/95 sm:backdrop-blur sm:supports-[backdrop-filter]:bg-card/70',
      'border-b sm:border sm:rounded-2xl shadow-sm overflow-hidden',
      'print:static print:w-full print:bg-card print:rounded-none print:shadow-none print:backdrop-blur-none',
    )}>
      <div className="px-4 pb-3 sm:py-2.5">
        <div className="flex items-stretch flex-row justify-between gap-0 print:w-full">
          <div className="flex gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className={cn('hidden sm:flex shrink-0 print:hidden h-8 w-8 -ml-1', !isSidebarCollapsed && 'lg:hidden')}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
            <TitleWrapper
              aria-label={asHeading ? (displayTitle || t('planner.titlePlaceholder')) : undefined}
              className="inline-grid sm:min-w-[8ch] sm:max-w-[100ch] -m-1 p-1 overflow-hidden whitespace-nowrap text-ellipsis relative"
            >
              <input
                type="text"
                value={displayTitle}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="editable-field col-start-1 row-start-1 text-lg font-semibold bg-transparent border-none outline-none min-w-0 focus:ring-2 focus:ring-primary/20 rounded px-1 overflow-hidden whitespace-nowrap text-ellipsis"
                placeholder={t('planner.titlePlaceholder')}
                title="Workshop-Titel (T)"
                data-session-title-input
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
                <EditableFieldPencil className="ml-1 mt-0.5 visible" />
              </span>
            </TitleWrapper>
            {/* Print-only credit */}
            <span className="hidden print:inline text-xs text-muted-foreground shrink-0 mt-2">
              Erstellt mit sessionplan.de
            </span>
          </div>
          <div className="flex gap-2 pr-1">
            {/* Date popover */}
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'p-1.5 rounded-md hover:bg-muted transition-colors shrink-0 print:hidden',
                    datePopoverOpen && 'bg-muted',
                    metadata.date ? 'text-primary' : 'text-muted-foreground'
                  )}
                  title={`${t('planner.datePlaceholder')} (Shift+D)`}
                  data-date-trigger
                >
                  <Calendar className="h-4 w-4 print:hidden" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end">
                <Input
                  type="date"
                  value={metadata.date || ''}
                  onChange={(e) => onUpdate({ date: e.target.value || null })}
                  className="h-8 w-36 text-sm"
                />
              </PopoverContent>
            </Popover>
            {/* Time popover */}
            <Popover open={startTimePopoverOpen} onOpenChange={onStartTimePopoverOpenChange}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'p-1.5 rounded-md hover:bg-muted transition-colors shrink-0 print:hidden',
                    startTimePopoverOpen && 'bg-muted',
                    metadata.startTime ? 'text-primary' : 'text-muted-foreground'
                  )}
                  title={`${t('planner.startTimePlaceholder')} (Shift+S)`}
                  data-start-time-trigger
                >
                  <Clock className="h-4 w-4 print:hidden" />
                </button>
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ durationLocked: !metadata.durationLocked });
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 print:hidden"
                  title={metadata.durationLocked ? t('planner.unlockDuration') : t('planner.lockDuration')}
                >
                  <Lock className="h-3.5 w-3.5 text-primary" />
                </button>
              )}
              {metadata.durationLocked ? (
                <>
                  <Input
                    type="number"
                    value={metadata.targetDuration || 0}
                    onChange={(e) => onUpdate({ targetDuration: parseInt(e.target.value) || 0 })}
                    className="h-8 w-8 px-0 sm:-my-2 text-center text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] print:border-none print:p-0"
                    min={0}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="font-medium text-sm text-muted-foreground">{t('planner.totalMin')}</span>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({ durationLocked: true, targetDuration: totalDuration });
                    }}
                    className="text-foreground hover:text-foreground transition-colors p-0.5 pr-0 print:hidden"
                    title={t('planner.lockDuration')}
                  >
                    <Unlock className="h-3.5 w-3.5" />
                  </button>
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
        </div>


      </div>
    </header>
  );
};
