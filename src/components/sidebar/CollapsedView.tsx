import { FolderPlus, MoreHorizontal, SquareSplitHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BlockType } from '@/types/workshop';
import {
  TooltipProvider,
} from '@/components/primitives/tooltip';
import { DraggableBlockTypeDot } from './DraggableBlockTypeDot';
import { DraggableSpecialTypeIcon } from './DraggableSpecialTypeIcon';

interface CollapsedViewProps {
  blockTypes: BlockType[];
  onAddBlock: (blockTypeId: string) => void;
  onAddGroup: () => void;
  onAddBreakout: () => void;
  onExpand: () => void;
}

export const CollapsedView = ({
  blockTypes,
  onAddBlock,
  onAddGroup,
  onAddBreakout,
  onExpand,
}: CollapsedViewProps) => {
  const { t } = useTranslation('common');
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col items-center py-2 gap-0.5">
        {blockTypes.map((type, index) => (
          <DraggableBlockTypeDot
            key={type.id}
            type={type}
            onAdd={() => onAddBlock(type.id)}
            shortcutKey={index < 9 ? String(index + 1) : undefined}
          />
        ))}
        <DraggableSpecialTypeIcon
          dragType="new-group"
          icon={FolderPlus}
          label={t('sidebar.group')}
          onAdd={onAddGroup}
          shortcut="g"
        />
        <DraggableSpecialTypeIcon
          dragType="new-breakout"
          icon={SquareSplitHorizontal}
          label={t('sidebar.breakout')}
          onAdd={onAddBreakout}
          shortcut="b"
        />
        <div className="w-6 border-t my-1" />
        <button
          onClick={onExpand}
          className="icon-button mx-auto"
          title={t('settings.expand')}
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </TooltipProvider>
  );
};
