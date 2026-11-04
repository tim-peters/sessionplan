/** Choose a readable foreground without changing a saved category/person color. */
export const getContrastingTextColor = (color: string): '#000000' | '#ffffff' => {
  const hex = color.replace(/^#/, '');
  const expanded = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (!/^[\da-f]{6}$/i.test(expanded)) return '#000000';
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
};
