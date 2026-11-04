import { describe, it, expect } from 'vitest';
import {
  AUTOMATIC_REST_MS,
  CARD_AUTO_DISMISS_MS,
  CARD_WINDOW_END_MS,
  CARD_WINDOW_START_MS,
  CLOSE_LOCK_MS,
  CLOSE_SESSION_TARGET,
  EXIT_INTENT_CONFIRM_MS,
  EXIT_INTENT_VISIBLE_MS,
  LATER_LOCK_MS,
  LATER_SESSION_TARGET,
  MATURITY_MS,
  MIN_BLOCKS,
  MIN_EDITS,
  MONTHLY_CAP,
  createEmptySession,
  createEmptyState,
  hasLock,
  isCardEligible,
  isMature,
  markValuableAction,
  monthKey,
  parseSession,
  parseState,
  countActiveSecond,
  recordDismiss,
  recordEditOperation,
  recordSend,
  shouldTriggerExitIntent,
  tryShow,
} from '@/lib/feedback-prompt';

// ── Date helpers ─────────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const JUL_2026 = Date.UTC(2026, 6, 1, 12, 0, 0); // July 1, 2026, 12:00 UTC

const at = (offsetMs: number): number => JUL_2026 + offsetMs;

// ── monthKey ─────────────────────────────────────────────────────────────────

describe('monthKey', () => {
  it('formats a UTC YYYY-MM string with zero-padded month', () => {
    expect(monthKey(Date.UTC(2026, 0, 5, 0, 0, 0))).toBe('2026-01');
    expect(monthKey(Date.UTC(2026, 6, 31, 23, 59, 59))).toBe('2026-07');
    expect(monthKey(Date.UTC(2026, 11, 1, 0, 0, 0))).toBe('2026-12');
  });
});

// ── Storage parse resilience ─────────────────────────────────────────────────

describe('parseState', () => {
  it('returns empty state on null', () => {
    const s = parseState(null, JUL_2026);
    expect(s).toEqual(createEmptyState(JUL_2026));
  });

  it('returns empty state on unknown version (defensive reset)', () => {
    const s = parseState(JSON.stringify({ ...createEmptyState(JUL_2026), v: 99 }), JUL_2026);
    expect(s).toEqual(createEmptyState(JUL_2026));
  });

  it('returns empty state on invalid JSON', () => {
    const s = parseState('not-json', JUL_2026);
    expect(s).toEqual(createEmptyState(JUL_2026));
  });

  it('merges partial snapshots with empty defaults (forward compat)', () => {
    const s = parseState(JSON.stringify({ v: 1, editOperations: 4 }), JUL_2026);
    expect(s.editOperations).toBe(4);
    expect(s.lockReason).toBeNull();
    expect(s.monthly.ym).toBe(monthKey(JUL_2026));
  });
});

describe('parseSession', () => {
  it('returns empty session on invalid JSON', () => {
    expect(parseSession('not-json')).toEqual(createEmptySession());
  });
});

// ── Maturity gate ────────────────────────────────────────────────────────────

describe('isMature', () => {
  it('rejects users with fewer than MIN_EDITS edits', () => {
    const state = { ...createEmptyState(JUL_2026), editOperations: MIN_EDITS - 1, firstEditAt: JUL_2026 };
    expect(isMature(state, MIN_BLOCKS, at(MATURITY_MS))).toBe(false);
  });

  it('rejects users with fewer than MIN_BLOCKS blocks', () => {
    const state = { ...createEmptyState(JUL_2026), editOperations: MIN_EDITS, firstEditAt: JUL_2026 };
    expect(isMature(state, MIN_BLOCKS - 1, at(MATURITY_MS))).toBe(false);
  });

  it('rejects users who have not been around for MATURITY_MS yet', () => {
    const state = { ...createEmptyState(JUL_2026), editOperations: MIN_EDITS, firstEditAt: JUL_2026 };
    expect(isMature(state, MIN_BLOCKS, at(MATURITY_MS - 1))).toBe(false);
  });

  it('accepts the boundary exactly at MATURITY_MS', () => {
    const state = { ...createEmptyState(JUL_2026), editOperations: MIN_EDITS, firstEditAt: JUL_2026 };
    expect(isMature(state, MIN_BLOCKS, at(MATURITY_MS))).toBe(true);
  });

  it('requires firstEditAt to be set (not just editOperations)', () => {
    // editOperations=MIN_EDITS but firstEditAt still null → not mature.
    const state = { ...createEmptyState(JUL_2026), editOperations: MIN_EDITS };
    expect(isMature(state, MIN_BLOCKS, at(MATURITY_MS))).toBe(false);
  });

  it('combines edits + blocks + time independently', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      editOperations: MIN_EDITS + 5,
      firstEditAt: JUL_2026,
    };
    expect(isMature(state, MIN_BLOCKS + 2, at(MATURITY_MS + 1))).toBe(true);
  });
});

