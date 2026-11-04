import { useTranslation } from 'react-i18next';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/primitives/button';

interface DurationLockButtonProps {
  isLocked: boolean;
  onToggle: () => void;
  className: string;
  iconClassName: string;
}

/** Switches a group or breakout between an automatic and a manually set duration. */
export const DurationLockButton = ({ isLocked, onToggle, className, iconClassName }: DurationLockButtonProps) => {
  const { t } = useTranslation('common');

  return (
    <Button
      variant="plain"
      size="none"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={className}
      aria-pressed={isLocked}
      title={isLocked ? t('dialog.unlockDuration') : t('dialog.lockDuration')}
    >
      {isLocked ? <Lock className={`${iconClassName} text-primary-text`} /> : <Unlock className={iconClassName} />}
    </Button>
  );
};
