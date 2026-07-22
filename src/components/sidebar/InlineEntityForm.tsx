import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react';
import { Input } from '@/components/primitives/input';
import { Button } from '@/components/primitives/button';
import { ColorPicker } from '../atoms/ColorPicker';

interface InlineEntityFormProps {
  initialName: string;
  initialColor: string;
  namePlaceholder: string;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export const InlineEntityForm = ({
  initialName,
  initialColor,
  namePlaceholder,
  onSave,
  onCancel,
  onDelete,
}: InlineEntityFormProps) => {
  const { t } = useTranslation('common');
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(initialName);
    setColor(initialColor);
  }, [initialName, initialColor]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const isValid = name.trim().length > 0;
  const trimmedName = name.trim();
  const isDirty =
    trimmedName !== initialName || color.toLowerCase() !== initialColor.toLowerCase();

  const handleSubmit = () => {
    if (!isValid) return;
    onSave(trimmedName, color);
  };

  return (
    <div
      className="p-2.5 bg-muted/60 border border-border/60 rounded-lg space-y-2 mx-1 my-0.5"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="flex bg-muted items-center gap-2">
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isValid && (isDirty || onDelete === undefined)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={namePlaceholder}
          className="h-7 text-sm pr-7"
        />
        <button
          type="button"
          onClick={onCancel}
          title={t('dialog.cancel')}
          aria-label={t('dialog.cancel')}
          className="rounded text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex items-center gap-1">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
            title={t('actions.delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!isValid || (onDelete !== undefined && !isDirty)}
          className="h-7 px-2 ml-auto"
        >
          {t('dialog.save')}
        </Button>
      </div>
    </div>
  );
};
