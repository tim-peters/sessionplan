import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMobileHeaderHidden } from '@/hooks/useMobileHeaderHidden';

const ACTION_BAR = 56;

function Header({ day = 'a' }: { day?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const hidden = useMobileHeaderHidden(ref, ACTION_BAR, day);
  return (
    <div ref={ref} data-hidden={hidden} data-testid="header">
      <button>Datum</button>
      <input aria-label="Titel" />
    </div>
  );
}

const setScrollY = (top: number) => Object.defineProperty(window, 'scrollY', { configurable: true, value: top });
const scrollTo = (top: number) => act(() => {
  setScrollY(top);
  window.dispatchEvent(new Event('scroll'));
});
const isHidden = () => screen.getByTestId('header').dataset.hidden === 'true';
const placeAt = (element: HTMLElement, top: number) => {
  element.getBoundingClientRect = () => ({ top }) as DOMRect;
};
const stubViewport = (isMobile: boolean) => {
  vi.stubGlobal('matchMedia', () => ({ matches: isMobile, addEventListener: () => {}, removeEventListener: () => {} }));
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 10000 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 150 });
  setScrollY(0);
  window.scrollTo = vi.fn((_x: number, top: number) => setScrollY(top)) as unknown as typeof window.scrollTo;
};

describe('useMobileHeaderHidden', () => {
  beforeEach(() => {
    stubViewport(true);
    render(<Header />);
    scrollTo(800);
    expect(isHidden()).toBe(true);
  });

  it('comes back when scrolling up', () => {
    scrollTo(700);
    expect(isHidden()).toBe(false);
  });

  it('stays hidden when a visible control takes focus', () => {
    const button = screen.getByRole('button', { name: 'Datum' });
    placeAt(button, 12);
    fireEvent.focusIn(button);
    expect(isHidden()).toBe(true);
  });

  it('comes back when focus lands on a control scrolled out of view', () => {
    const button = screen.getByRole('button', { name: 'Datum' });
    placeAt(button, -40);
    fireEvent.focusIn(button);
    expect(isHidden()).toBe(false);
  });

  it('does not react to the keyboard scrolling while a title is edited', () => {
    const input = screen.getByRole('textbox', { name: 'Titel' });
    placeAt(input, 12);
    act(() => input.focus());
    scrollTo(900);
    expect(isHidden()).toBe(true);

    scrollTo(800);
    expect(isHidden()).toBe(false);

    scrollTo(900);
    expect(isHidden()).toBe(false);
  });
});

describe('useMobileHeaderHidden on a day switch', () => {
  beforeEach(() => stubViewport(true));

  it('does not scroll on mount or when the day stays', () => {
    const { rerender } = render(<Header />);
    rerender(<Header />);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('jumps to the top and stays hidden', () => {
    const { rerender } = render(<Header />);
    scrollTo(800);
    rerender(<Header day="b" />);
    expect(window.scrollTo).toHaveBeenCalledWith(0, ACTION_BAR);

    // The browser reports the jump afterwards; that must not count as scrolling up.
    scrollTo(ACTION_BAR);
    expect(isHidden()).toBe(true);
  });

  it('stays hidden when scrolling on down from there', () => {
    const { rerender } = render(<Header />);
    scrollTo(800);
    rerender(<Header day="b" />);
    scrollTo(ACTION_BAR);

    scrollTo(100);
    expect(isHidden()).toBe(true);
  });

  it('comes back when scrolling up from there', () => {
    const { rerender } = render(<Header />);
    scrollTo(800);
    rerender(<Header day="b" />);
    scrollTo(ACTION_BAR);

    scrollTo(20);
    expect(isHidden()).toBe(false);
  });

  it('goes all the way up while the controls are visible', () => {
    const { rerender } = render(<Header />);
    scrollTo(800);
    scrollTo(700);
    rerender(<Header day="b" />);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(isHidden()).toBe(false);
  });

  it('keeps the position on desktop', () => {
    stubViewport(false);
    const { rerender } = render(<Header />);
    rerender(<Header day="b" />);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
