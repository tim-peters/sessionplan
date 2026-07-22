import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { BlockType } from '@/types/workshop';
import { getBlockTypeName } from '@/lib/workshopUtils';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/primitives/tooltip';

interface DraggableBlockTypeDotProps {
  type: BlockType;
  onAdd: () => void;
  shortcutKey?: string;
}

export const DraggableBlockTypeDot = ({
  type,
  onAdd,
  shortcutKey,
}: DraggableBlockTypeDotProps) => {
  const { t } = useTranslation('common');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `blocktype-${type.id}`,
    data: { type: 'blocktype', blockType: type },
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
          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        {shortcutKey ? `${getBlockTypeName(type, t)} (${shortcutKey})` : getBlockTypeName(type, t)}
      </TooltipContent>
    </Tooltip>
  );
};
