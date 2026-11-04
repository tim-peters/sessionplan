import { Button } from '@/components/primitives/button';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface DragHandleProps {
  label: string;
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  className?: string;
}

/**
 * Drag handle button used in sortable card components.
 */
export const DragHandle = ({ label, attributes, listeners, className }: DragHandleProps) => (
  <Button variant="plain" size="none"
    {...attributes}
    {...listeners}
    aria-label={label}
    title={label}
    onClick={(e) => e.stopPropagation()}
    className={cn(
      // sm+ touch: the 44px tap box grows downward; lift it so the icon stays on the title line
      'mt-1 sm:[@media(pointer:coarse)]:-mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary hover:bg-transparent active:bg-transparent transition-colors touch-none print:hidden',
      className,
    )}
    data-drag-handle
  >
    <GripVertical className="h-5 w-5" />
  </Button>
);
