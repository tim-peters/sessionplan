import { Button } from '@/components/primitives/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ExpandToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
  /** Stacked under the drag handle (below sm): pull left so the chevron shares the handle icon's axis. */
  stacked?: boolean;
  className?: string;
}

/**
 * Expand/collapse chevron used in group and breakout card headers.
 */
export const ExpandToggle = ({ isExpanded, onToggle, stacked, className }: ExpandToggleProps) => {
  const { t } = useTranslation('common');
  return (
    <Button variant="plain" size="none"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={isExpanded}
      aria-label={t(isExpanded ? 'actions.collapse' : 'actions.expand')}
      className={cn('inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors print:hidden',
        // sm+ touch: lift the 44px tap box like DragHandle so the chevron stays on the title line
        'mt-1 sm:[@media(pointer:coarse)]:-mt-2',
        // Handle icon sits at the left of its box; offset = (box - 20px icon) / 2
        stacked && 'max-sm:-ml-0.5 max-sm:[@media(pointer:coarse)]:-ml-3',
        className,
      )}
    >
      {isExpanded ? (
        <ChevronDown className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </Button>
  );
};
