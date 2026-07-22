export const getInitials = (name: string, maxLen = 2): string =>
  name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .substring(0, maxLen)
    .toUpperCase();
