import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges simple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('supports conditional className values', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('combines arrays and objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false }, 'e')).toBe('a b c e');
  });
});
