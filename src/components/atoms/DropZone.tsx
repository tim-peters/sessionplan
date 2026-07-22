import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  id: string;
  position?: 'top' | 'bottom';
}

export const DropZone = ({ id, position = 'top' }: DropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'max-w-5xl mx-auto border-2 border-dashed rounded-lg transition-colors print:hidden',
        position === 'bottom' ? 'h-4' : 'h-10',
        position === 'top' ? '-mt-3 mb-1' : 'mt-1 mb-3',
        isOver ? 'border-primary bg-primary/5' : 'border-transparent'
      )}
    />
  );
};
