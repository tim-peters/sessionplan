import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/primitives/tooltip';

interface DraggableSpecialTypeIconProps {
  dragType: 'new-group' | 'new-breakout';
  icon: React.ElementType;
  label: string;
  onAdd: () => void;
  shortcut?: string;
}

export const DraggableSpecialTypeIcon = ({
  dragType,
  icon: Icon,
  label,
  onAdd,
  shortcut,
}: DraggableSpecialTypeIconProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `special-${dragType}`,
    data: { type: dragType },
  });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg cursor-grab active:cursor-grabbing hover:bg-muted transition-colors mx-auto',
            isDragging && 'opacity-50'
          )}
        >
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        {shortcut ? `${label} (${shortcut.toUpperCase()})` : label}
      </TooltipContent>
    </Tooltip>
  );
};
