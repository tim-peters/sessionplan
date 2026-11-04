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
  /** Upper bound for postponing a PUT while the user keeps editing. */
  SERVER_PUT_MAX_WAIT: 5_000,
  SESSION_SAVE: 350,
  EDIT_DEBOUNCE: 1_000,
  FOCUS_FIXED_START: 150,
  /**
   * Trailing debounce applied after the last change of the session title
   * (title effects read document.title only in its final form).
   */
  TITLE_CHANGE: 2_000,
} as const;

/**
 * Minimum interval between two coalesced "Edited" signals for the same
 * entity/attribute pair. Continuous editing (e.g. typing in notes) fires the
 * useWorkshop-level 1s debounce repeatedly; this throttle coalesces those into
 * at most one signal per window (leading + trailing).
 */
export const EDIT_EVENT_THROTTLE_MS = 30_000;

// Delay before re-attempting a failed PUT (network/server error, not a
// conflict). The delay doubles per consecutive failure up to the maximum.
// Retries repeat until the PUT succeeds, a conflict occurs, or the session
// changes. The native beforeunload dialog handles the worst case.
export const SERVER_PUT_RETRY_MS = 5_000;
export const SERVER_PUT_RETRY_MAX_MS = 60_000;

export const RECENT_INDICATOR_MS = 10 * 60_000;