// ── Lock gate ────────────────────────────────────────────────────────────────

describe('hasLock', () => {
  it('locks permanently after a successful send', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      lastSentAt: JUL_2026 - DAY,
      editOperations: MIN_EDITS + 1,
    };
    const sess = createEmptySession();
    // Even long after, a sent user stays locked.
    expect(hasLock(state, sess, at(40 * DAY))).toBe(true);
  });

  it('locks automatic sources for 30 days after the last show', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      lastShownAt: JUL_2026,
      editOperations: MIN_EDITS + 1,
    };
    const sess = createEmptySession();
    expect(hasLock(state, sess, at(AUTOMATIC_REST_MS - 1))).toBe(true);
    // Just past the 30-day boundary the lock releases.
    expect(hasLock(state, sess, at(AUTOMATIC_REST_MS))).toBe(false);
  });

  it('locks while inside the `later` lock window AND session target not met', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      lockReason: 'later' as const,
      lockUntil: JUL_2026 + LATER_LOCK_MS,
      lockSessionTarget: LATER_SESSION_TARGET,
      sessionsSinceDismissal: 0,
      editOperations: MIN_EDITS + 1,
    };
    const sess = createEmptySession();
    expect(hasLock(state, sess, at(LATER_LOCK_MS - 1))).toBe(true);
  });

  it('keeps the `later` lock active even past lockUntil when sessions < target', () => {
    // The lock has two AND'd gates (time window AND session target). Either
    // alone being unmet keeps the user locked.
    const state = {
      ...createEmptyState(JUL_2026),
      lockReason: 'later' as const,
      lockUntil: JUL_2026 + LATER_LOCK_MS,
      lockSessionTarget: LATER_SESSION_TARGET,
      sessionsSinceDismissal: LATER_SESSION_TARGET - 1,
    };
    const sess = createEmptySession();
    expect(hasLock(state, sess, at(LATER_LOCK_MS + 1))).toBe(true);
  });

  it('releases the `later` lock once both 30 days AND 2 sessions have passed', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      lockReason: 'later' as const,
      lockUntil: JUL_2026 + LATER_LOCK_MS,
      lockSessionTarget: LATER_SESSION_TARGET,
      sessionsSinceDismissal: LATER_SESSION_TARGET,
    };
    const sess = createEmptySession();
    expect(hasLock(state, sess, at(LATER_LOCK_MS + 1))).toBe(false);
  });

  it('keeps the `close` lock active for 14 days + 1 session target', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      lockReason: 'close' as const,
      lockUntil: JUL_2026 + CLOSE_LOCK_MS,
      lockSessionTarget: CLOSE_SESSION_TARGET,
      sessionsSinceDismissal: 0,
    };
    const sess = createEmptySession();
    expect(hasLock(state, sess, at(CLOSE_LOCK_MS - 1))).toBe(true);
    // Still 1 session short → lock holds even past the 14-day gate.
    expect(hasLock(state, sess, at(CLOSE_LOCK_MS + 1))).toBe(true);
    // Once the session target is met AND time has passed, the lock releases.
    const unlocked = { ...state, sessionsSinceDismissal: CLOSE_SESSION_TARGET };
    expect(hasLock(unlocked, sess, at(CLOSE_LOCK_MS + 1))).toBe(false);
  });

  it('locks for the remainder of the tab once session.dismissed is true', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      editOperations: MIN_EDITS + 1,
    };
    const sess = { ...createEmptySession(), dismissed: true };
    expect(hasLock(state, sess, JUL_2026)).toBe(true);
  });

  it('locks automatic sources when the monthly cap is reached (menu still bypasses)', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      monthly: { ym: monthKey(JUL_2026), count: MONTHLY_CAP },
      editOperations: MIN_EDITS + 1,
    };
    const sess = createEmptySession();
    expect(hasLock(state, sess, JUL_2026)).toBe(true);
  });

  it('does not lock when no rules apply', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      editOperations: MIN_EDITS + 1,
    };
    const sess = createEmptySession();
    expect(hasLock(state, sess, JUL_2026)).toBe(false);
  });
});

