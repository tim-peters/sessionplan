import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { BlockType } from '@/types/workshop';
import { getBlockTypeName } from '@/lib/workshopUtils';
import { cn } from '@/lib/utils';

interface DraggableBlockTypeProps {
  type: BlockType;
  onModify: () => void;
  onAdd: () => void;
  shortcutKey?: string;
}

export const DraggableBlockType = ({
  type,
  onModify,
  onAdd,
  shortcutKey,
}: DraggableBlockTypeProps) => {
  const { t } = useTranslation('common');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `blocktype-${type.id}`,
    data: { type: 'blocktype', blockType: type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      title={shortcutKey ? `${getBlockTypeName(type, t)} (${shortcutKey})` : undefined}
      className={cn(
        'sidebar-item group cursor-grab active:cursor-grabbing lg:cursor-grab cursor-pointer',
        isDragging && 'opacity-50'
      )}
    >
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: type.color }}
      />
      <span className="flex-1 truncate">{getBlockTypeName(type, t)}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onModify();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted-foreground/10 rounded transition-opacity"
        title={t('sidebar.modify')}
        aria-label={t('sidebar.modify')}
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
};
