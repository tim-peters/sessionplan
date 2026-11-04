import { Button } from '@/components/primitives/button';
import { useRef } from 'react';
import { Pen, Plus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getContrastingTextColor } from '@/lib/color-contrast';

/**
 * Curated palette of vibrant colors that work on both light and dark
 * backgrounds (used for block types and person avatars).
 */
const PRESET_COLORS: string[] = [
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
          <Button variant="plain" size="none"
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'color-swatch w-6 h-6 rounded-full transition-colors relative flex items-center justify-center',
              selected
                ? 'selection-outline'
                : 'hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-muted-foreground'
            )}
            style={{ backgroundColor: color, color: getContrastingTextColor(color) }}
            title={color}
            aria-label={color}
            aria-pressed={selected}
          >
            {selected && <Check className="h-3.5 w-3.5" />}
          </Button>
        );
      })}
      <Button variant="plain" size="none"
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'color-swatch w-6 h-6 rounded-full flex items-center justify-center transition-colors',
          isCustom
            ? 'selection-outline'
            : 'border-2 border-dashed border-muted-foreground/40 hover:border-primary hover:bg-muted/50'
        )}
        style={isCustom ? { backgroundColor: value, color: getContrastingTextColor(value) } : undefined}
        title={isCustom ? value : t('sidebar.customColor')}
        aria-label={t('sidebar.customColor')}
        aria-pressed={isCustom}
      >
        {isCustom ? (
          <Pen className="h-3 w-3" />
        ) : (
          <Plus className="h-3 w-3 text-muted-foreground" />
        )}
      </Button>
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
