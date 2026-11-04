import { useEffect, useRef, useState, type RefObject } from 'react';

// Match the planner's md breakpoint.
const MOBILE_QUERY = '(max-width: 767px)';

const scrollTop = () => Math.max(0, Math.min(
  window.scrollY,
  document.documentElement.scrollHeight - window.innerHeight,
));

/**
 * Hide mobile planner controls on downward scroll; reveal on upward scroll.
 * A change of `scrollTopKey` jumps to the top of the page on mobile without
 * revealing them: `hiddenHeight` is how far the page stays scrolled while hidden.
 */
export function useMobileHeaderHidden(
  ref: RefObject<HTMLElement | null>,
  hiddenHeight: number,
  scrollTopKey: unknown,
): boolean {
  const [hidden, setHidden] = useState(false);
  const anchor = useRef(0);
  const previousKey = useRef(scrollTopKey);

  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY);
    anchor.current = scrollTop();

    const reset = () => {
      anchor.current = scrollTop();
      setHidden(false);
    };
    const onScroll = () => {
      if (!mobile.matches) return;
      const current = scrollTop();
      const header = ref.current;
      const editing = header?.contains(document.activeElement)
        && document.activeElement?.matches('input, textarea, [contenteditable="true"]');

      if (current <= (header?.offsetHeight ?? 0)) {
        if (current < anchor.current) setHidden(false);
        anchor.current = current;
      } else if (Math.abs(current - anchor.current) >= 8) {
        const down = current > anchor.current;
        // The on-screen keyboard scrolls the page down; that must not hide the field being edited.
        if (!down || !editing) setHidden(down);
        anchor.current = current;
      }
    };
    // Only keyboard focus can land on a control that is scrolled away; bring just that one back.
    const onFocus = (event: FocusEvent) => {
      const { target } = event;
      if (target instanceof Element && ref.current?.contains(target) && target.getBoundingClientRect().top < 0) reset();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    mobile.addEventListener('change', reset);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('scroll', onScroll);
      mobile.removeEventListener('change', reset);
      document.removeEventListener('focusin', onFocus);
    };
  }, [ref]);

  useEffect(() => {
    if (previousKey.current === scrollTopKey) return;
    previousKey.current = scrollTopKey;
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    window.scrollTo(0, hidden ? hiddenHeight : 0);
    // The jump is not a scroll by the user, so its scroll event must read as no movement.
    anchor.current = scrollTop();
  }, [scrollTopKey, hidden, hiddenHeight]);

  return hidden;
}
