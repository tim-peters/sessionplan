import { describe, expect, it } from 'vitest';
import { getContrastingTextColor } from '@/lib/color-contrast';

describe('readable initials on saved person colors', () => {
  it.each([
    ['#EAB308', '#000000'], // Palette yellow: white only reaches 1.92:1.
    ['#3B82F6', '#000000'], // Palette blue: white only reaches 3.68:1.
    ['#7CF4D9', '#000000'],
    ['#777777', '#000000'], // At the switch-over, white is below 4.5:1.
    ['#666666', '#ffffff'],
    ['#14181f', '#ffffff'],
    ['#fff', '#000000'],
    ['#000', '#ffffff'],
  ])('uses a readable foreground on %s', (color, foreground) => {
    expect(getContrastingTextColor(color)).toBe(foreground);
  });
});
