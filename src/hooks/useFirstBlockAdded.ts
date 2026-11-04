import { useEffect, useRef } from 'react';

/**
 * Calls `onAdded` when an empty day gets its first block. Switching from an
 * empty day to one that already has a block changes the count too, so the
 * count is only compared within the same day.
 */
export function useFirstBlockAdded(itemCount: number, dayId: string, onAdded: () => void): void {
  const previous = useRef({ itemCount, dayId });

  useEffect(() => {
    const { itemCount: previousCount, dayId: previousDayId } = previous.current;
    previous.current = { itemCount, dayId };
    if (previousDayId === dayId && previousCount === 0 && itemCount === 1) onAdded();
  }, [itemCount, dayId, onAdded]);
}
