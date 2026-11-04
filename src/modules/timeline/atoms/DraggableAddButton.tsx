import type { ElementType } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/primitives/button';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import type { ShortcutId } from '@/lib/keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface DraggableAddButtonProps {
  type: 'new-block' | 'new-group' | 'new-breakout';
  icon: ElementType;
  label: string;
  shortcutId: ShortcutId;
  onClick: () => void;
}

/** Adds an item at the end of the timeline on click, or at the drop position when dragged. */
export const DraggableAddButton = ({ type, icon: Icon, label, shortcutId, onClick }: DraggableAddButtonProps) => {
  const { withHint, hintAttrs } = useShortcutLabels();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `add-${type}`,
    data: { type },
  });

  return (
    <Button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      variant="outline"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={withHint(label, shortcutId)}
      {...hintAttrs(shortcutId)}
      className={cn(
        'gap-2 shadow-sm m-2 cursor-grab active:cursor-grabbing lg:cursor-grab backdrop-blur-sm supports-[backdrop-filter]:bg-background/70',
        isDragging && 'opacity-50'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
};
