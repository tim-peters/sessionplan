/**
 * DayTabParts — Building blocks of the day tab layouts.
 *
 * The days are a group of plain buttons with `aria-current` on the shown day.
 * They are no ARIA tabs: every day carries its own menu and the active one its
 * controls, which a tablist must not contain, and a click on the shown day
 * edits its title.
 * Used by: DayStrip, DayBoxes
 */
import { ComponentProps, forwardRef, KeyboardEventHandler, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CalendarPlus, Check, ChevronDown, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { Input } from '@/components/primitives/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/primitives/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/primitives/alert-dialog';
import { formatShortDate, getDayLabel, type DayMetaUpdates, type ResolvedDay } from '@/lib/workshop-days';
import { formatDuration, calculateEffectiveDuration } from '@/lib/workshopStorage';
import { MAX_DAYS } from '@/types/workshop';
import { cn } from '@/lib/utils';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';

export interface DayTabsProps {
  days: ResolvedDay[];
  activeDayId: string;
  liveDayId: string | null;
  dateLocale: string;
  onSelect: (dayId: string) => void;
  onAdd: () => string | null;
  onDuplicate: (dayId: string) => string | null;
  onRemove: (dayId: string) => void;
  onMove: (dayId: string, toIndex: number) => void;
  onUpdate: (dayId: string, updates: DayMetaUpdates) => void;
}

const LiveDot = ({ className }: { className?: string }) => (
  <span className={cn('h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary', className)} aria-hidden />
);

interface DayButtonProps {
  days: ResolvedDay[];
  index: number;
  isActive: boolean;
  isLive: boolean;
  dateLocale: string;
  className?: string;
  onClick: () => void;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
  children?: ReactNode;
}

export const DayButton = forwardRef<HTMLButtonElement, DayButtonProps>(
  ({ days, index, isActive, isLive, dateLocale, className, onClick, onKeyDown, children }, ref) => {
    const { t } = useTranslation('common');
    const { withHint, hintAttrs } = useShortcutLabels();
    const day = days[index];
    const label = getDayLabel(days, day.id, t);
    const duration = calculateEffectiveDuration(day.items, day.startTime);
    const hint = [label, formatShortDate(day.date, dateLocale), duration > 0 ? formatDuration(duration) : null]
      .filter(Boolean)
      .join(' · ');

    return (
      <Button
        ref={ref}
        type="button"
        variant="plain"
        size="none"
        aria-current={isActive ? 'true' : undefined}
        title={index < 9 ? withHint(hint, 'selectDay', index + 1) : hint}
        {...(index < 9 ? hintAttrs('selectDay', index + 1) : {})}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(
          // The focus ring stays inside: the day's box clips everything beyond its edge.
          'relative flex items-center gap-1.5 self-stretch hover:text-foreground focus-visible:-outline-offset-2',
          isActive && 'editable-field cursor-text',
          className,
        )}
      >
        {isLive && <LiveDot />}
        <span className={cn('max-w-[12rem] truncate', isActive && 'font-medium')}>{label}</span>
        {children}
      </Button>
    );
  },
);
DayButton.displayName = 'DayButton';

interface DayRenameInputProps extends Pick<ComponentProps<'input'>, 'className' | 'placeholder'> {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export const DayRenameInput = ({ value, onChange, onCommit, onCancel, ...props }: DayRenameInputProps) => {
  const { t } = useTranslation('common');
  return (
    <Input
      autoFocus
      value={value}
      aria-label={t('days.rename')}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onCommit();
        if (event.key === 'Escape') onCancel();
      }}
      {...props}
    />
  );
};

interface DayOptionsMenuProps {
  days: ResolvedDay[];
  index: number;
  triggerClassName?: string;
  onRename: (day: ResolvedDay) => void;
  onDuplicate: (dayId: string) => void;
  onMove: (dayId: string, toIndex: number) => void;
  onDelete: (day: ResolvedDay) => void;
}

/** Everything that can be done with one day. */
export const DayOptionsMenu = ({ days, index, triggerClassName, onRename, onDuplicate, onMove, onDelete }: DayOptionsMenuProps) => {
  const { t } = useTranslation('common');
  const day = days[index];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6 rounded-md text-muted-foreground', triggerClassName)}
          aria-label={t('days.options', { label: getDayLabel(days, day.id, t) })}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-popover">
        <DropdownMenuItem onSelect={() => onRename(day)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t('days.rename')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={days.length >= MAX_DAYS} onSelect={() => onDuplicate(day.id)}>
          <Copy className="mr-2 h-4 w-4" />
          {t('days.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(day.id, index - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('days.moveLeft')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === days.length - 1} onSelect={() => onMove(day.id, index + 1)}>
          <ArrowRight className="mr-2 h-4 w-4" />
          {t('days.moveRight')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive-text focus:text-destructive-text" onSelect={() => onDelete(day)}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('days.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface DayListMenuProps {
  days: ResolvedDay[];
  activeDayId: string;
  liveDayId: string | null;
  dateLocale: string;
  onPick: (dayId: string) => void;
  onAdd: () => void;
}

/** All days in a menu, for when only the active box stays visible. */
export const DayListMenu = ({ days, activeDayId, liveDayId, dateLocale, onPick, onAdd }: DayListMenuProps) => {
  const { t } = useTranslation('common');
  const canAdd = days.length < MAX_DAYS;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-day-list=""
          className="-ml-1 mr-1 h-6 w-6 shrink-0 rounded-md text-muted-foreground"
          title={t('days.switch')}
          aria-label={t('days.switch')}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] min-w-[14rem] overflow-y-auto bg-popover">
        {days.map((day) => {
          const date = formatShortDate(day.date, dateLocale);
          return (
            <DropdownMenuItem
              key={day.id}
              onSelect={() => {
                if (day.id !== activeDayId) onPick(day.id);
              }}
            >
              <Check className={cn('mr-2 h-4 w-4 shrink-0', day.id !== activeDayId && 'invisible')} />
              {day.id === liveDayId && <LiveDot className="mr-1.5" />}
              <span className={cn('max-w-[12rem] truncate', day.id === activeDayId && 'font-medium')}>
                {getDayLabel(days, day.id, t)}
              </span>
              {date && <span className="ml-auto shrink-0 pl-4 text-xs text-muted-foreground">{date}</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canAdd} onSelect={onAdd}>
          <CalendarPlus className="mr-2 h-4 w-4 shrink-0" />
          {canAdd ? t('days.add') : t('days.maxReached', { count: MAX_DAYS })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface DeleteDayDialogProps {
  days: ResolvedDay[];
  /** The day to confirm; null keeps the dialog closed. */
  day: ResolvedDay | null;
  onClose: () => void;
  onConfirm: (dayId: string) => void;
}

export const DeleteDayDialog = ({ days, day, onClose, onConfirm }: DeleteDayDialogProps) => {
  const { t } = useTranslation('common');
  return (
    <AlertDialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('days.deleteConfirmTitle', { label: day ? getDayLabel(days, day.id, t) : '' })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('days.deleteConfirmText')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('days.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive-hover"
            onClick={() => {
              if (day) onConfirm(day.id);
              onClose();
            }}
          >
            {t('days.deleteConfirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
