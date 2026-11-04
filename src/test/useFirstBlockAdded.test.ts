import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFirstBlockAdded } from '@/hooks/useFirstBlockAdded';

const setup = (itemCount: number, dayId = 'a') => {
  const onAdded = vi.fn();
  const view = renderHook((props) => useFirstBlockAdded(props.itemCount, props.dayId, onAdded), {
    initialProps: { itemCount, dayId },
  });
  return { onAdded, ...view };
};

describe('useFirstBlockAdded', () => {
  it('fires when an empty day gets its first block', () => {
    const { onAdded, rerender } = setup(0);
    rerender({ itemCount: 1, dayId: 'a' });
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on mount and for further blocks', () => {
    const { onAdded, rerender } = setup(1);
    rerender({ itemCount: 2, dayId: 'a' });
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('stays quiet when switching from an empty day to a day with one block', () => {
    const { onAdded, rerender } = setup(0, 'a');
    rerender({ itemCount: 1, dayId: 'b' });
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('fires on a day reached by switching once it gets its first block', () => {
    const { onAdded, rerender } = setup(3, 'a');
    rerender({ itemCount: 0, dayId: 'b' });
    rerender({ itemCount: 1, dayId: 'b' });
    expect(onAdded).toHaveBeenCalledTimes(1);
  });
});
