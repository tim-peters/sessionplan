import { useRef } from 'react';
import { Pen, Plus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * Curated palette of 9 vibrant colors that work on both light and dark
 * backgrounds (used for block types and person avatars).
 */
export const PRESET_COLORS: string[] = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // sky
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#D946EF', // fuchsia
  '#F43F5E', // rose
  '#6B7280', // gray
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

const isPreset = (color: string) =>
  PRESET_COLORS.some(c => c.toLowerCase() === color.toLowerCase());

export const ColorPicker = ({ value, onChange, className }: ColorPickerProps) => {
  const { t } = useTranslation('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndex = PRESET_COLORS.findIndex(
    c => c.toLowerCase() === value.toLowerCase()
  );
  const isCustom = activeIndex === -1;

  return (
    <div className={cn('flex flex-wrap gap-2.5 p-1 px-2 mr-4', className)}>
      {PRESET_COLORS.map((color, i) => {
        const selected = i === activeIndex;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-5 h-5 rounded-full transition-all relative flex items-center justify-center',
              selected
                ? 'ring-2 ring-offset-1 ring-primary scale-110'
                : 'hover:scale-110 hover:ring-1 hover:ring-offset-1 hover:ring-muted-foreground/30'
            )}
            style={{ backgroundColor: color }}
            title={color}
            aria-label={color}
            aria-pressed={selected}
          >
            {selected && <Check className="h-2.5 w-2.5 text-white drop-shadow" />}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center transition-all',
          isCustom
            ? 'ring-2 ring-offset-1 ring-primary scale-110'
            : 'border-2 border-dashed border-muted-foreground/40 hover:border-primary hover:bg-muted/50'
        )}
        style={isCustom ? { backgroundColor: value } : undefined}
        title={isCustom ? value : t('sidebar.customColor')}
        aria-label={t('sidebar.customColor')}
        aria-pressed={isCustom}
      >
        {isCustom ? (
          <Pen className="h-3 w-3 text-background" />
        ) : (
          <Plus className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
};
