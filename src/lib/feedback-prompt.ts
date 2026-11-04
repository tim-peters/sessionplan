/**
 * feedback-prompt — Pure state machine for the optional in-app feedback prompt.
 *
 * Tracks edit activity, session lifecycle, dismissal cooldowns, monthly caps,
 * and the moment when the user takes a "valuable" action (print, export, copy
 * link) that justifies a small card asking for a quick rating.
 *
 * Storage layout (all in localStorage unless prefixed `sp:feedback-prompt-session`):
 *   - `sp:feedback-prompt:v1`            — long-lived state (versioned, reset on unknown v)
 *   - `sp:feedback-prompt-session:v1`     — per-tab session flags
 *
 * The state machine is intentionally side-effect free: all persistence is
 * handled by `loadState` / `saveState` (and the matching session helpers), so
 * the hook layer can pick the storage backend (real localStorage, in-memory
 * mock, or fully disabled when `FEEDBACK_API_URL` is null).
 *
 * "now" is injected into every function that depends on time, so the unit
 * tests can drive the state machine deterministically without fake timers.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** localStorage key for the long-lived state. */
export const LS_KEY = 'sp:feedback-prompt:v1';
/** sessionStorage key for per-tab state. */
export const SS_KEY = 'sp:feedback-prompt-session:v1';

/** Current state shape version. Bump to invalidate on incompatible changes. */
export const STATE_VERSION = 1;

/** Minimum edits before the prompt is allowed to appear. */
export const MIN_EDITS = 3;
/** Minimum number of blocks the user must have on the timeline. */
export const MIN_BLOCKS = 3;
/** Minimum time (ms) between the first edit and the first prompt. */
export const MATURITY_MS = 90_000;

/** Cooldown applied to automatic sources after each shown prompt. */
export const AUTOMATIC_REST_MS = 30 * 24 * 60 * 60 * 1000;
/** "Später" lock: 30 days and at least 2 sessions since dismissal. */
export const LATER_LOCK_MS = 30 * 24 * 60 * 60 * 1000;
export const LATER_SESSION_TARGET = 2;
/** "Jetzt nicht" (close) lock: 14 days and at least 1 session since dismissal. */
export const CLOSE_LOCK_MS = 14 * 24 * 60 * 60 * 1000;
export const CLOSE_SESSION_TARGET = 1;

/** After a successful send, the prompt is suppressed permanently. */

/** At most one automatic feedback prompt per calendar month (UTC YYYY-MM). */
export const MONTHLY_CAP = 1;

/** Card window: 15s after a valuable action, expires at 60s. */
export const CARD_WINDOW_START_MS = 15_000;
export const CARD_WINDOW_END_MS = 60_000;

/** 12s auto-dismiss countdown for the small card. */
export const CARD_AUTO_DISMISS_MS = 12_000;

/** 150ms confirm window for exit-intent mouseleave (pointer:fine only). */
export const EXIT_INTENT_CONFIRM_MS = 150;
export const EXIT_INTENT_VISIBLE_MS = 5_000;

/** Sources of the prompt. */
export type PromptSource = 'exit' | 'card' | 'menu';

/** Dismissal reasons. */
export type DismissKind = 'later' | 'close' | 'timeout' | 'menu-abandoned';

// ── State shape ──────────────────────────────────────────────────────────────

export interface MonthlyCount {
  /** Calendar month key `YYYY-MM` (UTC). */
  ym: string;
  /** Number of automatic prompts shown in that month. */
  count: number;
}

export interface ValuableAction {
  kind: 'print' | 'json-export' | 'csv-export' | 'link';
  at: number;
}

