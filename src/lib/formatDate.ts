/**
 * Formats a date string into a localized German date string.
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
};
