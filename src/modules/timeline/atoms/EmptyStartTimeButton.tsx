import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/button';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import { cn } from '@/lib/utils';

interface EmptyStartTimeButtonProps {
  onClick?: () => void;
  className?: string;
}

/**
 * Unfilled, grey time badge shown while the plan or day has no start time.
 * Looks like the time badges of the blocks, without their highlight colour.
 * Not printed.
 */
export const EmptyStartTimeButton = ({ onClick, className }: EmptyStartTimeButtonProps) => {
  const { t } = useTranslation('common');
  const { withHint, hintAttrs } = useShortcutLabels();
  const label = t('planner.startTimePlaceholder');

  return (
    <Button
      variant="plain"
      size="none"
      className={cn(
        'time-badge is-clickable relative print:hidden',
        // Touch: stays badge-sized next to the date; an invisible overlay keeps the 44px target.
        '[@media(pointer:coarse)]:!min-h-6 [@media(pointer:coarse)]:!min-w-6',
        "[@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-x-1 [@media(pointer:coarse)]:before:-inset-y-2.5 [@media(pointer:coarse)]:before:content-['']",
        className,
      )}
      title={withHint(label, 'openStartTime')}
      {...hintAttrs('openStartTime')}
      // Its corner would run into the description's keycap right next to it.
      data-shortcut-outside
      aria-label={label}
      data-empty-start-time
      onClick={onClick}
    >
      --:--
    </Button>
  );
};
