/**
 * selectionToolbarLayout — pure geometry tests.
 *
 * These cover the four placement rules called out in the spec:
 *   1. clamp left within container
 *   2. flip above → below when no headroom
 *   3. coarse below placement + flip-up
 *   4. wider-than-container centering
 *
 * Plus a couple of additional edge cases (right-edge clamp, negative
 * container width) for completeness.
 */
import { describe, it, expect } from 'vitest';
import { computeToolbarPlacement } from '@/lib/selectionToolbarLayout';

const baseInput = {
  anchorTop: 50,
  anchorLeft: 100,
  lineHeight: 20,
  toolbarWidth: 88,
  toolbarHeight: 32,
  containerWidth: 300,
  containerHeight: 200,
  gap: 6,
};

describe('computeToolbarPlacement', () => {
  describe('horizontal clamp', () => {
    it('clamps the center to toolbarWidth/2 when the anchor sits at the left edge', () => {
      const result = computeToolbarPlacement({ ...baseInput, anchorLeft: 0, below: false });
      // toolbarWidth/2 = 44 — the toolbar's center can sit no further left
      // than half its own width or it would overflow the container.
      expect(result.left).toBe(44);
      expect(result.below).toBe(false);
    });

    it('clamps the center to containerWidth - toolbarWidth/2 at the right edge', () => {
      const result = computeToolbarPlacement({ ...baseInput, anchorLeft: 295, below: false });
      expect(result.left).toBe(300 - 44);
    });

    it('passes the anchor through unchanged when it is comfortably inside the container', () => {
      const result = computeToolbarPlacement({ ...baseInput, anchorLeft: 150, below: false });
      expect(result.left).toBe(150);
    });
  });

  describe('above → below flip', () => {
    it('places the toolbar above the anchor line by default and stays there when headroom allows', () => {
      const result = computeToolbarPlacement({ ...baseInput, anchorTop: 50, below: false });
      // anchorTop - toolbarHeight - gap = 50 - 32 - 6 = 12 (still >= 0)
      expect(result.top).toBe(12);
      expect(result.below).toBe(false);
    });

    it('flips BELOW the anchor line when the default above placement would render above the container', () => {
      const result = computeToolbarPlacement({ ...baseInput, anchorTop: 10, below: false });
      // anchorTop - toolbarHeight - gap = 10 - 32 - 6 = -28 < 0 → flip
      // anchorTop + lineHeight + gap = 10 + 20 + 6 = 36
      expect(result.below).toBe(true);
      expect(result.top).toBe(36);
    });
  });

  describe('coarse (touch) below placement', () => {
    it('anchors BELOW the anchor line by default on coarse pointers', () => {
      const result = computeToolbarPlacement({ ...baseInput, anchorTop: 50, below: true });
      // anchorTop + lineHeight + gap = 50 + 20 + 6 = 76
      expect(result.below).toBe(true);
      expect(result.top).toBe(76);
    });

    it('flips ABOVE the anchor line when the default below placement overflows the container', () => {
      const result = computeToolbarPlacement({ ...baseInput, anchorTop: 170, below: true });
      // 170 + 20 + 6 + 32 = 228 > containerHeight 200 → flip above
      // 170 - 32 - 6 = 132
      expect(result.below).toBe(false);
      expect(result.top).toBe(132);
    });

    it('clamps flipped-above top to 0 when the container is too short to fit the toolbar above', () => {
      const result = computeToolbarPlacement({
        ...baseInput,
        anchorTop: 10,
        containerHeight: 50,
        below: true,
      });
      // 10 + 20 + 6 + 32 = 68 > 50 → flip above: 10 - 32 - 6 = -28 → clamp to 0
      expect(result.below).toBe(false);
      expect(result.top).toBe(0);
    });
  });

  describe('wider-than-container centering', () => {
    it('centers the toolbar on the container midline when the toolbar is wider than the container', () => {
      const result = computeToolbarPlacement({
        ...baseInput,
        toolbarWidth: 500,
        anchorLeft: 100,
        below: false,
      });
      expect(result.left).toBe(150); // containerWidth/2
    });

    it('centers on the container midline when the container has no width', () => {
      const result = computeToolbarPlacement({
        ...baseInput,
        containerWidth: 0,
        anchorLeft: 100,
        below: false,
      });
      expect(result.left).toBe(0);
    });
  });
});
