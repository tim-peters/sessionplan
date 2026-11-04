/**
 * workshopStorage — Barrel re-export for all workshop persistence modules.
 *
 * Role: Backward-compatible entry point. Actual implementation is split into
 *       workshopUrl.ts, workshopLocalStorage.ts, and workshopServer.ts.
 */
// Re-export all sub-modules
export * from './workshopUrl';
export * from './workshopLocalStorage';
export * from './workshopServer';
export { calculateTotalDuration, calculateBlockTime, calculateEffectiveDuration } from './workshopUtils';

// ── Duration formatting (kept here — used by Timeline and WorkshopPlanner) ────

/** Formats a duration in minutes as a human-readable string. */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
};
