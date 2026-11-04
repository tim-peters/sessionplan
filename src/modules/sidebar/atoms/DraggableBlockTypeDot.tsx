import { useTranslation } from 'react-i18next';
import { BlockType } from '@/types/workshop';
import { getBlockTypeName } from '@/lib/workshopUtils';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import { CollapsedDraggableItem } from './CollapsedDraggableItem';

interface DraggableBlockTypeDotProps {
  type: BlockType;
  onAdd: () => void;
  shortcutDigit?: number;
}

export const DraggableBlockTypeDot = ({
  type,
  onAdd,
  shortcutDigit,
}: DraggableBlockTypeDotProps) => {
  const { t } = useTranslation('common');
  const { withHint, hintAttrs } = useShortcutLabels();
  const name = getBlockTypeName(type, t);

  return (
    <CollapsedDraggableItem
      dragId={`blocktype-${type.id}`}
      dragData={{ type: 'blocktype', blockType: type }}
      hintProps={shortcutDigit ? hintAttrs('addBlockOfType', shortcutDigit) : undefined}
      tooltip={shortcutDigit ? withHint(name, 'addBlockOfType', shortcutDigit) : name}
      onAdd={onAdd}
    >
      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
    </CollapsedDraggableItem>
  );
};
