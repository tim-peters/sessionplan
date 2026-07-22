import { describe, it, expect } from 'vitest';
import { formatDuration, calculateBlockTime, calculateEffectiveDuration } from '@/lib/workshopStorage';
import { makeBlock, makeWorkshop } from './test-helpers';

describe('formatDuration', () => {
  it('formats minutes-only', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(45)).toBe('45 min');
  });
  it('formats whole hours', () => {
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(120)).toBe('2 h');
  });
  it('formats hours and minutes', () => {
    expect(formatDuration(75)).toBe('1 h 15 min');
    expect(formatDuration(135)).toBe('2 h 15 min');
  });
});

describe('calculateBlockTime', () => {
  it('returns null when no startTime and no fixed anchors', () => {
    const items = [makeBlock({ duration: 15 })];
    expect(calculateBlockTime(null, items, 0)).toBeNull();
  });

  it('uses the workshop start time for the first block', () => {
    const items = [makeBlock({ duration: 10 }), makeBlock({ duration: 20 })];
    expect(calculateBlockTime('09:00', items, 0)).toBe('09:00');
    expect(calculateBlockTime('09:00', items, 1)).toBe('09:10');
  });

  it('accumulates durations across multiple blocks', () => {
    const items = [
      makeBlock({ duration: 10 }),
      makeBlock({ duration: 15 }),
      makeBlock({ duration: 30 }),
    ];
    expect(calculateBlockTime('08:00', items, 2)).toBe('08:25');
  });

  it('returns the item fixedStartTime when the item itself has one', () => {
    const items = [
      makeBlock({ duration: 10 }),
      makeBlock({ duration: 20, fixedStartTime: '10:00' }),
    ];
    expect(calculateBlockTime('09:00', items, 1)).toBe('10:00');
  });

  it('snaps to a previous fixed-time anchor instead of the start time', () => {
    // The fixed anchor (09:30) is the start of block 1; block 1 runs 5 min,
    // so block 2 starts at 09:35.
    const items = [
      makeBlock({ duration: 10 }),
      makeBlock({ duration: 5, fixedStartTime: '09:30' }),
      makeBlock({ duration: 20 }),
    ];
    expect(calculateBlockTime('09:00', items, 2)).toBe('09:35');
  });

  it('wraps around the 24h boundary', () => {
    // Block 0 starts at 23:30 and runs 30 min (ends at 00:00).
    // Block 1 starts at 00:00, runs 60 min (ends at 01:00).
    const items = [makeBlock({ duration: 30 }), makeBlock({ duration: 60 })];
    expect(calculateBlockTime('23:30', items, 1)).toBe('00:00');
  });
});

describe('calculateEffectiveDuration', () => {
  it('returns 0 for an empty item list', () => {
    expect(calculateEffectiveDuration([], '09:00')).toBe(0);
  });

  it('returns the simple sum when no startTime is set', () => {
    const items = [makeBlock({ duration: 10 }), makeBlock({ duration: 20 })];
    expect(calculateEffectiveDuration(items, null)).toBe(30);
  });

  it('returns the simple sum when no fixed anchors are present', () => {
    const items = [makeBlock({ duration: 10 }), makeBlock({ duration: 20 })];
    expect(calculateEffectiveDuration(items, '09:00')).toBe(30);
  });

  it('returns the wall-clock span when fixedStartTime introduces a gap', () => {
    // First block runs 5 min, then a fixed anchor at 10:00 jumps the clock forward
    // by 50 min from start (09:00), and the last block runs 15 min.
    const items = [
      makeBlock({ duration: 5 }),
      makeBlock({ duration: 5, fixedStartTime: '10:00' }),
      makeBlock({ duration: 15 }),
    ];
    // Span: 09:00 → 10:05 (start of fixed) + 15 min (last block) = 80 min
    expect(calculateEffectiveDuration(items, '09:00')).toBe(80);
  });
});
