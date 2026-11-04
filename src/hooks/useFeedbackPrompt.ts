/**
 * useFeedbackPrompt — Orchestrates the optional in-app feedback prompt.
 *
 * Listens to user activity (visibility, exit intent, dialog/drag blockers)
 * and the supplied workshop context, then exposes a small render-state and
 * a set of callbacks for the FeedbackPromptLayer to render and react.
 *
 * The state machine itself lives in `@/lib/feedback-prompt` so the logic
 * stays testable; this hook only wires storage, listeners, and derived
 * visibility.
 *
 * Returns `{ state, controls }` so the layer can render either a card
 * (bottom-right) or a full dialog (centered) and dispatch the right
 * dismissal/send events.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isPrerendering } from '@/lib/prerender';
import {
  createLocalStorageFeedbackStorage,
  CARD_AUTO_DISMISS_MS,
  hasLock,
  isCardEligible,
  isMature,
  markValuableAction,
  monthKey,
  recordDismiss,
  recordEditOperation,
  recordSend,
  shouldTriggerExitIntent,
  tryShow,
  type FeedbackPromptState,
  type FeedbackSessionState,
  type PromptSource,
} from '@/lib/feedback-prompt';
import { FEEDBACK_API_URL, submitFeedback } from '@/lib/feedback-api';
import { getAllItems } from '@/lib/workshop-days';
import type { WorkshopData } from '@/types/workshop';

export type FeedbackVariant = 'hidden' | 'card' | 'dialog';

export interface UseFeedbackPromptParams {
  workshop: WorkshopData;
  playModeActive: boolean;
  shareDialogOpen: boolean;
  sharePopoverOpen: boolean;
}

export interface FeedbackPromptControls {
  /** Programmatically open the dialog (e.g. from the menu). */
  openFromMenu: () => void;
  /**
   * Promote the currently-visible card to the full dialog. The card already
   * consumed its monthly slot via `tryShow`, so this just flips the variant
   * and records the source so the eventual submit is tagged `card`.
   */
  openDialogFromCard: () => void;
  /** Layer callback: user submitted a rating (+ optional text/email). */
  onSubmit: (rating: number, text: string, website: string, email?: string) => Promise<void>;
  /** Layer callback: user dismissed the prompt. */
  onDismiss: (kind: 'later' | 'close' | 'timeout') => void;
  /** Layer callback: dialog was closed without an explicit choice. */
  onMenuAbandoned: () => void;
  /**
   * Layer callback: hide the dialog after a successful send. We do NOT
   * record a dismissal here — the success path already records `lastSentAt`
   * for permanent suppression.
   */
  closeAfterSent: () => void;
}

export interface UseFeedbackPromptResult {
  /** Current variant. The layer renders nothing when `hidden`. */
  state: FeedbackVariant;
  /** Active auto-dismiss countdown for the card (ms remaining). */
  cardCountdownMs: number;
  controls: FeedbackPromptControls;
}

// Lightweight storage shim — defaults to real localStorage; tests can
// inject a different implementation via the `storage` global below.
type StorageFactory = () => {
  loadState: (now: number) => FeedbackPromptState;
  saveState: (state: FeedbackPromptState) => void;
  loadSession: () => FeedbackSessionState;
  saveSession: (session: FeedbackSessionState) => void;
};

let storageOverride: StorageFactory | null = null;

/** Test-only injection point. Not part of the production API. */
export const __setFeedbackStorageForTests = (factory: StorageFactory | null): void => {
  storageOverride = factory;
};

/**
 * Inert result for builds without FEEDBACK_API_URL. The hook must call the
 * same hooks in the same order on every render, so we cannot return early;
 * instead the unwired build short-circuits every effect / listener inside
 * `useFeedbackPromptActive` and returns this object verbatim. All callbacks
 * are no-ops, so callers (e.g. the SettingsPanel "Feedback geben" entry)
 * can wire `onOpenFeedback` defensively without checking the build mode.
 */
