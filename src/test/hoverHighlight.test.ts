import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  getHoveredItem,
  getHoveredItemId,
  setHoveredItem,
  subscribe,
} from '@/lib/hoverHighlight';
import { useIsStripHighlighted } from '@/hooks/useHoverHighlight';

describe('hoverHighlight store', () => {
  beforeEach(() => {
    // Reset between tests so state from one test doesn't leak into another.
    setHoveredItem(null, null);
  });

  it('starts at null (id and full state)', () => {
    expect(getHoveredItemId()).toBeNull();
    expect(getHoveredItem()).toBeNull();
  });

  it('setHoveredItem updates id, source, and full state', () => {
    setHoveredItem('a', 'strip');
    expect(getHoveredItemId()).toBe('a');
    expect(getHoveredItem()).toEqual({ id: 'a', source: 'strip' });

    setHoveredItem('b', 'timeline');
    expect(getHoveredItemId()).toBe('b');
    expect(getHoveredItem()).toEqual({ id: 'b', source: 'timeline' });

    setHoveredItem(null, null);
    expect(getHoveredItemId()).toBeNull();
    expect(getHoveredItem()).toBeNull();
  });

  it('notifies subscribers with the full state on every change', () => {
    const calls: (string | null)[] = [];
    const unsub = subscribe((item) => calls.push(item?.id ?? null));
    setHoveredItem('a', 'strip');
    setHoveredItem('b', 'timeline');
    setHoveredItem(null, null);
    expect(calls).toEqual(['a', 'b', null]);
    unsub();
  });

  it('does not notify when both id and source are unchanged', () => {
    setHoveredItem('a', 'strip'); // baseline
    const calls: (string | null)[] = [];
    const unsub = subscribe((item) => calls.push(item?.id ?? null));
    setHoveredItem('a', 'strip'); // same → no-op
    setHoveredItem('a', 'strip'); // same → no-op
    setHoveredItem('b', 'strip'); // different id → notify
    expect(calls).toEqual(['b']);
    unsub();
  });

  it('notifies when the source changes for the same id', () => {
    setHoveredItem('a', 'strip');
    const calls: (string | null)[] = [];
    const unsub = subscribe((item) => calls.push(item?.id ?? null));
    setHoveredItem('a', 'timeline'); // same id, different source → notify
    setHoveredItem('a', 'timeline'); // same again → no-op
    setHoveredItem('a', 'strip');    // back to strip → notify
    expect(calls).toEqual(['a', 'a']);
    unsub();
  });

  it('multiple subscribers all receive notifications', () => {
    const a: ({ id: string; source: string } | null)[] = [];
    const b: ({ id: string; source: string } | null)[] = [];
    const ua = subscribe((item) => a.push(item));
    const ub = subscribe((item) => b.push(item));
    setHoveredItem('x', 'strip');
    setHoveredItem('y', 'timeline');
    expect(a).toEqual([{ id: 'x', source: 'strip' }, { id: 'y', source: 'timeline' }]);
    expect(b).toEqual([{ id: 'x', source: 'strip' }, { id: 'y', source: 'timeline' }]);
    ua();
    ub();
  });

  it('unsubscribe stops further notifications for that listener only', () => {
    const a: (string | null)[] = [];
    const b: (string | null)[] = [];
    const ua = subscribe((item) => a.push(item?.id ?? null));
    subscribe((item) => b.push(item?.id ?? null));
    setHoveredItem('first', 'strip');
    ua();
    setHoveredItem('second', 'strip');
    expect(a).toEqual(['first']);
    expect(b).toEqual(['first', 'second']);
  });

  it('dispatch is safe against an unsubscribing listener', () => {
    // A listener that unsubscribes itself mid-dispatch must not break the
    // remaining listeners. This was the regression behind the snapshot-
    // before-iterating guard in subscribe().
    const log: string[] = [];
    const unsub1 = subscribe(() => {
      log.push('one');
      unsub1();
    });
    subscribe(() => log.push('two'));
    setHoveredItem('p', 'strip');
    expect(log).toEqual(['one', 'two']);
  });

  it('getHoveredItem returns a stable reference between changes', () => {
    setHoveredItem('a', 'strip');
    const first = getHoveredItem();
    // No change yet → same reference (lets useSyncExternalStore skip work).
    expect(getHoveredItem()).toBe(first);
    setHoveredItem('a', 'strip'); // no-op at the store level
    expect(getHoveredItem()).toBe(first);
  });

  it('getHoveredItem returns a new reference on a real change', () => {
    setHoveredItem('a', 'strip');
    const first = getHoveredItem()!;
    setHoveredItem('a', 'timeline'); // source-only change → new object
    const second = getHoveredItem()!;
    expect(second).not.toBe(first);
    expect(second).toEqual({ id: 'a', source: 'timeline' });
  });
});

