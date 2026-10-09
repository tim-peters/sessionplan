import { useTranslation } from 'react-i18next';
import { FormattedTextField } from '@/components/atoms/FormattedTextField';
import { EditableFieldPencil } from '@/components/atoms/EditableFieldPencil';
import { parseFormatting } from '@/lib/textFormatting';
import { useClickToEdit } from '@/hooks/useClickToEdit';
import { cn } from '@/lib/utils';

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
  const {
    previewRef,
    editing,
    startEditing,
    stopEditing,
    caretPoint,
    initialSelection,
  } = useClickToEdit<HTMLButtonElement>({ value: description });

  return (
    <div className="flex flex-col sm:flex-row items-start gap-3">
      {(date || !startTime) && (
        <div className="flex flex-row sm:flex-col gap-2 sm:gap-0.5 shrink-0 mt-0.5 md:w-[6rem] md:-ml-[8rem] md:mr-8 md:text-right">
          {date && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          )}
          {!startTime && (
            <button
              onClick={onAddStartTimeClick}
              className="text-xs text-muted-foreground/60 hover:text-primary transition-colors print:hidden text-right mt-0.5"
            >
              + {t('planner.addStartTime')}
            </button>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {editing ? (
          // Padding + min height live on this wrapper (not on the textarea)
          // so the formatting backdrop inside FormattedTextField stays
          // perfectly aligned with the text it highlights. Deliberately
          // borderless with no focus ring — while editing, the field should
          // look like plain text, same as the inline block previews (the
          // caret and formatting toolbar are the editing affordances).
          <div
            className="min-h-[80px] w-full px-3 py-2 text-sm print:p-0 print:min-h-0"
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
          <button
            ref={previewRef}
            onClick={startEditing}
            className={cn(
              'text-left w-full text-sm text-muted-foreground hover:text-foreground transition-colors print:hidden',
              onUpdate && 'editable-field',
            )}
            data-session-description
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
          </button>
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