// ── Card eligibility window ──────────────────────────────────────────────────

describe('isCardEligible', () => {
  it('rejects when no valuable action has been recorded', () => {
    expect(isCardEligible(createEmptyState(JUL_2026), JUL_2026)).toBe(false);
  });

  it('rejects before the 15s warm-up window opens', () => {
    const state = markValuableAction(createEmptyState(JUL_2026), 'print', JUL_2026);
    expect(isCardEligible(state, at(CARD_WINDOW_START_MS - 1))).toBe(false);
  });

  it('accepts inside the window (15s .. 60s)', () => {
    const state = markValuableAction(createEmptyState(JUL_2026), 'print', JUL_2026);
    expect(isCardEligible(state, at(CARD_WINDOW_START_MS))).toBe(true);
    expect(isCardEligible(state, at((CARD_WINDOW_START_MS + CARD_WINDOW_END_MS) / 2))).toBe(true);
    expect(isCardEligible(state, at(CARD_WINDOW_END_MS - 1))).toBe(true);
  });

  it('rejects at and past the 60s cap', () => {
    const state = markValuableAction(createEmptyState(JUL_2026), 'print', JUL_2026);
    expect(isCardEligible(state, at(CARD_WINDOW_END_MS))).toBe(false);
    expect(isCardEligible(state, at(CARD_WINDOW_END_MS + 30_000))).toBe(false);
  });
});

// ── tryShow ──────────────────────────────────────────────────────────────────

describe('tryShow', () => {
  it('blocks automatic sources after one show in the same month', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      monthly: { ym: monthKey(JUL_2026), count: MONTHLY_CAP },
    };
    expect(tryShow(state, 'card', JUL_2026).allowed).toBe(false);
    expect(tryShow(state, 'exit', JUL_2026).allowed).toBe(false);
  });

  it('menu bypasses the monthly cap (per plan)', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      monthly: { ym: monthKey(JUL_2026), count: MONTHLY_CAP },
    };
    const result = tryShow(state, 'menu', JUL_2026);
    expect(result.allowed).toBe(true);
    // The cap stays at MONTHLY_CAP (menu does not increment it).
    if (result.allowed) {
      expect(result.nextState.monthly.count).toBe(MONTHLY_CAP);
    }
  });

  it('increments the monthly counter for automatic sources but not menu', () => {
    const initial = createEmptyState(JUL_2026);
    const cardResult = tryShow(initial, 'card', JUL_2026);
    expect(cardResult.allowed).toBe(true);
    if (cardResult.allowed) {
      expect(cardResult.nextState.monthly.count).toBe(1);
    }
    const menuResult = tryShow(initial, 'menu', JUL_2026);
    expect(menuResult.allowed).toBe(true);
    if (menuResult.allowed) {
      expect(menuResult.nextState.monthly.count).toBe(0);
    }
  });

  it('menu bypasses permanent lastSentAt suppression; automatic surfaces refuse', () => {
    const state = { ...createEmptyState(JUL_2026), lastSentAt: JUL_2026 - DAY };
    // 'menu' is the always-available operator surface — repeated opens are
    // bounded by the server-side per-IP rate limit, not by these locks.
    expect(tryShow(state, 'menu', JUL_2026).allowed).toBe(true);
    expect(tryShow(state, 'exit', JUL_2026).allowed).toBe(false);
    expect(tryShow(state, 'card', JUL_2026).allowed).toBe(false);
  });

  it('refuses if still within the 30-day automatic rest window', () => {
    const state = { ...createEmptyState(JUL_2026), lastShownAt: JUL_2026 };
    expect(tryShow(state, 'card', at(AUTOMATIC_REST_MS - 1)).allowed).toBe(false);
    expect(tryShow(state, 'exit', at(AUTOMATIC_REST_MS - 1)).allowed).toBe(false);
    // Menu survives — it bypasses every frequency rule by design.
    expect(tryShow(state, 'menu', at(AUTOMATIC_REST_MS - 1)).allowed).toBe(true);
  });

  it('rolls the monthly counter into the new month automatically', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      monthly: { ym: '2026-06', count: MONTHLY_CAP },
    };
    // Same tab, but "now" has rolled into July → fresh monthly budget.
    const result = tryShow(state, 'card', JUL_2026);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.nextState.monthly.ym).toBe(monthKey(JUL_2026));
      expect(result.nextState.monthly.count).toBe(1);
    }
  });
});