const INERT_RESULT: UseFeedbackPromptResult = Object.freeze({
  state: 'hidden' as FeedbackVariant,
  cardCountdownMs: 0,
  controls: Object.freeze({
    openFromMenu: () => undefined,
    openDialogFromCard: () => undefined,
    onSubmit: async () => undefined,
    onDismiss: () => undefined,
    onMenuAbandoned: () => undefined,
    closeAfterSent: () => undefined,
  }),
});

const defaultStorage = (): ReturnType<StorageFactory> => createLocalStorageFeedbackStorage();

const isBlocker = (params: UseFeedbackPromptParams): boolean => {
  if (params.playModeActive) return true;
  if (params.shareDialogOpen) return true;
  if (params.sharePopoverOpen) return true;
  if (typeof document !== 'undefined') {
    if (document.querySelector('[role="dialog"][data-state="open"]')) return true;
    if (document.querySelector('[aria-modal="true"][data-state="open"]')) return true;
    if (document.activeElement && (document.activeElement as HTMLElement).isContentEditable) return true;
  }
  return false;
};

const pointerFine = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: fine)').matches;
  } catch {
    return false;
  }
};

export const useFeedbackPrompt = (params: UseFeedbackPromptParams | null): UseFeedbackPromptResult => {
  // The active implementation must run on every render so all hook calls
  // stay in the same order across renders — React forbids hooks behind a
  // conditional / early return. When the endpoint is absent we still invoke
  // the same hooks but short-circuit every effect / listener so the hook is
  // functionally inert (no timers, no DOM listeners, no state updates).
  const active = useFeedbackPromptActive(params);

  // FEEDBACK_API_URL not configured → stay inert. Saves the listener overhead
  // and keeps the bundle analytics-free for self-hosted environments that
  // never wire the endpoint. Returning an inert shape with no listeners keeps
  // the public-API contract identical for both wired and unwired builds.
  if (!FEEDBACK_API_URL) {
    return INERT_RESULT;
  }
  return active;
};

