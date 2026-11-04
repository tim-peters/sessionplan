import { describe, expect, it } from 'vitest';
import { formatMinAsHHMM, minutesToTime, timeToMinutes } from '@/lib/clock-time';
import {
  calculateEndTime,
  calculateFixedStartGap,
  calculateNestedBlockTime,
} from '@/lib/workshopUtils';
import { makeBlock, makeBreakout, makeGroup } from './test-helpers';

const block = (duration: number, overrides = {}) => makeBlock({ duration, ...overrides });

describe('clock-time', () => {
  it('converts between "HH:MM" and minutes, wrapping at midnight', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(24 * 60 + 5)).toBe('00:05');
  });

  it('formats computed values rounded and without negatives', () => {
    expect(formatMinAsHHMM(90.4)).toBe('01:30');
    expect(formatMinAsHHMM(-10)).toBe('00:00');
  });
});

describe('calculateNestedBlockTime', () => {
  it('adds up the preceding children of a group', () => {
    const group = makeGroup([block(10), block(20), block(5)]);
    expect(calculateNestedBlockTime('09:00', group, 2)).toBe('09:30');
  });

  it('starts at the last fixed anchor before the child', () => {
    const group = makeGroup([block(10), block(20, { fixedStartTime: '11:00' }), block(5)]);
    expect(calculateNestedBlockTime('09:00', group, 2)).toBe('11:20');
  });

  it('only counts the own lane of a breakout', () => {
    const breakout = makeBreakout([
      block(10, { laneIndex: 0 }),
      block(99, { laneIndex: 1, fixedStartTime: '15:00' }),
      block(5, { laneIndex: 0 }),
    ]);
    expect(calculateNestedBlockTime('09:00', breakout, 2)).toBe('09:10');
  });

  it('returns a fixed time even without a parent time, and otherwise null', () => {
    const group = makeGroup([block(10, { fixedStartTime: '12:00' }), block(5)]);
    expect(calculateNestedBlockTime(null, group, 0)).toBe('12:00');
    expect(calculateNestedBlockTime(null, group, 1)).toBeNull();
  });
});

describe('calculateEndTime', () => {
  it('is the end of the last item, or null without a start time or items', () => {
    expect(calculateEndTime('09:00', [block(10), block(20)])).toBe('09:30');
    expect(calculateEndTime(null, [block(10)])).toBeNull();
    expect(calculateEndTime('09:00', [])).toBeNull();
  });
});

describe('calculateFixedStartGap', () => {
  it('measures from the end of what precedes the fixed time', () => {
    expect(calculateFixedStartGap('10:00', '09:00', 30)).toBe(30);
    expect(calculateFixedStartGap('09:15', '09:00', 30)).toBe(-15);
  });

  it('is null without a fixed time or a reference', () => {
    expect(calculateFixedStartGap(undefined, '09:00')).toBeNull();
    expect(calculateFixedStartGap('10:00', null)).toBeNull();
  });
});