export interface FeedbackPromptState {
  v: typeof STATE_VERSION;
  editOperations: number;
  firstEditAt: number | null;
  /** Accumulated seconds the tab was visible. */
  activeSeconds: number;
  lastShownAt: number | null;
  lastSentAt: number | null;
  /** Hard lock until this timestamp (`hasLock` returns true while now < lockUntil). */
  lockUntil: number;
  lockReason: null | 'later' | 'close';
  lockSessionTarget: number;
  /** Incremented on the first edit of each new browser session. */
  sessionsSinceDismissal: number;
  monthly: MonthlyCount;
  lastValuableActionAt: ValuableAction | null;
}

export interface FeedbackSessionState {
  /** True once the user has dismissed (closed) the prompt in this tab. */
  dismissed: boolean;
  /** True once the first edit of this tab has been recorded. */
  counted: boolean;
}

// ── Storage I/O ──────────────────────────────────────────────────────────────

/** Fresh, empty state. The hook may override this with a custom `now`. */
export const createEmptyState = (now: number): FeedbackPromptState => ({
  v: STATE_VERSION,
  editOperations: 0,
  firstEditAt: null,
  activeSeconds: 0,
  lastShownAt: null,
  lastSentAt: null,
  lockUntil: 0,
  lockReason: null,
  lockSessionTarget: 0,
  sessionsSinceDismissal: 0,
  monthly: { ym: monthKey(now), count: 0 },
  lastValuableActionAt: null,
});

/** Default per-tab session flags. */
export const createEmptySession = (): FeedbackSessionState => ({
  dismissed: false,
  counted: false,
});

/** Defensive parse: returns the empty state on any error or unknown version. */
export const parseState = (raw: string | null, now: number): FeedbackPromptState => {
  if (!raw) return createEmptyState(now);
  try {
    const obj = JSON.parse(raw) as Partial<FeedbackPromptState> | null;
    if (!obj || typeof obj !== 'object') return createEmptyState(now);
    if (obj.v !== STATE_VERSION) return createEmptyState(now);
    // Merge with empty defaults so missing fields (older snapshots) get
    // safe fallbacks instead of undefined.
    return { ...createEmptyState(now), ...obj } as FeedbackPromptState;
  } catch {
    return createEmptyState(now);
  }
};

export const parseSession = (raw: string | null): FeedbackSessionState => {
  if (!raw) return createEmptySession();
  try {
    const obj = JSON.parse(raw) as Partial<FeedbackSessionState> | null;
    if (!obj || typeof obj !== 'object') return createEmptySession();
    return { ...createEmptySession(), ...obj } as FeedbackSessionState;
  } catch {
    return createEmptySession();
  }
};

/** Lightweight storage reader/writer interface — keeps the module test-friendly. */
export interface FeedbackStorage {
  loadState(now: number): FeedbackPromptState;
  saveState(state: FeedbackPromptState): void;
  loadSession(): FeedbackSessionState;
  saveSession(session: FeedbackSessionState): void;
}

/** UTC `YYYY-MM` key for the monthly cap. */
export const monthKey = (ts: number): string => {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/** Build the default localStorage-backed implementation. */
export const createLocalStorageFeedbackStorage = (): FeedbackStorage => ({
  loadState: (now) => parseState(typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null, now),
  saveState: (state) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore quota / privacy-mode failures
    }
  },
  loadSession: () => parseSession(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SS_KEY) : null),
  saveSession: (session) => {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  },
});

// ── Eligibility helpers ──────────────────────────────────────────────────────

/** True when the long-lived state is mature enough to consider prompting. */
export const isMature = (state: FeedbackPromptState, blockCount: number, now: number): boolean => {
  if (state.editOperations < MIN_EDITS) return false;
  if (blockCount < MIN_BLOCKS) return false;
  if (state.firstEditAt === null) return false;
  return now - state.firstEditAt >= MATURITY_MS;
};

