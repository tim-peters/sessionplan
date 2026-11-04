import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/button';
import { useDraggable } from '@dnd-kit/core';
import { Lock, Trash2 } from 'lucide-react';
import { BlockTemplate } from '@/lib/workshopStorage';
import { cn } from '@/lib/utils';

interface DraggableLibraryItemProps {
  block: BlockTemplate;
  onDelete: () => void;
  onAdd: () => void;
}

export const DraggableLibraryItem = ({
  block,
  onDelete,
  onAdd,
}: DraggableLibraryItemProps) => {
  const { t } = useTranslation('common');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${block.id}`,
    data: { type: 'library', item: block.item },
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
      className={cn(
        'sidebar-item group cursor-grab active:cursor-grabbing lg:cursor-grab cursor-pointer',
        isDragging && 'opacity-50'
      )}
    >
      <span className="flex-1 truncate">{block.name}</span>
      <span className="text-xs text-muted-foreground">
        {block.item.duration}m
      </span>
      {block.isDefault ? (
        <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
      ) : (
        <Button variant="plain" size="none"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={t('actions.delete')}
          title={t('actions.delete')}
          className="sidebar-action p-1 hover:bg-destructive/10 rounded transition-opacity"
        >
          <Trash2 className="h-3 w-3 text-destructive-text" />
        </Button>
      )}
    </div>
  );
};