// The "active" implementation. Split out so the active-hook code can run on
// every render in the same hook order regardless of whether FEEDBACK_API_URL
// is configured. When the endpoint is absent we gate every effect / listener
// behind the `enabled` flag so the hook is functionally inert.
const useFeedbackPromptActive = (params: UseFeedbackPromptParams | null): UseFeedbackPromptResult => {
  const enabled = FEEDBACK_API_URL !== null;
  // No workshop context: manual dialog only, without planner activity tracking.
  const automatic = enabled && params !== null;
  const storage = useMemo(() => (storageOverride ? storageOverride() : defaultStorage()), []);

  // State. We persist immediately after every mutation so an early tab
  // close can't lose the cooldown.
  const [now, setNow] = useState<number>(() => Date.now());
  const [state, setState] = useState<FeedbackPromptState>(() => storage.loadState(Date.now()));
  const [session, setSession] = useState<FeedbackSessionState>(() => storage.loadSession());
  const [variant, setVariant] = useState<FeedbackVariant>('hidden');
  const [cardCountdownMs, setCardCountdownMs] = useState<number>(CARD_AUTO_DISMISS_MS);

  // Refs for values the listeners close over.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const blockCount = params ? getAllItems(params.workshop).length : 0;
  const blockCountRef = useRef(blockCount);
  blockCountRef.current = blockCount;
  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const variantRef = useRef(variant);
  variantRef.current = variant;
  // Tracks the source of the *current* visible prompt (card or dialog). Set
  // when a show/open path runs and consumed by onSubmit so the recorded
  // `receivedVia` matches what the user actually saw. Cleared on hide/send.
  const sourceRef = useRef<PromptSource | null>(null);
  const activeSinceRef = useRef<number | null>(null);

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    storage.saveState(state);
  }, [state, storage, enabled]);
  useEffect(() => {
    if (!enabled) return;
    storage.saveSession(session);
  }, [session, storage, enabled]);

  // ── Visibility second counter ─────────────────────────────────────────────
  useEffect(() => {
    if (!automatic) return;
    if (typeof document === 'undefined') return;
    if (isPrerendering()) return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        activeSinceRef.current = Date.now();
      } else {
        activeSinceRef.current = null;
      }
    };
    onVisibility();

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const started = activeSinceRef.current;
      if (started === null) {
        activeSinceRef.current = Date.now();
        return;
      }
      const elapsedMs = Date.now() - started;
      if (elapsedMs >= 1000) {
        setState((s) => {
          const add = Math.floor(elapsedMs / 1000);
          activeSinceRef.current = started + add * 1000;
          return { ...s, activeSeconds: s.activeSeconds + add };
        });
      }
    }, 1000);

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [automatic]);

  // ── Re-evaluate eligibility (visibility, maturity) ─────────────────────────
  useEffect(() => {
    if (!automatic) return;
    if (isPrerendering()) return;
    // Tick `now` every 5s so a user who crosses the maturity threshold while
    // idling on the planner actually gets to see the prompt.
    const interval = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(interval);
  }, [automatic]);

  // ── Public action arming (called by header/sidebar on print/export/copy) ─
  // Bus subscribers (the HeaderActionButtons / SettingsPanel / handleExport
  // paths) call the module-level `armFeedbackValuableAction` exported from
  // this file; the hook subscribes and mirrors into local state.
  useEffect(() => {
    if (!automatic) return undefined;
    return subscribeValuableAction((kind) => {
      setState((s) => markValuableAction(s, kind, Date.now()));
    });
  }, [automatic]);

  // ── Edit recording (called by useWorkshop on every mutation) ─────────────
  // Skip the very first run so the planner mount is not counted as an edit
  // (the workshop reference always changes once when useWorkshop seeds the
  // tree, even with no user interaction). After that, every reference change
  // — prefill, hash load, undo, import, real edits — bumps the counter. The
  // effect is idempotent on a single increment: setState's updater does the
  // recordEditOperation work and we move the setSession write + timestamp
  // out of the updater so the updater stays pure.
  const editCountedRef = useRef(false);
  useEffect(() => {
    if (!automatic) return;
    if (isPrerendering()) return;
    if (!editCountedRef.current) {
      editCountedRef.current = true;
      return;
    }
    const now = Date.now();
    setState((s) => recordEditOperation(s, sessionRef.current, now).state);
    setSession((sess) => ({ ...sess, counted: true }));
  }, [automatic, params?.workshop]);

  // ── Card auto-dismiss countdown ──────────────────────────────────────────
  useEffect(() => {
    if (!automatic) return;
    if (variant !== 'card') {
      setCardCountdownMs(0);
      return;
    }
    setCardCountdownMs(CARD_AUTO_DISMISS_MS);
    const interval = setInterval(() => {
      setCardCountdownMs((ms) => {
        if (ms <= 1000) {
          clearInterval(interval);
          recordDismiss(stateRef.current, sessionRef.current, 'timeout', Date.now());
          setState((s) => s);
          setSession((sess) => ({ ...sess, dismissed: true }));
          setVariant('hidden');
          return 0;
        }
        return ms - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [variant, automatic]);

  // ── Eligibility-driven auto-show ─────────────────────────────────────────
  // Re-check whenever `now`, `state`, or blockers change.
  useEffect(() => {
    if (!automatic) return;
    if (isPrerendering()) return;
    if (variant !== 'hidden') return; // already showing
    if (!params || isBlocker(params)) return;

    const s = stateRef.current;
    const sess = sessionRef.current;
    if (!isMature(s, blockCount, now)) return;
    if (hasLock(s, sess, now)) return;

    // Card source: only if a recent valuable action falls inside the window.
    if (isCardEligible(s, now)) {
      const result = tryShow(s, 'card', now);
      if (result.allowed) {
        setState(result.nextState);
        setSession({ ...sess, dismissed: true }); // mark dismissed for the rest of the tab
        sourceRef.current = 'card';
        setVariant('card');
        return;
      }
    }

    // Exit source: handled by the mouseleave listener below.
  }, [now, variant, params, blockCount, automatic]);

  // ── Exit-intent (mouseleave on top edge) ─────────────────────────────────
  useEffect(() => {
    if (!automatic) return;
    if (isPrerendering()) return;
    if (typeof document === 'undefined') return;

    let armedAt = 0;
    let visibleSince: number | null = null;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (visibleSince === null) visibleSince = Date.now();
      } else {
        visibleSince = null;
      }
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);

    const onMouseLeave = (event: MouseEvent) => {
      const s = stateRef.current;
      const sess = sessionRef.current;
      if (!isMature(s, blockCountRef.current, Date.now())) return;
      if (hasLock(s, sess, Date.now())) return;
      if (variantRef.current !== 'hidden') return;
      if (!paramsRef.current || isBlocker(paramsRef.current)) return;

      const visibleSec = visibleSince === null ? 0 : (Date.now() - visibleSince) / 1000;
      const decision = shouldTriggerExitIntent({
        relatedTarget: event.relatedTarget as EventTarget | null,
        clientY: event.clientY,
        pointerFine: pointerFine(),
        armedAt,
        now: Date.now(),
        visibleSeconds: visibleSec,
      });
      armedAt = decision.armConfirm ? Date.now() : armedAt;
      if (!decision.shouldTrigger) return;

      const result = tryShow(s, 'exit', Date.now());
      if (!result.allowed) return;
      setState(result.nextState);
      setSession({ ...sess, dismissed: true });
      sourceRef.current = 'exit';
      setVariant('dialog');
    };

    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [automatic]);

  // ── Controls ──────────────────────────────────────────────────────────────
  // Shared by the SettingsPanel entry ("Feedback geben") and the external
  // request bus (site.tsx "Fehler melden?" bubble). The menu path ALWAYS
  // opens — tryShow('menu') bypasses lastSentAt / 30-day rest / monthly cap
  // server-side rate limiting is the only remaining bound on repeat sends.
  //
  // Every control is a no-op when the endpoint is not configured. The hook
  // still exposes the same shape so callers can wire the prop defensively
  // without checking build mode — but the inert result is short-circuited
  // upstream, so these bodies only run when enabled.
  const openFromMenu = useCallback(() => {
    if (!enabled) return;
    const s = stateRef.current;
    const sess = sessionRef.current;
    if (variantRef.current !== 'hidden') return;

    const result = tryShow(s, 'menu', Date.now());
    if (!result.allowed) return;
    setState(result.nextState);
    setSession({ ...sess, dismissed: true });
    sourceRef.current = 'menu';
    setVariant('dialog');
  }, [enabled]);

  /**
   * Promote the currently-visible card to the dialog. The card path already
   * consumed the monthly slot via `tryShow`, so we do NOT call `tryShow`
   * again — that would either no-op (allowed) or double-count (if the cap
   * were re-checked differently). We just flip the variant and tag the
   * source so the submit is recorded as `card`.
   */
  const openDialogFromCard = useCallback(() => {
    if (!enabled) return;
    if (variantRef.current !== 'card') return;
    sourceRef.current = 'card';
    setVariant('dialog');
  }, [enabled]);

  const onSubmit = useCallback(async (rating: number, text: string, website: string, email?: string) => {
    if (!enabled) return;
    // Use the recorded source. Default to 'exit' (the most common automatic
    // source) when the ref is somehow empty — that keeps an unexpected
    // code path from re-introducing a 'menu' mislabel.
    const via: PromptSource = sourceRef.current ?? 'exit';
    const result = await submitFeedback({
      rating,
      text: text.trim() || undefined,
      email: email && email.trim().length > 0 ? email.trim() : undefined,
      receivedVia: via,
      website: website || undefined,
    });
    if (result.ok) {
      setState((s) => recordSend(s, Date.now()));
      sourceRef.current = null;
      setVariant('hidden');
    } else {
      // Keep the dialog open so the user can retry. Caller renders the
      // error state. We do NOT set a lock here.
      throw new Error('feedback-failed');
    }
  }, [enabled]);

  const onDismiss = useCallback((kind: 'later' | 'close' | 'timeout') => {
    if (!enabled) return;
    const t = Date.now();
    const updated = recordDismiss(stateRef.current, sessionRef.current, kind, t);
    setState(updated.state);
    setSession(updated.session);
    sourceRef.current = null;
    setVariant('hidden');
  }, [enabled]);

  const onMenuAbandoned = useCallback(() => {
    if (!enabled) return;
    const t = Date.now();
    const updated = recordDismiss(stateRef.current, sessionRef.current, 'menu-abandoned', t);
    setState(updated.state);
    setSession(updated.session);
    sourceRef.current = null;
    setVariant('hidden');
  }, [enabled]);

  /**
   * Hide the dialog after a successful send. The success path already
   * recorded `lastSentAt` (in onSubmit) and triggered permanent suppression
   * via `hasLock`, so we do NOT record a dismissal here — that would set a
   * hard `lockUntil` and mask the permanent-suppression intent. We only
   * flip the variant and clear the source ref.
   */
  const closeAfterSent = useCallback(() => {
    if (!enabled) return;
    sourceRef.current = null;
    setVariant('hidden');
  }, [enabled]);

  // Subscribe to external dialog requests (site.tsx "Fehler melden?"
  // bubble). Placed after openFromMenu's declaration — the deps array
  // evaluates during render, so the effect must not appear earlier in the
  // function body (temporal dead zone).
  useEffect(() => {
    if (!automatic) return undefined;
    if (isPrerendering()) return undefined;
    return subscribeFeedbackDialogRequest(openFromMenu);
  }, [openFromMenu, automatic]);

  return {
    state: variant,
    cardCountdownMs,
    controls: { openFromMenu, openDialogFromCard, onSubmit, onDismiss, onMenuAbandoned, closeAfterSent },
  };
};

// re-export some helpers used by tests / layer code
export { monthKey, hasLock, isMature, isCardEligible };

// ── Cross-component bus ─────────────────────────────────────────────────────

type ValuableActionKind = 'print' | 'json-export' | 'csv-export' | 'link';
type ValuableActionListener = (kind: ValuableActionKind) => void;
const valuableActionListeners = new Set<ValuableActionListener>();

/**
 * Module-level pub/sub for "valuable action" signals. Components that
 * trigger a print, JSON export, or link copy call `armFeedbackValuableAction`
 * without prop-drilling through the planner tree; the hook (which owns the
 * state) subscribes via `subscribeValuableAction` and mirrors the signal
 * into `lastValuableActionAt`. Idempotent and cheap.
 *
 * Split into two named exports (callable + subscriber) instead of a single
 * `{ fire, subscribe }` object so call sites read as a plain function and
 * typecheck unambiguously.
 */
export const armFeedbackValuableAction = (kind: ValuableActionKind): void => {
  for (const listener of valuableActionListeners) {
    try {
      listener(kind);
    } catch {
      // swallow — one bad listener must not block the others
    }
  }
};

export const subscribeValuableAction = (listener: ValuableActionListener): (() => void) => {
  valuableActionListeners.add(listener);
  return () => { valuableActionListeners.delete(listener); };
};

// ── External dialog-request bus ("Fehler melden?" in site.tsx) ───────────────

type FeedbackDialogRequestListener = () => void;
const feedbackDialogRequestListeners = new Set<FeedbackDialogRequestListener>();

/**
 * Request the feedback dialog from outside the planner tree (currently the
 * fixed "Fehler melden?" bubble rendered in RootLayout). Returns whether a
 * listener existed — callers without a mounted planner (e.g. blog pages)
 * can render a manual-only feedback dialog instead.
 */
export const requestFeedbackDialog = (): boolean => {
  if (feedbackDialogRequestListeners.size === 0) return false;
  for (const listener of feedbackDialogRequestListeners) {
    try {
      listener();
    } catch {
      // swallow — one bad listener must not block the others
    }
  }
  return true;
};

export const subscribeFeedbackDialogRequest = (
  listener: FeedbackDialogRequestListener,
): (() => void) => {
  feedbackDialogRequestListeners.add(listener);
  return () => { feedbackDialogRequestListeners.delete(listener); };
};
