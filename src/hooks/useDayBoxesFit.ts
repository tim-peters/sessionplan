import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

// The list's right padding, the gap before the add button and the button itself.
const ADD_BUTTON_SPACE = 40;
const BOX_GAP = 8;
// Measured widths are rounded. Without a margin, the boxes could keep flipping at the exact limit.
const EXPAND_MARGIN = 2;

const allBoxesFit = (container: HTMLElement, list: HTMLElement, fitBefore: boolean): boolean => {
  // Not laid out (e.g. hidden on mobile): nothing to decide.
  if (container.clientWidth === 0) return true;
  const boxes = Array.from(list.children) as HTMLElement[];
  // The day list button only exists while the boxes do not fit, so it must not count.
  const dayListWidth = list.querySelector<HTMLElement>('[data-day-list]')?.offsetWidth ?? 0;
  const boxesWidth = boxes.reduce((sum, box) => sum + box.offsetWidth, 0) - dayListWidth;
  const needed = boxesWidth + BOX_GAP * Math.max(0, boxes.length - 1) + ADD_BUTTON_SPACE;
  return container.clientWidth >= needed + (fitBefore ? 0 : EXPAND_MARGIN);
};

/**
 * Whether all day boxes in `list` fit into `container`. Boxes that are not
 * shown because of this must stay measurable, so the answer can change back.
 * Measures after every render, as titles and controls change the box widths,
 * and whenever the container is resized.
 */
export function useDayBoxesFit(
  containerRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
): boolean {
  const [fit, setFit] = useState(true);

  // After every render on purpose; an unchanged answer does not render again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const container = containerRef.current;
    const list = listRef.current;
    if (container && list) setFit((before) => allBoxesFit(container, list, before));
  });

  useEffect(() => {
    const container = containerRef.current;
    const list = listRef.current;
    if (!container || !list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFit((before) => allBoxesFit(container, list, before)));
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, listRef]);

  return fit;
}
