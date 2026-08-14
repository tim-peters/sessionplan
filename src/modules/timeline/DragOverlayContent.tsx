import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkshopItem, BlockType } from '@/types/workshop';
import { findItemById, getBlockTypeName } from '@/lib/workshopUtils';
import { DEFAULT_BLOCK_DURATION, DEFAULT_BREAKOUT_DURATION, GROUP_OVERLAY_COLOR, BREAKOUT_OVERLAY_COLOR } from '@/lib/workshopDefaults';
import type { ActiveData } from '@/types/dnd';

interface DragOverlayContentProps {
  activeId: string;
  activeData: ActiveData | undefined;
  items: WorkshopItem[];
  blockTypes: BlockType[];
}

const OverlayCard = ({
  color,
  icon,
  children,
  width = 'w-full',
}: {
  color?: string;
  icon?: string;
  children: React.ReactNode;
  width?: string;
}) => (
  <div className={`block-card opacity-90 shadow-lg cursor-grabbing ${width}`}>
    {color ? (
      <div className="block-type-indicator" style={{ backgroundColor: color }} />
    ) : null}
    <div className="flex items-start gap-3 p-4 pl-5">
      {icon ? <span className="text-xl mt-0.5">{icon}</span> : null}
      <div className="flex-1">{children}</div>
    </div>
  </div>
);

export const DragOverlayContent = ({
  activeId,
  activeData,
  items,
  blockTypes,
}: DragOverlayContentProps) => {
  const { t } = useTranslation('common');

  const overlayContent = useMemo(() => {
    if (activeData?.type === 'blocktype') {
      const blockType = activeData.blockType;
      return (
        <OverlayCard color={blockType.color} width="w-full min-w-[200px] max-w-3xl">
          <div className="font-medium">{getBlockTypeName(blockType, t)}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {DEFAULT_BLOCK_DURATION} min
          </div>
        </OverlayCard>
      );
    }

    if (activeData?.type === 'library') {
      const item = activeData.item;
      const blockType = blockTypes.find((bt) => bt.id === item.blockTypeId);
      return (
        <OverlayCard color={blockType?.color} width="w-full max-w-3xl">
          <div className="font-medium">{item.title}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {item.duration} min
          </div>
        </OverlayCard>
      );
    }

    if (activeData?.type === 'new-block') {
      return (
        <OverlayCard width="w-[250px]">
          <div className="font-medium">{t('block.newBlock')}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {DEFAULT_BLOCK_DURATION} min
          </div>
        </OverlayCard>
      );
    }

    if (activeData?.type === 'new-group') {
      return (
        <OverlayCard color={GROUP_OVERLAY_COLOR} icon="📁" width="w-[250px]">
          <div className="font-medium">{t('block.newGroup')}</div>
          <div className="text-sm text-muted-foreground mt-1">0 min</div>
        </OverlayCard>
      );
    }

    if (activeData?.type === 'new-breakout') {
      return (
        <OverlayCard color={BREAKOUT_OVERLAY_COLOR} icon="🔀" width="w-[250px]">
          <div className="font-medium">{t('block.newBreakout')}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {DEFAULT_BREAKOUT_DURATION} min
          </div>
        </OverlayCard>
      );
    }

    // Timeline item drag
    const item = findItemById(items, activeId);
    if (!item) return null;

    const blockType = blockTypes.find((bt) => bt.id === item.blockTypeId);
    const isContainer = item.type === 'group' || item.type === 'breakout';

    return (
      <OverlayCard
        color={
          blockType && item.type === 'block'
            ? blockType.color
            : isContainer
              ? item.type === 'group'
                ? GROUP_OVERLAY_COLOR
                : BREAKOUT_OVERLAY_COLOR
              : undefined
        }
        icon={isContainer ? (item.type === 'group' ? '📁' : '🔀') : undefined}
      >
        <div className="font-medium">{item.title}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {item.duration} min
        </div>
      </OverlayCard>
    );
  }, [activeId, activeData, items, blockTypes, t]);

  return <>{overlayContent}</>;
};
