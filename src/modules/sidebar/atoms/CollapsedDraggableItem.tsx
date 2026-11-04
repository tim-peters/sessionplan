import type { ComponentProps, ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/primitives/tooltip';
import { cn } from '@/lib/utils';
import type { ActiveData } from '@/types/dnd';

interface CollapsedDraggableItemProps {
  dragId: string;
  dragData: ActiveData;
  tooltip: ReactNode;
  /** Attributes that connect the item to the shortcut overlay. */
  hintProps?: ComponentProps<'div'>;
  onAdd: () => void;
  children: ReactNode;
}

/** A click-to-add, draggable icon in the collapsed sidebar. */
export const CollapsedDraggableItem = ({
  dragId,
  dragData,
  tooltip,
  hintProps,
  onAdd,
  children,
}: CollapsedDraggableItemProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data: dragData });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          {...hintProps}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className={cn(
            'ui-button ui-focus flex items-center justify-center w-8 h-8 rounded-lg cursor-grab active:cursor-grabbing hover:bg-accent active:bg-accent-active transition-colors mx-auto',
            isDragging && 'opacity-50'
          )}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};
