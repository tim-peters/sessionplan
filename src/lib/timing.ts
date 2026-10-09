export const PLAY_MODE_TICK_MS = 5_000;

export const POLLING_INTERVALS = {
  ACTIVE: 8_000,
  COOLING: 30_000,
  IDLE: 60_000,
} as const;

export const POLLING_AGE_THRESHOLDS = {
  ACTIVE_MS: 60_000,
  COOLING_MS: 300_000,
} as const;

export const DEBOUNCE_TIMES = {
  HASH_WRITE: 500,
  SERVER_PUT: 1_000,
  TEMP_SAVE: 350,
  METADATA_TRACKING: 1_000,
  FOCUS_FIXED_START: 150,
  /**
   * Trailing debounce for the pageview event sent after the last change of
   * the session title (the pageview carries the new title via document title).
   */
  TITLE_PAGEVIEW: 2_000,
} as const;

/**
 * Minimum interval between two tracked "Edited" analytics events for the same
 * entity/attribute pair. Continuous editing (e.g. typing in notes) fires the
 * useWorkshop-level 1s debounce repeatedly; this throttle coalesces those into
 * at most one event per window (leading + trailing) so edit signals survive
 * without flooding event reporting.
 */
export const EDIT_TRACKING_THROTTLE_MS = 30_000;

// Delay before re-attempting a failed PUT (network/server error, not a
// conflict). Retries repeat until the PUT succeeds, a conflict occurs, or the
// session changes. The native beforeunload dialog handles the worst case.
export const SERVER_PUT_RETRY_MS = 5_000;

export const RECENT_INDICATOR_MS = 10 * 60_000;
export const SESSION_HISTORY_RETENTION_MS = 3 * 30 * 24 * 60 * 60_000;
