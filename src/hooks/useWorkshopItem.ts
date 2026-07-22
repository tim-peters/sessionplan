import { useMemo } from 'react';
import { WorkshopItem, BlockType } from '@/types/workshop';

/**
 * Hook to get block type for an item
 */
export const useBlockType = (
  blockTypeId: string | null,
  blockTypes: BlockType[]
): BlockType | undefined => {
  return useMemo(
    () => blockTypes.find(bt => bt.id === blockTypeId),
    [blockTypeId, blockTypes]
  );
};

/**
 * Hook to calculate children duration sum
 */
export const useChildrenDuration = (
  item: WorkshopItem
): number => {
  return useMemo(() => {
    if (!item.children) return 0;
    return item.children.reduce((sum, child) => sum + (child?.duration || 0), 0);
  }, [item.children]);
};

/**
 * Hook to calculate duration difference for containers
 */
export const useDurationDifference = (
  item: WorkshopItem
): number => {
  const childrenSum = useChildrenDuration(item);
  
  return useMemo(() => {
    const isContainer = item.type === 'group' || item.type === 'breakout';
    return isContainer ? item.duration - childrenSum : 0;
  }, [item.type, item.duration, childrenSum]);
};

/**
 * Hook to check if item is a container
 */
export const useIsContainer = (item: WorkshopItem): boolean => {
  return useMemo(
    () => item.type === 'group' || item.type === 'breakout',
    [item.type]
  );
};

/**
 * Hook to get container label
 */
export const useContainerLabel = (item: WorkshopItem): string | null => {
  return useMemo(() => {
    if (item.type === 'group') return 'Gruppe';
    if (item.type === 'breakout') return 'Breakout';
    return null;
  }, [item.type]);
};