/** Hard-lock check (later / close / monthly cap / 30d rest). */
export const hasLock = (state: FeedbackPromptState, session: FeedbackSessionState, now: number): boolean => {
  // Permanent suppression once we have an answer.
  if (state.lastSentAt !== null) return true;

  // 30d rest since the last shown prompt (any source), independent of lockUntil.
  if (state.lastShownAt !== null && now - state.lastShownAt < AUTOMATIC_REST_MS) return true;

  // Active lock window.
  if (state.lockReason !== null && now < state.lockUntil) return true;

  // Session target not yet hit (counts of sessions since dismissal).
  if (state.lockReason !== null && state.sessionsSinceDismissal < state.lockSessionTarget) return true;

  // Already dismissed in this tab.
  if (session.dismissed) return true;

  // Monthly cap for automatic sources (the menu is exempt — see tryShow).
  if (state.monthly.count >= MONTHLY_CAP) return true;

  return false;
};

/** Card window: 15s..60s after a valuable action. */
export const isCardEligible = (state: FeedbackPromptState, now: number): boolean => {
  if (!state.lastValuableActionAt) return false;
  const elapsed = now - state.lastValuableActionAt.at;
  return elapsed >= CARD_WINDOW_START_MS && elapsed < CARD_WINDOW_END_MS;
};

// ── Mutations ────────────────────────────────────────────────────────────────

/** Record a successful edit; also increments the session counter on first edit. */
export const recordEditOperation = (
  state: FeedbackPromptState,
  session: FeedbackSessionState,
  now: number,
): { state: FeedbackPromptState; session: FeedbackSessionState } => {
  const nextState: FeedbackPromptState = {
    ...state,
    editOperations: state.editOperations + 1,
    firstEditAt: state.firstEditAt ?? now,
  };

  // First edit of this tab → bump session count (used for the lock session target).
  if (!session.counted) {
    nextState.sessionsSinceDismissal = state.sessionsSinceDismissal + 1;
    return {
      state: nextState,
      session: { ...session, counted: true },
    };
  }

  return { state: nextState, session };
};

/** Add 1 active second to the visibility counter (clamped at 0). */
export const countActiveSecond = (state: FeedbackPromptState): FeedbackPromptState => ({
  ...state,
  activeSeconds: Math.max(0, state.activeSeconds + 1),
});

/** Record a valuable action: print, JSON export, link copy. */
export const markValuableAction = (
  state: FeedbackPromptState,
  kind: ValuableAction['kind'],
  now: number,
): FeedbackPromptState => ({
  ...state,
  lastValuableActionAt: { kind, at: now },
});

/** Mark the prompt as shown, optionally incrementing the monthly counter. */
export const tryShow = (
  state: FeedbackPromptState,
  source: PromptSource,
  now: number,
): { allowed: true; nextState: FeedbackPromptState } | { allowed: false } => {
  // The menu path is the operator/user-initiated "always available" surface:
  // it bypasses the automatic-frequency rules entirely (lastSentAt, 30-day
  // rest, monthly cap). Multiple menu submissions are bounded server-side by
  // the per-IP rate limit (3/h + 20/day), which is the intended guard.
  if (source === 'menu') {
    const ymNow = monthKey(now);
    const monthlyNow = state.monthly.ym === ymNow ? state.monthly : { ym: ymNow, count: 0 };
    return {
      allowed: true,
      // Recording the show still restarts the 30-day automatic rest, but the
      // monthly counter is NOT consumed by menu usage.
      nextState: { ...state, lastShownAt: now, monthly: monthlyNow },
    };
  }
  // Automatic surfaces: lastSentAt suppresidence + 30-day rest + monthly cap.
  // The caller already verified hasLock + maturity; re-assert here so a
  // missed caller check cannot regress state.
  if (state.lastSentAt !== null) return { allowed: false };
  if (state.lastShownAt !== null && now - state.lastShownAt < AUTOMATIC_REST_MS) return { allowed: false };

  const ym = monthKey(now);
  const monthly = state.monthly.ym === ym ? state.monthly : { ym, count: 0 };

  if (monthly.count >= MONTHLY_CAP) return { allowed: false };

  const nextState: FeedbackPromptState = {
    ...state,
    lastShownAt: now,
    monthly: { ...monthly, count: monthly.count + 1 },
  };
  return { allowed: true, nextState };
};