describe('useIsStripHighlighted (hook)', () => {
  beforeEach(() => {
    setHoveredItem(null, null);
  });

  it('returns false when nothing is hovered', () => {
    const { result } = renderHook(() => useIsStripHighlighted('a'));
    expect(result.current).toBe(false);
  });

  it('returns false when the hovered id does not match', () => {
    setHoveredItem('b', 'strip');
    const { result } = renderHook(() => useIsStripHighlighted('a'));
    expect(result.current).toBe(false);
  });

  it('returns true when the matching id was hovered from the strip', () => {
    setHoveredItem('a', 'strip');
    const { result } = renderHook(() => useIsStripHighlighted('a'));
    expect(result.current).toBe(true);
  });

  it('returns false when the matching id was hovered from the timeline', () => {
    // This is the new behaviour: hovering a card directly does NOT make
    // `useIsStripHighlighted` return true — the card uses its native CSS
    // hover affordance instead.
    setHoveredItem('a', 'timeline');
    const { result } = renderHook(() => useIsStripHighlighted('a'));
    expect(result.current).toBe(false);
  });

  it('returns false when the caller passes a null id', () => {
    setHoveredItem('a', 'strip');
    const { result } = renderHook(() => useIsStripHighlighted(null));
    expect(result.current).toBe(false);
  });

  it('flips from false to true when the source changes to strip', () => {
    setHoveredItem('a', 'timeline');
    const { result } = renderHook(() => useIsStripHighlighted('a'));
    expect(result.current).toBe(false);
    act(() => setHoveredItem('a', 'strip'));
    expect(result.current).toBe(true);
  });

  it('flips from true to false when the source changes to timeline', () => {
    setHoveredItem('a', 'strip');
    const { result } = renderHook(() => useIsStripHighlighted('a'));
    expect(result.current).toBe(true);
    act(() => setHoveredItem('a', 'timeline'));
    expect(result.current).toBe(false);
  });

  it('does not re-render the card when the store changes for an unrelated id (snapshot is the derived boolean)', () => {
    // Regression for the per-card re-render problem: with the old implementation
    // (snapshot returned the underlying store object) every store change fired a
    // re-render in every card. The new snapshot is the derived boolean, so an
    // unrelated change keeps the snapshot identical and React skips the render.
    setHoveredItem('a', 'strip');
    const renderSpy = vi.fn();
    const { result } = renderHook(() => {
      renderSpy();
      return useIsStripHighlighted('card-b');
    });
    expect(result.current).toBe(false);
    const initialCalls = renderSpy.mock.calls.length;

    // A flurry of unrelated store changes for a different id.
    act(() => setHoveredItem('a', 'timeline'));
    act(() => setHoveredItem('x', 'strip'));
    act(() => setHoveredItem('x', 'timeline'));
    act(() => setHoveredItem('a', 'strip'));
    act(() => setHoveredItem(null, null));

    // The card-b snapshot stayed `false` the whole time → React skipped the
    // re-renders. The hook itself runs once more (the act() wrapper), but the
    // initial-render count should not grow across the unrelated changes.
    expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(initialCalls + 1);
    expect(result.current).toBe(false);
  });
});