// ── recordDismiss semantics ──────────────────────────────────────────────────

describe('recordDismiss', () => {
  it('`later` sets a 30-day lock and 2-session target, marks session dismissed', () => {
    const out = recordDismiss(createEmptyState(JUL_2026), createEmptySession(), 'later', JUL_2026);
    expect(out.state.lockReason).toBe('later');
    expect(out.state.lockUntil - JUL_2026).toBe(LATER_LOCK_MS);
    expect(out.state.lockSessionTarget).toBe(LATER_SESSION_TARGET);
    expect(out.state.sessionsSinceDismissal).toBe(0);
    expect(out.session.dismissed).toBe(true);
  });

  it('`close` (Jetzt nicht) sets a 14-day lock and 1-session target', () => {
    const out = recordDismiss(createEmptyState(JUL_2026), createEmptySession(), 'close', JUL_2026);
    expect(out.state.lockReason).toBe('close');
    expect(out.state.lockUntil - JUL_2026).toBe(CLOSE_LOCK_MS);
    expect(out.state.lockSessionTarget).toBe(CLOSE_SESSION_TARGET);
    expect(out.session.dismissed).toBe(true);
  });

  it('`menu-abandoned` (Esc / overlay close before any user action) counts as close', () => {
    const out = recordDismiss(createEmptyState(JUL_2026), createEmptySession(), 'menu-abandoned', JUL_2026);
    expect(out.state.lockReason).toBe('close');
    expect(out.state.lockUntil - JUL_2026).toBe(CLOSE_LOCK_MS);
    expect(out.session.dismissed).toBe(true);
  });

  it('`timeout` (auto-dismissed card) is NOT counted as a rejection: no hard lock, but tab still suppressed', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      editOperations: MIN_EDITS + 1,
    };
    const sess = createEmptySession();
    const out = recordDismiss(state, sess, 'timeout', JUL_2026);
    expect(out.state.lockReason).toBeNull();
    expect(out.state.lockUntil).toBe(state.lockUntil);
    // Session.dismissed is set so the per-tab lock still bites this session.
    expect(out.session.dismissed).toBe(true);
    // Next tab should NOT see the lock block (the timeout is a soft "later").
    const nextTab = createEmptySession();
    expect(hasLock(out.state, nextTab, JUL_2026)).toBe(false);
  });
});

// ── Edit accounting ──────────────────────────────────────────────────────────

describe('recordEditOperation', () => {
  it('increments editOperations monotonically and sets firstEditAt on the first call', () => {
    const { state, session } = recordEditOperation(createEmptyState(JUL_2026), createEmptySession(), JUL_2026);
    expect(state.editOperations).toBe(1);
    expect(state.firstEditAt).toBe(JUL_2026);
    expect(session.counted).toBe(true);
  });

  it('does not move firstEditAt on subsequent edits', () => {
    const first = recordEditOperation(createEmptyState(JUL_2026), createEmptySession(), JUL_2026);
    const second = recordEditOperation(first.state, first.session, JUL_2026 + 1000);
    expect(second.state.firstEditAt).toBe(JUL_2026);
    expect(second.state.editOperations).toBe(2);
  });

  it('bumps sessionsSinceDismissal only on the first edit of each tab', () => {
    const first = recordEditOperation(createEmptyState(JUL_2026), createEmptySession(), JUL_2026);
    expect(first.state.sessionsSinceDismissal).toBe(1);
    const second = recordEditOperation(first.state, first.session, JUL_2026 + 1000);
    expect(second.state.sessionsSinceDismissal).toBe(1);
  });
});

// ── recordSend ───────────────────────────────────────────────────────────────

