import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/primitives/textarea';
import { parseFormatting } from '@/lib/textFormatting';

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
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [open, description]);

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
        {open ? (
          <Textarea
            ref={textareaRef}
            autoFocus
            value={description}
            onChange={(e) => {
              onUpdate?.(e.target.value);
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
              }
            }}
            onBlur={() => setOpen(false)}
            placeholder={t('planner.descriptionPlaceholder')}
            className="min-h-[80px] resize-none print:border-none print:p-0 print:min-h-0 print:bg-transparent"
            data-session-description
          />
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="text-left w-full text-sm text-muted-foreground hover:text-foreground transition-colors print:hidden"
            data-session-description
          >
            {description ? (
              <span className={showFullText ? 'whitespace-pre-wrap break-words' : 'line-clamp-3 whitespace-pre-wrap break-words'}>
                {parseFormatting(description)}
              </span>
            ) : (
              <span>{t('planner.descriptionPlaceholder')}</span>
            )}
          </button>
        )}
        {/* Print: always show formatted description */}
        {description && !open && (
          <p className="hidden print:block text-sm whitespace-pre-wrap break-words">
            {parseFormatting(description)}
          </p>
        )}
      </div>
    </div>
  );
};
