import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface GapIndicatorProps {
  minutes: number;
  size?: 'sm' | 'md';
  className?: string;
}

export const GapIndicator = ({ minutes, size = 'md', className }: GapIndicatorProps) => {
  const { t } = useTranslation('common');
  if (minutes === 0) return null;

  const isOvertime = minutes < 0;
  const absMinutes = Math.abs(minutes);
  const sizeClass = size === 'sm' ? 'p-1.5 text-xs' : 'p-3 text-sm';

  return (
    <div
      className={cn(
        sizeClass,
        'rounded font-medium text-center',
        isOvertime ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {isOvertime
        ? t('block.overtime', { count: absMinutes })
        : t('block.buffer', { count: minutes })}
    </div>
  );
};
