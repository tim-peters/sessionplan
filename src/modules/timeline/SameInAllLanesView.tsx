import { useTranslation } from 'react-i18next';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { WorkshopItem, BlockType, Person } from '@/types/workshop';
import { Plus } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { BlockCard } from './BlockCard';
import { GapIndicator } from './atoms/GapIndicator';
import { useDragDropContext } from '@/hooks/useDragDropContext';
import { useIsLg } from '@/hooks/use-lg';
import { cn } from '@/lib/utils';
import type { PlayState } from '@/lib/playModeUtils';
import { bindChildBlockActions, type ChildItemCallbacks } from '@/lib/timelineItemProps';

interface SameInAllLanesViewProps extends ChildItemCallbacks {
  item: WorkshopItem;
  blockTypes: BlockType[];
  persons: Person[];
  showFullPreviewText?: boolean;
  onAddChild?: (type: 'block' | 'group' | 'breakout', laneIndex?: number) => void;
  childPlayStates?: Map<string, PlayState>;
}

export const SameInAllLanesView = ({
  item,
  blockTypes,
  persons,
  showFullPreviewText,
  onAddChild,
  childPlayStates,
  ...childCallbacks
}: SameInAllLanesViewProps) => {
  const { t } = useTranslation('common');
  const { activeId } = useDragDropContext();
  const isLg = useIsLg();

  const isAnyBlockBeingDragged = activeId !== null;
  const lane0Children =
    item.children?.filter(
      (child) => child && (child.laneIndex === 0 || child.laneIndex === undefined),
    ) || [];
  const lane0Duration = lane0Children.reduce((sum, child) => sum + child.duration, 0);
  const diff = item.duration - lane0Duration;

  return (
    <div className={cn('-m-4 p-4 rounded-b-lg')}>
      {item.children && item.children.length > 0 ? (
        <SortableContext
          items={lane0Children.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {lane0Children.map((child) => {
                const actualChildIndex = item.children?.indexOf(child) || 0;

                return (
                  <div key={child.id} className="relative z-0">
                    {(item.lanes || 2) > 1 && !isAnyBlockBeingDragged && (
                      <div className="absolute inset-0 pointer-events-none z-0">
                        {Array.from({ length: Math.min(item.lanes || 2, 5) - 1 }).map((_, i) => (
                          <div
                            key={i}
                            className="absolute inset-0 bg-card border border-border rounded-lg"
                            style={{
                              transform: `translate(0px, ${(i + 1) * 4}px) scale(${1 - (i + 1) * 0.01})`,
                              opacity: 1 - i * 0.15,
                              zIndex: -(i + 1),
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {(item.lanes || 2) > 5 && !isAnyBlockBeingDragged && (
                      <div className="absolute bottom-2 -right-2 z-10">
                        <div className="text-xs font-bold px-2 py-0.5 rounded-full shadow-sm bg-block-breakout-bg text-block-breakout-foreground">
                          ×{item.lanes}
                        </div>
                      </div>
                    )}

                    <BlockCard
                      {...bindChildBlockActions(child, childCallbacks)}
                      item={child}
                      blockType={blockTypes.find((bt) => bt.id === child.blockTypeId)}
                      blockTypes={blockTypes}
                      persons={persons}
                      showFullPreviewText={showFullPreviewText}
                      timeDisplay={childCallbacks.onCalculateChildTime?.(item, actualChildIndex) || null}
                      parentId={item.id}
                      parentType="breakout"
                      isNested={true}
                      playState={childPlayStates?.get(child.id)}
                    />
                  </div>
                );
              })}
          </div>
        </SortableContext>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center justify-center min-h-[80px]">
          <p>{t('block.noBlocksInBreakout')}</p>
          <p className="text-xs mt-1 opacity-70">{t('block.dragHereOrClick')}</p>
        </div>
      )}

      {item.children && item.children.length > 0 && diff !== 0 && (
        <div className="mt-3">
          <GapIndicator minutes={diff} size="md" />
        </div>
      )}

      {onAddChild && (!isLg || !item.children || item.children.length === 0) && (
        <div className="mt-3 pt-3 border-t border-dashed print:hidden">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full gap-2 text-xs hover:text-foreground',
              item.children.length > 0 ? 'text-muted-foreground' : 'text-foreground',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onAddChild?.('block', 0);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('block.addBlock')}
          </Button>
        </div>
      )}
    </div>
  );
};
