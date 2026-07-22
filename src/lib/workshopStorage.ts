/**
 * workshopStorage — Barrel re-export for all workshop persistence modules.
 *
 * Role: Backward-compatible entry point. Actual implementation is split into
 *       workshopUrl.ts, workshopLocalStorage.ts, and workshopServer.ts.
 */
import { WorkshopItem } from '@/types/workshop';

// Re-export all sub-modules
export * from './workshopUrl';
export * from './workshopLocalStorage';
export * from './workshopServer';
export { calculateTotalDuration } from './workshopUtils';

// ── Duration utilities (kept here — used by Timeline and WorkshopPlanner) ─────

/** Formats a duration in minutes as a human-readable string. */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
};

/** Calculates the absolute clock time for a block at a given index. */
export const calculateBlockTime = (
  startTime: string | null,
  items: WorkshopItem[],
  targetIndex: number
): string | null => {
  // If this item itself has a fixed start time, return it directly
  if (items[targetIndex]?.fixedStartTime) {
    return items[targetIndex].fixedStartTime!;
  }

  // Find the last fixed-time anchor before targetIndex
  let anchorIndex = -1;
  for (let i = targetIndex - 1; i >= 0; i--) {
    if (items[i]?.fixedStartTime) {
      anchorIndex = i;
      break;
    }
  }

  // Base time: last fixed anchor, or workshop start time
  const baseTime = anchorIndex >= 0 ? items[anchorIndex].fixedStartTime! : startTime;
  if (!baseTime) return null;

  const [hours, minutes] = baseTime.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes;

  // Accumulate durations from anchor (or index 0) up to targetIndex - 1
  const startFrom = anchorIndex >= 0 ? anchorIndex : 0;
  for (let i = startFrom; i < targetIndex; i++) {
    totalMinutes += items[i].duration;
  }

  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Effective total duration, including any buffers/gaps created by fixedStartTime anchors.
 * Computes the wall-clock span from startTime to the end of the last item.
 * Falls back to a simple sum when startTime is not set.
 */
export const calculateEffectiveDuration = (
  items: WorkshopItem[],
  startTime: string | null
): number => {
  if (items.length === 0) return 0;
  if (!startTime) return items.reduce((total, item) => total + item.duration, 0);

  const lastIndex = items.length - 1;
  const lastStartStr = calculateBlockTime(startTime, items, lastIndex);
  if (!lastStartStr) return items.reduce((total, item) => total + item.duration, 0);

  const [sh, sm] = startTime.split(':').map(Number);
  const [lh, lm] = lastStartStr.split(':').map(Number);
  return (lh * 60 + lm) - (sh * 60 + sm) + items[lastIndex].duration;
};
