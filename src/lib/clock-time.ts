/**
 * clock-time — Conversions between "HH:MM" strings and minutes since 00:00.
 */

/** Converts an "HH:MM" string to minutes since 00:00. */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** Formats minutes since 00:00 as "HH:MM". Hours wrap around at midnight. */
export const minutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/** Like `minutesToTime`, for computed values: rounds, and treats negatives as 00:00. */
export const formatMinAsHHMM = (min: number): string => minutesToTime(Math.max(0, Math.round(min)));
