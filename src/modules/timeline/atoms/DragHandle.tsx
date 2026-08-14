import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  className?: string;
}

/**
 * Drag handle button used in sortable card components.
 */
export const DragHandle = ({ attributes, listeners, className }: DragHandleProps) => (
  <button
    {...attributes}
    {...listeners}
    onClick={(e) => e.stopPropagation()}
    className={cn(
      'mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none print:hidden',
      className,
    )}
    data-drag-handle
  >
    <GripVertical className="h-5 w-5" />
  </button>
);
