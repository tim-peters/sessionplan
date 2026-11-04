import { Button } from '@/components/primitives/button';
import { useTranslation } from 'react-i18next';
import { FormattedTextField } from '@/components/atoms/FormattedTextField';
import { EditableFieldPencil } from '@/components/atoms/EditableFieldPencil';
import { EmptyStartTimeButton } from './atoms/EmptyStartTimeButton';
import { parseFormatting } from '@/lib/textFormatting';
import { useClickToEdit } from '@/hooks/useClickToEdit';
import { cn } from '@/lib/utils';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';

interface WorkshopDescriptionProps {
  description: string;
  date?: string | null;
  startTime?: string | null;
  onAddStartTimeClick?: () => void;
  showFullText?: boolean;
  onUpdate?: (desc: string) => void;
}

export const WorkshopDescription = ({ description, date, startTime, onAddStartTimeClick, showFullText = false, onUpdate }: WorkshopDescriptionProps) => {
  const { t } = useTranslation('common');
  const { withHint, hintAttrs } = useShortcutLabels();
  const {
    previewRef,
    editing,
    startEditing,
    stopEditing,
    caretPoint,
    initialSelection,
  } = useClickToEdit<HTMLButtonElement>({ value: description });

  return (
    <div className="flex flex-col sm:flex-row items-start gap-2">
      {(date || !startTime) && (
        <div className="flex flex-row items-center sm:flex-col sm:items-stretch gap-2 sm:gap-0.5 shrink-0 mt-0.5 md:w-[6rem] md:-ml-[8rem] md:mr-8 md:text-right">
          {date && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          )}
          {!startTime && (
            <EmptyStartTimeButton onClick={onAddStartTimeClick} className="sm:self-end sm:mt-0.5" />
          )}
        </div>
      )}
      <div className="w-full sm:w-auto flex-1 min-w-0">
        {editing ? (
          // Padding + min height live on this wrapper (not on the textarea)
          // so the formatting backdrop inside FormattedTextField stays
          // perfectly aligned with the text it highlights. Deliberately
          // borderless with no focus ring — while editing, the field should
          // look like plain text, same as the inline block previews (the
          // caret and formatting toolbar are the editing affordances).
          <div
            className="w-full px-3 py-2 text-sm print:p-0 print:min-h-0"
          >
            <FormattedTextField
              value={description}
              onChange={(v) => onUpdate?.(v)}
              onBlur={() => stopEditing()}
              placeholder={t('planner.descriptionPlaceholder')}
              multiline
              autoGrow
              autoFocus
              initialCaretPoint={caretPoint}
              initialSelection={initialSelection}
              dataAttributes={{ 'data-session-description': '' }}
              className="w-full"
            />
          </div>
        ) : (
          <Button variant="plain" size="none"
            ref={previewRef}
            onClick={startEditing}
            className={cn(
              'px-2 py-1 text-left w-full text-sm text-muted-foreground hover:text-foreground hover:bg-inherit transition-colors print:hidden',
              onUpdate && 'editable-field',
            )}
            data-session-description
            data-shortcut-outside
            title={onUpdate ? withHint(t('planner.descriptionPlaceholder'), 'focusDescription') : undefined}
            {...(onUpdate ? hintAttrs('focusDescription') : {})}
          >
            {description ? (
              <span className={showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-3 whitespace-pre-wrap break-words'}>
                {parseFormatting(description)}
                {onUpdate && <EditableFieldPencil className="ml-1" />}
              </span>
            ) : (
              <span>
                {t('planner.descriptionPlaceholder')}
                {onUpdate && <EditableFieldPencil className="ml-1" />}
              </span>
            )}
          </Button>
        )}
        {/* Print: always show formatted description */}
        {description && !editing && (
          <p className="hidden print:block text-sm whitespace-pre-wrap break-words">
            {parseFormatting(description)}
          </p>
        )}
      </div>
    </div>
  );
};