describe('recordSend', () => {
  it('sets lastSentAt and clears lastValuableActionAt (permanent suppression)', () => {
    const armed = markValuableAction(createEmptyState(JUL_2026), 'print', JUL_2026);
    const sent = recordSend(armed, JUL_2026);
    expect(sent.lastSentAt).toBe(JUL_2026);
    expect(sent.lastValuableActionAt).toBeNull();
  });

  it('preserves any existing lockUntil on send (no follow-up auto prompt)', () => {
    const state = {
      ...createEmptyState(JUL_2026),
      lockReason: 'later' as const,
      lockUntil: JUL_2026 + LATER_LOCK_MS,
    };
    const sent = recordSend(state, JUL_2026);
    expect(sent.lockUntil).toBe(state.lockUntil);
  });
});

// ── countActiveSecond ────────────────────────────────────────────────────────

describe('countActiveSecond', () => {
  it('adds one second per call (clamped at 0)', () => {
    const a = countActiveSecond(createEmptyState(JUL_2026));
    const b = countActiveSecond(a);
    const c = countActiveSecond(b);
    expect([a.activeSeconds, b.activeSeconds, c.activeSeconds]).toEqual([1, 2, 3]);
  });

  it('never goes below zero even from negative inputs', () => {
    const weird = { ...createEmptyState(JUL_2026), activeSeconds: -5 };
    expect(countActiveSecond(weird).activeSeconds).toBe(0);
  });
});

// ── shouldTriggerExitIntent ──────────────────────────────────────────────────

describe('shouldTriggerExitIntent', () => {
  const baseInput = {
    relatedTarget: null,
    clientY: 5,
    pointerFine: true,
    armedAt: 0,
    now: 10_000,
    visibleSeconds: 30,
  };

  it('returns false on non-fine pointers (touch / pen)', () => {
    expect(shouldTriggerExitIntent({ ...baseInput, pointerFine: false })).toEqual({
      shouldTrigger: false,
      armConfirm: false,
    });
  });

  it('returns false when crossing below the top-edge threshold (clientY > 24px)', () => {
    const decision = shouldTriggerExitIntent({ ...baseInput, clientY: 100 });
    expect(decision).toEqual({ shouldTrigger: false, armConfirm: false });
  });

  it('arms a quiet-window timer when below the visible-time floor, but does not fire', () => {
    const decision = shouldTriggerExitIntent({
      ...baseInput,
      visibleSeconds: EXIT_INTENT_VISIBLE_MS / 1000 - 1,
      now: EXIT_INTENT_CONFIRM_MS + 1,
    });
    expect(decision).toEqual({ shouldTrigger: false, armConfirm: true });
  });

  it('fires when all conditions are met and the 150ms quiet window has elapsed', () => {
    const decision = shouldTriggerExitIntent({
      ...baseInput,
      armedAt: baseInput.now - EXIT_INTENT_CONFIRM_MS - 1,
    });
    expect(decision).toEqual({ shouldTrigger: true, armConfirm: true });
  });

  it('cancels inside the 150ms quiet window even when everything else matches', () => {
    const decision = shouldTriggerExitIntent({
      ...baseInput,
      armedAt: baseInput.now - 10, // only 10ms since last arm
    });
    expect(decision.shouldTrigger).toBe(false);
    expect(decision.armConfirm).toBe(false);
  });

  it('exact boundary on the 150ms confirm window counts as expired', () => {
    const decision = shouldTriggerExitIntent({
      ...baseInput,
      armedAt: baseInput.now - EXIT_INTENT_CONFIRM_MS,
    });
    expect(decision.shouldTrigger).toBe(true);
  });
});

// ── Constants sanity ─────────────────────────────────────────────────────────

describe('module constants', () => {
  it('exposes the documented thresholds', () => {
    expect(MIN_EDITS).toBe(3);
    expect(MIN_BLOCKS).toBe(3);
    expect(MATURITY_MS).toBe(90_000);
    expect(LATER_LOCK_MS).toBe(30 * DAY);
    expect(LATER_SESSION_TARGET).toBe(2);
    expect(CLOSE_LOCK_MS).toBe(14 * DAY);
    expect(CLOSE_SESSION_TARGET).toBe(1);
    expect(MONTHLY_CAP).toBe(1);
    expect(CARD_WINDOW_START_MS).toBe(15_000);
    expect(CARD_WINDOW_END_MS).toBe(60_000);
    expect(CARD_AUTO_DISMISS_MS).toBe(12_000);
    expect(EXIT_INTENT_CONFIRM_MS).toBe(150);
    expect(EXIT_INTENT_VISIBLE_MS).toBe(5_000);
  });
});
