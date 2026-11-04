import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { parseDuration } from '@/lib/workshopUtils';
import type { WorkshopItem } from '@/types/workshop';
import { DurationInput } from './DurationInput';

interface ContainerDurationInputProps {
  item: WorkshopItem;
  onUpdate: (updates: Partial<WorkshopItem>) => void;
  className: string;
}

/** Duration of a group or breakout: follows its children until a click locks it for editing. */
export const ContainerDurationInput = ({ item, onUpdate, className }: ContainerDurationInputProps) => {
  const { t } = useTranslation('common');
  const isLocked = !!item.durationLocked;

  return (
    <DurationInput
      value={item.duration}
      readOnly={!isLocked}
      aria-label={isLocked ? t('dialog.duration') : t('dialog.automaticDuration')}
      title={isLocked ? undefined : t('dialog.automaticDuration')}
      onChange={(e) => {
        if (isLocked) onUpdate({ duration: parseDuration(e.target.value) });
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isLocked) onUpdate({ durationLocked: true });
      }}
      className={cn(className, !isLocked && 'bg-muted/60 text-foreground cursor-pointer')}
      min={0}
    />
  );
};
