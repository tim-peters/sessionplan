import type { ElementType } from 'react';
import type { ShortcutId } from '@/lib/keyboard-shortcuts';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import { CollapsedDraggableItem } from './CollapsedDraggableItem';

interface DraggableSpecialTypeIconProps {
  dragType: 'new-group' | 'new-breakout';
  icon: ElementType;
  label: string;
  onAdd: () => void;
  shortcutId: ShortcutId;
}

export const DraggableSpecialTypeIcon = ({
  dragType,
  icon: Icon,
  label,
  onAdd,
  shortcutId,
}: DraggableSpecialTypeIconProps) => {
  const { withHint, hintAttrs } = useShortcutLabels();

  return (
    <CollapsedDraggableItem
      dragId={`special-${dragType}`}
      dragData={{ type: dragType }}
      hintProps={hintAttrs(shortcutId)}
      tooltip={withHint(label, shortcutId)}
      onAdd={onAdd}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CollapsedDraggableItem>
  );
};
