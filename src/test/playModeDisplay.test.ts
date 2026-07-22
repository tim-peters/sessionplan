import { describe, it, expect } from 'vitest';
import { resolveCurrentDisplay } from '@/lib/playModeDisplay';
import { FlatBlock } from '@/lib/playModeTimeline';

const fb = (
  id: string,
  title: string,
  startMin: number,
  endMin: number,
  parentId?: string,
  type: FlatBlock['type'] = 'block',
): FlatBlock => ({ id, title, startMin, endMin, parentId, type });

describe('resolveCurrentDisplay — top-level blocks', () => {
  it('returns the current block and the next block as labels', () => {
    const blocks = [fb('a', 'A', 0, 10), fb('b', 'B', 10, 20), fb('c', 'C', 20, 30)];
    const d = resolveCurrentDisplay(blocks, 5);
    expect(d.current?.id).toBe('a');
    expect(d.next?.id).toBe('b');
    expect(d.label).toBe('A');
    expect(d.nextLabel).toBe('B');
    expect(d.prevLabel).toBeNull();
  });

  it('returns null next when at the only block', () => {
    const blocks = [fb('a', 'A', 0, 10)];
    const d = resolveCurrentDisplay(blocks, 0);
    expect(d.current?.id).toBe('a');
    expect(d.next).toBeNull();
    expect(d.nextLabel).toBeNull();
    expect(d.prevLabel).toBeNull();
  });

  it('returns the next block as current at the exact start of that block', () => {
    // At elapsed=10, block 'a' (0–10) just ended, block 'b' (10–20) just started.
    const blocks = [fb('a', 'A', 0, 10), fb('b', 'B', 10, 20)];
    const d = resolveCurrentDisplay(blocks, 10);
    expect(d.current?.id).toBe('b');
    expect(d.next).toBeNull();
    expect(d.prevLabel).toBe('A');
  });

  it('returns null current and no next when the last block has ended', () => {
    const blocks = [fb('a', 'A', 0, 10)];
    const d = resolveCurrentDisplay(blocks, 100);
    expect(d.current).toBeNull();
    expect(d.next).toBeNull();
    expect(d.prevLabel).toBe('A');
  });
});

describe('resolveCurrentDisplay — groups', () => {
  it('drills into the active child and shows the group → child label', () => {
    const blocks = [
      fb('g', 'Group', 0, 20, undefined, 'group'),
      fb('c1', 'C1', 0, 10, 'g', 'block'),
      fb('c2', 'C2', 10, 20, 'g', 'block'),
    ];
    const d = resolveCurrentDisplay(blocks, 5);
    expect(d.current?.id).toBe('c1');
    expect(d.label).toBe('Group → C1');
    expect(d.nextLabel).toBe('Group → C2');
  });

  it('falls back to the next top-level block when the last child is running', () => {
    const blocks = [
      fb('a', 'A', 0, 10, undefined, 'block'),
      fb('g', 'Group', 10, 20, undefined, 'group'),
      fb('c1', 'C1', 10, 20, 'g', 'block'),
    ];
    const d = resolveCurrentDisplay(blocks, 15);
    expect(d.current?.id).toBe('c1');
    expect(d.next).toBeNull(); // no top-level block after g
    expect(d.nextLabel).toBeNull();
    expect(d.label).toBe('Group → C1');
  });
});

describe('resolveCurrentDisplay — breakouts (parallel children)', () => {
  it('joins multiple active lane children in a single label', () => {
    const blocks = [
      fb('br', 'Breakout', 0, 20, undefined, 'breakout'),
      fb('l0a', 'Task', 0, 10, 'br', 'block'),
      fb('l1a', 'Task', 0, 10, 'br', 'block'),
    ];
    const d = resolveCurrentDisplay(blocks, 5);
    expect(d.label).toBe('Breakout → Task ×2');
  });

  it('shows distinct lane labels when the children have different titles', () => {
    const blocks = [
      fb('br', 'Breakout', 0, 20, undefined, 'breakout'),
      fb('l0', 'Discuss', 0, 10, 'br', 'block'),
      fb('l1', 'Plan', 0, 10, 'br', 'block'),
    ];
    const d = resolveCurrentDisplay(blocks, 5);
    expect(d.label).toBe('Breakout → Discuss / Plan');
  });
});
