import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { ShortcutId } from '@/lib/keyboard-shortcuts';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';

interface DraggableSpecialTypeProps {
  dragType: 'new-group' | 'new-breakout';
  icon: React.ElementType;
  label: string;
  onAdd: () => void;
  shortcutId: ShortcutId;
}

export const DraggableSpecialType = ({
  dragType,
  icon: Icon,
  label,
  onAdd,
  shortcutId,
}: DraggableSpecialTypeProps) => {
  const { withHint, hintAttrs } = useShortcutLabels();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `special-${dragType}`,
    data: { type: dragType },
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
      title={withHint(label, shortcutId)}
      {...hintAttrs(shortcutId)}
      className={cn(
        'sidebar-item cursor-grab active:cursor-grabbing lg:cursor-grab cursor-pointer',
        isDragging && 'opacity-50'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
    </div>
  );
};