/** Mark a successful send → permanent suppression. */
export const recordSend = (
  state: FeedbackPromptState,
  _now: number,
): FeedbackPromptState => ({
  ...state,
  lastSentAt: _now,
  lastValuableActionAt: null,
  // Don't clear lockUntil — a user who was in a lock and somehow sent
  // (e.g. via menu) should still not see a second automatic prompt.
});

/** Mark a dismissal; `later` and `close` set a hard lock. */
export const recordDismiss = (
  state: FeedbackPromptState,
  session: FeedbackSessionState,
  kind: DismissKind,
  now: number,
): { state: FeedbackPromptState; session: FeedbackSessionState } => {
  switch (kind) {
    case 'later':
      return {
        state: {
          ...state,
          lockReason: 'later',
          lockUntil: now + LATER_LOCK_MS,
          lockSessionTarget: LATER_SESSION_TARGET,
          sessionsSinceDismissal: 0,
        },
        session: { ...session, dismissed: true },
      };
    case 'close':
    case 'menu-abandoned':
      return {
        state: {
          ...state,
          lockReason: 'close',
          lockUntil: now + CLOSE_LOCK_MS,
          lockSessionTarget: CLOSE_SESSION_TARGET,
          sessionsSinceDismissal: 0,
        },
        session: { ...session, dismissed: true },
      };
    case 'timeout':
      // Auto-dismiss counts as a soft "no" for this session only; no lock.
      return {
        state,
        session: { ...session, dismissed: true },
      };
    default:
      return { state, session };
  }
};

// ── Exit-intent helper (pure, unit-testable) ────────────────────────────────

export interface ExitIntentInput {
  /** relatedTarget of the mouseleave event (null = left at the top edge). */
  relatedTarget: EventTarget | null;
  /** clientY of the mouseleave event. */
  clientY: number;
  /** Result of window.matchMedia('(pointer: fine)').matches. */
  pointerFine: boolean;
  /** Timestamp the most recent mouseleave was armed. */
  armedAt: number;
  /** Current time (injected). */
  now: number;
  /** Seconds the tab has been visible since the prompt was last considered. */
  visibleSeconds: number;
}

export interface ExitIntentDecision {
  shouldTrigger: boolean;
  /** True if the caller should arm a confirmation timer. */
  armConfirm: boolean;
}

const EXIT_INTENT_TOP_PX = 24;

/**
 * Decides whether the current mouseleave event represents an exit-intent.
 *
 * - Fires only for fine pointers (mouse) and only when leaving through the
 *   top edge of the viewport (cursor crosses y < 24).
 * - The caller passes the `armedAt` of the most recent mouseleave; we
 *   require a 150ms quiet window before re-arming to avoid jitter.
 * - Requires the tab to have been visible for at least 5s so the user has
 *   actually used the planner.
 */
export const shouldTriggerExitIntent = (input: ExitIntentInput): ExitIntentDecision => {
  if (!input.pointerFine) return { shouldTrigger: false, armConfirm: false };
  if (input.clientY > EXIT_INTENT_TOP_PX) return { shouldTrigger: false, armConfirm: false };
  if (input.visibleSeconds < EXIT_INTENT_VISIBLE_MS / 1000) {
    return { shouldTrigger: false, armConfirm: true };
  }
  // Quiet window: only re-arm if at least 150ms has passed since the
  // previous arm attempt. A jitter-free browser only fires this once but
  // the guard keeps us safe against event bursts.
  if (input.now - input.armedAt < EXIT_INTENT_CONFIRM_MS) {
    return { shouldTrigger: false, armConfirm: false };
  }
  return { shouldTrigger: true, armConfirm: true };
};
