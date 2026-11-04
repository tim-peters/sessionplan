import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveDay } from '@/hooks/useLiveDay';
import { usePlayMode } from '@/hooks/usePlayMode';
import { useScheduledDay } from '@/hooks/useScheduledDay';
import { removeDay } from '@/lib/workshop-days';
import { PLAY_MODE_TICK_MS } from '@/lib/timing';
import { createEmptyWorkshop, WorkshopData, WorkshopItem } from '@/types/workshop';

const block = (id: string, duration = 60): WorkshopItem => ({
  id,
  type: 'block',
  blockTypeId: null,
  title: id,
  duration,
  notes: '',
  material: '',
});

const plan = (): WorkshopData => ({
  ...createEmptyWorkshop(),
  workshop: { title: 'Retreat', description: '', date: '2026-10-12', startTime: '09:00' },
  items: [block('a')],
  days: [
    { id: 'day-1' },
    { id: 'day-2', date: '2026-10-13', startTime: '09:00', items: [block('b')] },
    { id: 'day-3', date: null, startTime: null, items: [block('c')] },
  ],
});

const tick = (ms = PLAY_MODE_TICK_MS) => act(() => { vi.advanceTimersByTime(ms); });

const renderLive = (initial: WorkshopData, activeDayId = 'day-1') =>
  renderHook(
    (props: { data: WorkshopData; activeDayId: string }) => useLiveDay(props.data, props.activeDayId, false),
    { initialProps: { data: initial, activeDayId } },
  );

beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 9, 12, 8, 0) }));
afterEach(() => vi.useRealTimers());

describe('useLiveDay', () => {
  it('runs the manually started day, whichever day is visible afterwards', () => {
    const { result, rerender } = renderLive(plan(), 'day-3');

    act(() => result.current.playMode.activate());
    expect(result.current.liveDayId).toBe('day-3');

    rerender({ data: plan(), activeDayId: 'day-1' });
    expect(result.current.liveDayId).toBe('day-3');
    expect(result.current.playMode.isActive).toBe(true);
  });

  it('ends the run when the manually started day is deleted', () => {
    const data = plan();
    const { result, rerender } = renderLive(data, 'day-3');
    act(() => result.current.playMode.activate());

    rerender({ data: removeDay(data, 'day-3'), activeDayId: 'day-1' });

    expect(result.current.playMode.isActive).toBe(false);
    expect(result.current.liveDayId).toBe('day-1');
  });

  it('keeps running when the other days are deleted and one day remains', () => {
    const data: WorkshopData = {
      ...plan(),
      days: [{ id: 'first' }, { id: 'second', items: [block('b')] }],
    };
    const { result, rerender } = renderLive(data, 'first');
    act(() => result.current.playMode.activate());

    rerender({ data: removeDay(data, 'second'), activeDayId: 'day-1' });

    expect(result.current.playMode.isActive).toBe(true);
  });

  it('follows the scheduled day without a manual start', () => {
    vi.setSystemTime(new Date(2026, 9, 13, 9, 30));
    const { result } = renderLive(plan());

    expect(result.current.liveDayId).toBe('day-2');
    expect(result.current.playMode.isActive).toBe(true);
    expect(result.current.playMode.currentDisplay?.current?.id).toBe('b');
  });

  it('a stop keeps its day off, the next scheduled day starts again', () => {
    vi.setSystemTime(new Date(2026, 9, 12, 9, 30));
    const { result } = renderLive(plan());
    expect(result.current.playMode.isActive).toBe(true);

    act(() => result.current.playMode.deactivate());
    tick();
    expect(result.current.playMode.isActive).toBe(false);

    act(() => { vi.setSystemTime(new Date(2026, 9, 13, 9, 30)); });
    tick();
    expect(result.current.liveDayId).toBe('day-2');
    expect(result.current.playMode.isActive).toBe(true);
  });
});

describe('usePlayMode stop guard', () => {
  const single = (): WorkshopData => ({
    ...createEmptyWorkshop(),
    workshop: { title: 'Retro', description: '', date: '2026-10-12', startTime: '09:00' },
    items: [block('a')],
  });

  it('a stop outside the scheduled window does not block that window', () => {
    const { result } = renderHook(() => usePlayMode(single(), 60, false));

    act(() => result.current.activate());
    act(() => result.current.deactivate());
    expect(result.current.isActive).toBe(false);

    act(() => { vi.setSystemTime(new Date(2026, 9, 12, 9, 30)); });
    tick();
    expect(result.current.isActive).toBe(true);
  });
});

describe('useScheduledDay', () => {
  it('renders only when the scheduled day changes', () => {
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    const data = plan();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useScheduledDay(data);
    });
    const initialRenders = renders;
    expect(result.current).toBe('day-1');

    tick();
    tick();
    expect(renders).toBe(initialRenders);

    act(() => { vi.setSystemTime(new Date(2026, 9, 13, 9, 30)); });
    tick();
    expect(result.current).toBe('day-2');
    expect(renders).toBe(initialRenders + 1);
  });
});
