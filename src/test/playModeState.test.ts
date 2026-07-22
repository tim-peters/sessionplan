import { describe, it, expect } from 'vitest';
import { computePlayStates } from '@/lib/playModeState';
import { FlatBlock } from '@/lib/playModeTimeline';

const fb = (id: string, startMin: number, endMin: number): FlatBlock => ({
  id,
  title: id,
  startMin,
  endMin,
  type: 'block',
});

describe('computePlayStates', () => {
  it('returns past/current/future for each block', () => {
    const blocks = [fb('a', 0, 10), fb('b', 10, 20), fb('c', 20, 30)];
    const states = computePlayStates(blocks, 15);
    expect(states.get('a')).toBe('past');
    expect(states.get('b')).toBe('current');
    expect(states.get('c')).toBe('future');
  });

  it('treats the exact end-minute as past, not current', () => {
    const blocks = [fb('a', 0, 10)];
    expect(computePlayStates(blocks, 10).get('a')).toBe('past');
  });

  it('treats the exact start-minute as current', () => {
    const blocks = [fb('a', 0, 10)];
    expect(computePlayStates(blocks, 0).get('a')).toBe('current');
  });

  it('marks an empty list as empty (not throwing)', () => {
    const states = computePlayStates([], 5);
    expect(states.size).toBe(0);
  });

  it('handles elapsed before any block', () => {
    const blocks = [fb('a', 10, 20)];
    expect(computePlayStates(blocks, 5).get('a')).toBe('future');
  });

  it('handles elapsed after the last block', () => {
    const blocks = [fb('a', 0, 10)];
    expect(computePlayStates(blocks, 100).get('a')).toBe('past');
  });
});
