/**
 * KeyboardShortcutHints — Keycaps over every visible control with a shortcut.
 *
 * Role: A single portal layer that measures `[data-shortcut]` elements instead
 *       of a badge inside each button: nothing shifts, and scroll containers
 *       such as the sidebar can't clip the keycaps. Purely visual, so hidden
 *       from assistive technology, which gets `aria-keyshortcuts` instead.
 *       Targets opt into a placement with `data-shortcut-outside` (left of the
 *       element) or by sitting inside a `data-shortcut-bar` (on the bar's lower edge).
 * Used by: WorkshopPlanner, while useAltShortcutHints reports `visible`
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Kbd } from '@/components/atoms/Kbd';
import { formatShortcutCompact, type ShortcutId } from '@/lib/keyboard-shortcuts';
import { cn } from '@/lib/utils';

type Placement = 'outside' | 'inside' | 'bar' | 'corner';

interface HintPosition {
  key: string;
  label: string;
  left: number;
  top: number;
  placement: Placement;
}

const PLACEMENT_CLASS: Record<Placement, string> = {
  outside: '-translate-x-full -translate-y-1/2',
  inside: '-translate-x-full -translate-y-1/2',
  bar: '-translate-x-1/2 -translate-y-1/2',
  corner: '-translate-x-1/2 -translate-y-1/2',
};

/** Wide targets (sidebar rows, the title) have free space at their right end for
 *  the keycap; on anything smaller it sits on the corner to keep the label readable. */
const INSIDE_MIN_WIDTH = 160;
const VIEWPORT_MARGIN = 12;
const OUTSIDE_GAP = 4;
/** Keeps a keycap hanging left of its target on screen in narrow windows. */
const OUTSIDE_RESERVE = 32;
/** Neighbouring header bars differ by a few pixels; their keycaps share one line. */
const BAR_ALIGN_TOLERANCE = 8;
const BAR_HINT_GAP = 2;

const clamp = (value: number, max: number) =>
  Math.min(Math.max(value, VIEWPORT_MARGIN), max - VIEWPORT_MARGIN);

/** Covered, scrolled-away or clipped elements don't get a keycap: whatever is
 *  actually at their centre has to be the element itself or part of it. Neither
 *  do buttons faded out until hover, where a keycap would float over nothing. */
const isReachable = (element: Element, rect: DOMRect): boolean => {
  if (rect.width === 0 || rect.height === 0 || element.matches(':disabled')) return false;
  if (element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) === false) return false;
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return hit !== null && element.contains(hit);
};

const placeHint = (element: HTMLElement, rect: DOMRect): Pick<HintPosition, 'left' | 'top' | 'placement'> => {
  const middle = rect.top + rect.height / 2;
  if (element.hasAttribute('data-shortcut-outside')) {
    return { left: Math.max(rect.left - OUTSIDE_GAP, OUTSIDE_RESERVE), top: middle, placement: 'outside' };
  }
  const bar = element.closest('[data-shortcut-bar]');
  if (bar) {
    return { left: rect.left + rect.width / 2, top: bar.getBoundingClientRect().bottom, placement: 'bar' };
  }
  if (rect.width >= INSIDE_MIN_WIDTH) {
    return { left: rect.right - 8, top: middle, placement: 'inside' };
  }
  return { left: rect.right, top: rect.top, placement: 'corner' };
};

/** Upper estimate of a keycap's width, known before it is rendered. */
const estimateWidth = (label: string) => label.length * 8 + 16;

/** Header buttons sit closer together than a long label like "Ctrl+Z" is wide:
 *  on one line, each keycap moves right until it clears the one before it. */
const spreadBarHints = (hints: HintPosition[]): HintPosition[] => {
  const barHints = hints.filter((hint) => hint.placement === 'bar').sort((a, b) => a.left - b.left);
  const lefts = new Map<HintPosition, number>();
  barHints.forEach((hint, index) => {
    const previous = barHints[index - 1];
    if (!previous || previous.top !== hint.top) return;
    const clear = (lefts.get(previous) ?? previous.left)
      + (estimateWidth(previous.label) + estimateWidth(hint.label)) / 2 + BAR_HINT_GAP;
    if (clear > hint.left) lefts.set(hint, clear);
  });
  return hints.map((hint) => ({ ...hint, left: lefts.get(hint) ?? hint.left }));
};

const measureHints = (t: (key: string) => string): HintPosition[] => {
  const hints = Array.from(document.querySelectorAll<HTMLElement>('[data-shortcut]')).flatMap((element, index) => {
    const rect = element.getBoundingClientRect();
    if (!isReachable(element, rect)) return [];
    const id = element.dataset.shortcut as ShortcutId;
    const digit = element.dataset.shortcutDigit ? Number(element.dataset.shortcutDigit) : undefined;
    return [{
      key: `${id}-${digit ?? ''}-${index}`,
      label: formatShortcutCompact(id, t, digit),
      ...placeHint(element, rect),
    }];
  });

  const barTops = hints.filter((hint) => hint.placement === 'bar').map((hint) => hint.top);
  const aligned = hints.map((hint) => (
    hint.placement === 'bar'
      ? { ...hint, top: Math.max(...barTops.filter((other) => Math.abs(other - hint.top) <= BAR_ALIGN_TOLERANCE)) }
      : hint
  ));
  return spreadBarHints(aligned).map((hint) => ({
    ...hint,
    left: clamp(hint.left, window.innerWidth),
    top: clamp(hint.top, window.innerHeight),
  }));
};

export const KeyboardShortcutHints = () => {
  const { t } = useTranslation('common');
  const [hints, setHints] = useState<HintPosition[]>(() => measureHints(t));

  useEffect(() => {
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHints(measureHints(t)));
    };
    window.addEventListener('scroll', remeasure, { capture: true, passive: true });
    window.addEventListener('resize', remeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', remeasure, { capture: true });
      window.removeEventListener('resize', remeasure);
    };
  }, [t]);

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] print:hidden">
      {hints.map((hint) => (
        <Kbd
          key={hint.key}
          data-shortcut-hint={hint.label}
          data-placement={hint.placement}
          className={cn('fixed border-transparent bg-foreground/80 text-background shadow-md', PLACEMENT_CLASS[hint.placement])}
          style={{ left: hint.left, top: hint.top }}
        >
          {hint.label}
        </Kbd>
      ))}
    </div>,
    document.body,
  );
};
