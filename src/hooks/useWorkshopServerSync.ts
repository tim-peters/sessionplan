/**
 * useWorkshopServerSync — Server-mode state and side effects for the workshop planner.
 *
 * Role: Companion to useWorkshop. Manages the "dynamic link" / server-sync layer:
 *       holds the server key/version, loads from the server, debounces PUTs,
 *       polls for incoming updates (with conflict resolution), and exposes
 *       enable/disable server mode, migration, and local-copy actions.
 *       Does NOT own the workshop data — receives it from useWorkshop.
 * Used by: useWorkshop (orchestrator), WorkshopPlanner (via useWorkshop destructure)
 *
 * Sync rules:
 *  - The server's version check is the only overwrite protection. A version
 *    only advances here when the local state contains that server state.
 *  - At most one PUT runs at a time and its response is always evaluated, so
 *    the client cannot lose track of a version it wrote itself.
 *  - A PUT always carries the latest state. Edits made meanwhile share one
 *    follow-up PUT.
 *  - Polling pauses while a PUT runs or is due, because that PUT performs the
 *    same check. Links without write access keep polling.
 *  - Commit IDs tell an own write whose response got lost from a foreign one.
 *  - A conflict freezes syncing: local edits and the version stay untouched
 *    until the user decides.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkshopData, generateId } from '@/types/workshop';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import { getPlanStats } from '@/lib/workshop-days';
import {
  getKeyFromSearch,
  setKeyToUrl,
  clearKeyFromUrl,
  setWorkshopToHash,
  setHistorySessionId,
  createServerSession,
  fetchServerSessionStatus,
  updateServerSession,
  deleteServerSession,
  UpdateServerSessionResult,
  getSessionHistory,
  upsertSessionToHistory,
  removeSessionFromHistory,
  encodeWorkshopToUrl,
  getLegacyMigration,
  saveLegacyMigration,
  type LegacyMigrationTarget,
} from '@/lib/workshopStorage';
import { getServerSessionAccess, isLegacyServerKey, type ServerSessionAccess, type SessionUnavailableReason, type UpdateServerFailureReason } from '@/lib/workshopServer';
import { POLLING_INTERVALS, POLLING_AGE_THRESHOLDS, DEBOUNCE_TIMES, SERVER_PUT_RETRY_MS, SERVER_PUT_RETRY_MAX_MS } from '@/lib/timing';

/** The local state a PUT carried, to tell whether edits followed it. */
interface SentState {
  data: WorkshopData;
  dirtyGeneration: number;
}

interface InFlightPut extends SentState {
  sessionGeneration: number;
}

/** A PUT without a confirmed outcome: it may have reached the server. */
interface UnconfirmedPut extends SentState {
  commitId: string;
}

interface UseWorkshopServerSyncArgs {
  workshop: WorkshopData;
  setCurrentSessionId: (id: string | null) => void;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  setWorkshop: (updater: (prev: WorkshopData) => WorkshopData) => void;
  onExternalUpdate?: (version: number) => void;
  onSessionNotFound?: () => void;
  onSessionUnavailable?: (reason: SessionUnavailableReason) => void;
}

export interface WorkshopServerSync {
  serverKey: string | null;
  serverVersion: number;
  canEditServerSession: boolean;
  isLegacyServerSession: boolean;
  isLoadingFromServer: boolean;
  isServerSessionLoaded: boolean;
  isEnablingServerMode: boolean;
  incomingUpdate: { data: WorkshopData; version: number } | null;
  hasUnsyncedChanges: boolean;
  hasSyncError: boolean;
  /**
   * Cause of the current sync failure. `null` while the sync is healthy, while
   * a session is loading, or during a single transient failure that is still
   * being retried. `forbidden` means the link lost its write permission and
   * the renderer should show the read-only banner; `deleted` that the session
   * no longer exists; `rejected` that the server refuses this payload; `server`
   * a lasting transport/server error (unsynced-changes banner).
   */
  syncFailureReason: UpdateServerFailureReason | null;
  enableServerMode: () => Promise<string | null>;
  disableServerMode: () => Promise<boolean>;
  pollNow: () => Promise<void>;
  acceptIncomingUpdate: () => void;
  legacyMigrationStatus: 'new' | 'existing' | 'missing';
  migrateLegacySession: () => Promise<string | null>;
  createLocalCopy: () => void;
  markDirty: () => void;
  /** Tell the sync about edits that live in an open form, not yet in the workshop. */
  setHasPendingFormEdits: (hasEdits: boolean) => void;
  loadServerSession: (key: string, hash?: string) => void;
  /** Reset every sync-state flag without touching the workshop data itself. */
  resetSyncState: () => void;
  /** The URL no longer shows this session (Back/Forward): send pending edits, then detach. */
  leaveServerSession: () => void;
  /**
   * Read the current refs and return true when local edits or a sync
   * failure would be lost by closing the session right now.
   */
  getHasUnsavedCloseRisk: () => boolean;
}

export const useWorkshopServerSync = ({
  workshop,
  setCurrentSessionId,
  currentSessionIdRef,
  setWorkshop,
  onExternalUpdate,
  onSessionNotFound,
  onSessionUnavailable,
}: UseWorkshopServerSyncArgs): WorkshopServerSync => {
  const [serverKey, setServerKey] = useState<string | null>(() => getKeyFromSearch());
  const [serverVersion, setServerVersion] = useState<number>(0);
  const [incomingUpdate, setIncomingUpdate] = useState<{ data: WorkshopData; version: number } | null>(null);
  const [isLoadingFromServer, setIsLoadingFromServer] = useState<boolean>(() => !!getKeyFromSearch());
  const [isServerSessionLoaded, setIsServerSessionLoaded] = useState(false);
  const [isEnablingServerMode, setIsEnablingServerMode] = useState(false);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [syncFailureReason, setSyncFailureReason] = useState<UpdateServerFailureReason | null>(null);

  const creationInFlightRef = useRef(false);
  const migrationsRef = useRef(new Map<string, LegacyMigrationTarget>());
  const [missingMigrationKey, setMissingMigrationKey] = useState<string | null>(null);
  const migrationTarget = serverKey ? migrationsRef.current.get(serverKey) ?? getLegacyMigration(serverKey) : null;
  const legacyMigrationStatus = missingMigrationKey === serverKey && serverKey !== null
    ? 'missing' : migrationTarget ? 'existing' : 'new';

  const serverKeyRef = useRef(serverKey);
  serverKeyRef.current = serverKey;
  // Written synchronously by recordVersion: a poll or timer running before the
  // next render must already see the version.
  const serverVersionRef = useRef(serverVersion);
  const incomingUpdateRef = useRef(incomingUpdate);
  incomingUpdateRef.current = incomingUpdate;
  const activityTimestampRef = useRef(0);
  const isDirtyRef = useRef(false);
  const isConflictedRef = useRef(false);
  const syncFailureReasonRef = useRef<UpdateServerFailureReason | null>(null);
  syncFailureReasonRef.current = syncFailureReason;

  const workshopRef = useRef(workshop);
  workshopRef.current = workshop;
  // Bumped on every local mutation. An identical workshop object alone does
  // not prove "no edits" while a state update still waits for its render.
  const dirtyGenerationRef = useRef(0);
  const committedDirtyGenerationRef = useRef(0);
  // Bumped when the open session changes: late responses of the old one are void.
  const sessionGenerationRef = useRef(0);
  const inFlightPutRef = useRef<InFlightPut | null>(null);
  const unconfirmedPutsRef = useRef<UnconfirmedPut[]>([]);
  const lastSyncedDataRef = useRef<WorkshopData | null>(null);
  const putDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const putRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const putDueRef = useRef(false);
  const putPendingSinceRef = useRef<number | null>(null);
  const waitingForOnlineRef = useRef(false);
  const failedPutAttemptsRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const hasPendingFormEditsRef = useRef(false);
  const writeAccessRef = useRef<ServerSessionAccess | null>(null);
  const isUnmountedRef = useRef(false);
  const sendPutRef = useRef<(() => void) | null>(null);

  const historyHash = useCallback((existing?: SessionHistoryEntry): string => {
    const current = window.location.hash;
    const stored = existing?.serverHash;
    return stored && getServerSessionAccess(stored).writeCapability && !getServerSessionAccess(current).writeCapability
      ? stored
      : current;
  }, []);

  const updateUnsyncedState = useCallback(() => {
    const dirty = serverKeyRef.current !== null && (isDirtyRef.current || incomingUpdateRef.current !== null);
    setHasUnsyncedChanges(dirty);
  }, []);

  const recordVersion = useCallback((version: number) => {
    serverVersionRef.current = version;
    setServerVersion(version);
  }, []);

  /** The local state now equals this server state: nothing is left to sync. */
  const applySyncedVersion = useCallback((version: number, data: WorkshopData) => {
    recordVersion(version);
    lastSyncedDataRef.current = data;
    isDirtyRef.current = false;
    updateUnsyncedState();
  }, [recordVersion, updateUnsyncedState]);

  const clearPutTimers = useCallback(() => {
    if (putDebounceTimerRef.current) clearTimeout(putDebounceTimerRef.current);
    if (putRetryTimerRef.current) clearTimeout(putRetryTimerRef.current);
    putDebounceTimerRef.current = null;
    putRetryTimerRef.current = null;
    putDueRef.current = false;
    putPendingSinceRef.current = null;
    waitingForOnlineRef.current = false;
  }, []);

  const clearSyncFailure = useCallback(() => {
    failedPutAttemptsRef.current = 0;
    syncFailureReasonRef.current = null;
    setHasSyncError(false);
    setSyncFailureReason(null);
  }, []);

  const showSyncFailure = useCallback((reason: UpdateServerFailureReason) => {
    syncFailureReasonRef.current = reason;
    setHasSyncError(reason === 'server');
    setSyncFailureReason(reason);
  }, []);

  /** Void everything still running for the previous session. */
  const startNewSyncEpoch = useCallback(() => {
    sessionGenerationRef.current += 1;
    clearPutTimers();
    inFlightPutRef.current = null;
    unconfirmedPutsRef.current = [];
    lastSyncedDataRef.current = null;
    failedPutAttemptsRef.current = 0;
  }, [clearPutTimers]);

  /** Detaches from the server session: no key, no flags, no pending update. */
  const clearServerSessionState = useCallback(() => {
    serverKeyRef.current = null;
    setServerKey(null);
    setIsServerSessionLoaded(false);
    setHasSyncError(false);
    setHasUnsyncedChanges(false);
    setSyncFailureReason(null);
    syncFailureReasonRef.current = null;
    isDirtyRef.current = false;
    isConflictedRef.current = false;
    incomingUpdateRef.current = null;
    setIncomingUpdate(null);
  }, []);

  /**
   * Wipe every piece of sync bookkeeping: server key + ref, failure reason,
   * in-flight error flag, dirty flag, conflict flag and any incoming update.
   * The caller is responsible for URL/redirect changes — this just guarantees
   * no banner can stick around in memory after the session is closed.
   */
  const resetSyncState = useCallback(() => {
    startNewSyncEpoch();
    migrationsRef.current.clear();
    setMissingMigrationKey(null);
    clearServerSessionState();
  }, [startNewSyncEpoch, clearServerSessionState]);

  /**
   * Snapshot of "would closing now lose changes?" — readable from keyboard
   * shortcuts that close over stale state. The actual closing action still
   * goes through the regular handlers so the dialog flow stays
   * consistent; this just lets the shortcut pick the right branch today.
   */
  const getHasUnsavedCloseRisk = useCallback((): boolean => {
    if (!serverKeyRef.current) return false;
    return (
      isDirtyRef.current ||
      incomingUpdateRef.current !== null ||
      (syncFailureReasonRef.current !== null && syncFailureReasonRef.current !== 'deleted')
    );
  }, []);

  // Load workshop from server when a key is present in the URL on initial mount.
  // For navigating between sessions from the UI, loadServerSession() is used instead.
  useEffect(() => {
    const key = getKeyFromSearch();
    if (!key) return;

    let cancelled = false;
    const sessionGeneration = sessionGenerationRef.current;
    setIsLoadingFromServer(true);

    fetchServerSessionStatus(key).then((result) => {
      if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
      if (result.status === 'available') {
        setIsServerSessionLoaded(true);
        setWorkshop(() => result.data);
        serverKeyRef.current = key;
        setServerKey(key);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        applySyncedVersion(result.version, result.data);

        const sessions = getSessionHistory();
        const existing = sessions.find((s) => s.serverKey === key);
        const sessionId = existing?.id ?? generateId();
        const now = Date.now();
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        upsertSessionToHistory({
          id: sessionId,
          title: result.data.workshop.title,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          lastOpenedAt: now,
          ...getPlanStats(result.data),
          type: 'dynamic',
          serverKey: key,
          serverHash: historyHash(existing),
        });
      } else if (result.status === 'not-found') {
        clearKeyFromUrl();
        serverKeyRef.current = null;
        setServerKey(null);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        setIsLoadingFromServer(false);
        updateUnsyncedState();
        onSessionNotFound?.();
      } else {
        // 'unavailable' — keep the key in the URL so the user can retry by
        // reloading or revisiting the link, and surface the reason via the
        // unavailable callback so the UI can show a transient error.
        serverKeyRef.current = key;
        setServerKey(key);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        setIsLoadingFromServer(false);
        updateUnsyncedState();
        onSessionUnavailable?.(result.reason);
      }
      setIsLoadingFromServer(false);
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The server holds a state the local one was not based on. Local edits and
   * the version stay as they are, so nothing can overwrite either side before
   * the user decides.
   */
  const raiseConflict = useCallback((incoming: { data: WorkshopData; version: number }) => {
    isConflictedRef.current = true;
    incomingUpdateRef.current = incoming;
    setIncomingUpdate(incoming);
    clearPutTimers();
    clearSyncFailure();
    updateUnsyncedState();
  }, [clearPutTimers, clearSyncFailure, updateUnsyncedState]);

  /** Sync bookkeeping once `sent` is known to be the server state at `version`. */
  const confirmSentState = useCallback((sent: SentState, version: number) => {
    recordVersion(version);
    lastSyncedDataRef.current = sent.data;
    unconfirmedPutsRef.current = [];
    clearSyncFailure();
    const editedSinceSend = workshopRef.current !== sent.data
      || dirtyGenerationRef.current !== sent.dirtyGeneration;
    if (!editedSinceSend) {
      clearPutTimers();
      isDirtyRef.current = false;
      updateUnsyncedState();
    } else if (putDueRef.current || !putDebounceTimerRef.current) {
      sendPutRef.current?.();
    }
  }, [clearPutTimers, clearSyncFailure, recordVersion, updateUnsyncedState]);

  /** Wrap up a failed PUT: retry transient errors, stop on permanent ones. */
  const handlePutFailure = useCallback((reason: UpdateServerFailureReason) => {
    if (reason !== 'server') {
      failedPutAttemptsRef.current = 0;
      if (reason === 'deleted') clearPutTimers();
      showSyncFailure(reason);
      // A newer state may pass where the refused one did not.
      if (reason === 'rejected' && putDueRef.current) sendPutRef.current?.();
      return;
    }
    failedPutAttemptsRef.current += 1;
    const isOffline = navigator.onLine === false;
    // A single failure that the retry resolves is not worth a warning.
    if (isOffline || failedPutAttemptsRef.current > 1) showSyncFailure('server');
    if (isOffline) {
      waitingForOnlineRef.current = true;
      return;
    }
    if (putDebounceTimerRef.current) return;
    const delay = Math.min(
      SERVER_PUT_RETRY_MS * 2 ** (failedPutAttemptsRef.current - 1),
      SERVER_PUT_RETRY_MAX_MS,
    );
    putRetryTimerRef.current = setTimeout(() => {
      putRetryTimerRef.current = null;
      sendPutRef.current?.();
    }, delay);
  }, [clearPutTimers, showSyncFailure]);

  const sendPut = useCallback((leavingSession = false) => {
    const key = serverKeyRef.current;
    if (!key || inFlightPutRef.current || isConflictedRef.current) return;
    if (syncFailureReasonRef.current === 'deleted') return;
    // After leaving the session the URL no longer carries the link's secrets.
    const useStoredAccess = leavingSession || isUnmountedRef.current;
    const access = useStoredAccess && writeAccessRef.current
      ? writeAccessRef.current
      : getServerSessionAccess();
    if (!isLegacyServerKey(key) && !access.writeCapability) return;

    clearPutTimers();
    if (!isDirtyRef.current) return;

    const data = workshopRef.current;
    const dirtyGeneration = dirtyGenerationRef.current;
    if (data === lastSyncedDataRef.current) {
      // E.g. undo back to the synced state. The workshop object is only final
      // once no generation is waiting for its render; the effect covers that.
      if (committedDirtyGenerationRef.current === dirtyGeneration) {
        isDirtyRef.current = false;
        clearSyncFailure();
        updateUnsyncedState();
      }
      return;
    }
    if (navigator.onLine === false && !useStoredAccess) {
      waitingForOnlineRef.current = true;
      showSyncFailure('server');
      return;
    }

    const sessionGeneration = sessionGenerationRef.current;
    const flight: InFlightPut = { data, dirtyGeneration, sessionGeneration };
    inFlightPutRef.current = flight;
    void updateServerSession(key, data, serverVersionRef.current, access, (commitId) => {
      if (sessionGenerationRef.current !== sessionGeneration) return;
      unconfirmedPutsRef.current.push({ commitId, data, dirtyGeneration });
    }).then((result: UpdateServerSessionResult) => {
      if (sessionGenerationRef.current !== sessionGeneration) return;
      inFlightPutRef.current = null;
      if ('serverData' in result) {
        const ownPut = unconfirmedPutsRef.current.find((put) => put.commitId === result.serverCommitId);
        if (ownPut) confirmSentState(ownPut, result.serverVersion);
        else raiseConflict({ data: result.serverData, version: result.serverVersion });
      } else if ('reason' in result) {
        handlePutFailure(result.reason);
      } else {
        confirmSentState(flight, result.version);
      }
    });
  }, [clearPutTimers, clearSyncFailure, confirmSentState, handlePutFailure, raiseConflict, showSyncFailure, updateUnsyncedState]);
  sendPutRef.current = sendPut;

  const schedulePut = useCallback(() => {
    if (putDebounceTimerRef.current) clearTimeout(putDebounceTimerRef.current);
    const now = Date.now();
    putPendingSinceRef.current ??= now;
    const maxWaitLeft = DEBOUNCE_TIMES.SERVER_PUT_MAX_WAIT - (now - putPendingSinceRef.current);
    putDebounceTimerRef.current = setTimeout(() => {
      putDebounceTimerRef.current = null;
      if (inFlightPutRef.current) putDueRef.current = true;
      else sendPut();
    }, Math.max(0, Math.min(DEBOUNCE_TIMES.SERVER_PUT, maxWaitLeft)));
  }, [sendPut]);

  // Sync to server when in server mode. A failed PUT (network/server error,
  // not a conflict) is retried with a growing delay until it succeeds, a
  // conflict occurs, or the session changes. A 403 is a permanent permission
  // failure: it stays surfaced but is NOT retried because it cannot recover
  // without the user re-requesting write access or forking the session.
  useEffect(() => {
    committedDirtyGenerationRef.current = dirtyGenerationRef.current;
    if (!serverKey || isLoadingFromServer) return;
    const access = getServerSessionAccess();
    if (!isLegacyServerKey(serverKey) && !access.writeCapability) return;
    writeAccessRef.current = access;
    if (!isDirtyRef.current || isConflictedRef.current) return;
    if (syncFailureReasonRef.current === 'deleted') return;
    schedulePut();
  }, [workshop, serverKey, isLoadingFromServer, schedulePut]);

  // In-app navigation away from the planner fires no beforeunload warning, so
  // a pending edit is sent right away instead of being dropped with the timer.
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      const hasPendingPut = putDebounceTimerRef.current !== null
        || putRetryTimerRef.current !== null
        || putDueRef.current
        || waitingForOnlineRef.current;
      if (!hasPendingPut) return;
      clearPutTimers();
      // A running PUT sends the rest when it returns.
      putDueRef.current = true;
      sendPutRef.current?.();
    };
  }, [clearPutTimers]);

  // Warn the user before leaving the page while dynamic-link changes are not
  // synced yet. Triggers the browser's native "leave site?" dialog (its text
  // is browser-controlled and cannot be customized).
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (serverKeyRef.current && (isDirtyRef.current || incomingUpdateRef.current)) {
        event.preventDefault();
        event.returnValue = ''; // legacy Chrome/Edge requirement
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Track local activity timestamp on every workshop change
  useEffect(() => {
    if (serverKeyRef.current) {
      activityTimestampRef.current = Date.now();
    }
  }, [workshop]);

  const pollOnce = useCallback(async () => {
    const key = serverKeyRef.current;
    if (!key || pollInFlightRef.current || isConflictedRef.current || inFlightPutRef.current) return;
    if (syncFailureReasonRef.current === 'deleted' || navigator.onLine === false) return;
    // A dirty writer has a PUT due, which runs the same check on the server.
    const hasWriteAccess = isLegacyServerKey(key) || !!getServerSessionAccess().writeCapability;
    const failure = syncFailureReasonRef.current;
    const hasPutDue = isDirtyRef.current && hasWriteAccess && (failure === null || failure === 'server');
    if (hasPutDue) return;

    const sessionGeneration = sessionGenerationRef.current;
    pollInFlightRef.current = true;
    let result: Awaited<ReturnType<typeof fetchServerSessionStatus>>;
    try {
      result = await fetchServerSessionStatus(key);
    } finally {
      pollInFlightRef.current = false;
    }
    if (sessionGenerationRef.current !== sessionGeneration) return;
    if (result.status === 'not-found') {
      clearPutTimers();
      showSyncFailure('deleted');
      return;
    }
    if (result.status !== 'available') return;
    // A PUT started meanwhile: its response decides, and this result may
    // already contain its write.
    if (inFlightPutRef.current || result.version <= serverVersionRef.current) return;

    if (isConflictedRef.current) {
      const current = incomingUpdateRef.current;
      if (!current || result.version > current.version) {
        const incoming = { data: result.data, version: result.version };
        incomingUpdateRef.current = incoming;
        setIncomingUpdate(incoming);
      }
      return;
    }
    const ownPut = unconfirmedPutsRef.current.find((put) => put.commitId === result.commitId);
    if (ownPut) {
      confirmSentState(ownPut, result.version);
    } else if (isDirtyRef.current || hasPendingFormEditsRef.current) {
      raiseConflict({ data: result.data, version: result.version });
    } else {
      onExternalUpdate?.(result.version);
      setWorkshop(() => result.data);
      applySyncedVersion(result.version, result.data);
    }
  }, [applySyncedVersion, clearPutTimers, confirmSentState, onExternalUpdate, raiseConflict, setWorkshop, showSyncFailure]);

  useEffect(() => {
    if (!serverKey || isLoadingFromServer) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const getInterval = (): number => {
      const age = Date.now() - activityTimestampRef.current;
      if (age < POLLING_AGE_THRESHOLDS.ACTIVE_MS) return POLLING_INTERVALS.ACTIVE;
      if (age < POLLING_AGE_THRESHOLDS.COOLING_MS) return POLLING_INTERVALS.COOLING;
      return POLLING_INTERVALS.IDLE;
    };

    const poll = async () => {
      if (cancelled || !serverKeyRef.current || document.visibilityState === 'hidden') return;

      try {
        await pollOnce();
      } catch (error) {
        console.error('Polling failed:', error);
      }

      if (!cancelled) {
        timeoutId = setTimeout(poll, getInterval());
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timeoutId);
        poll();
      }
    };

    const handleFocus = () => {
      clearTimeout(timeoutId);
      poll();
    };

    const handleOnline = () => {
      clearTimeout(timeoutId);
      if (waitingForOnlineRef.current || putRetryTimerRef.current) sendPut();
      poll();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    timeoutId = setTimeout(poll, getInterval());

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [serverKey, isLoadingFromServer, pollOnce, sendPut]);

  const enableServerMode = useCallback(async (): Promise<string | null> => {
    if (creationInFlightRef.current || serverKeyRef.current) return null;
    creationInFlightRef.current = true;
    setIsEnablingServerMode(true);
    try {
      const dirtyGeneration = dirtyGenerationRef.current;
      const { key, version, encryptionKey, writeCapability } = await createServerSession(workshop);
      setKeyToUrl(key, encryptionKey, writeCapability);
      setIsServerSessionLoaded(true);
      serverKeyRef.current = key;
      setServerKey(key);
      setHasSyncError(false);
      applySyncedVersion(version, workshop);
      // Edits made while the POST ran are not on the server yet. The sync
      // effect picks them up once the new key is committed.
      if (workshopRef.current !== workshop || dirtyGenerationRef.current !== dirtyGeneration) {
        isDirtyRef.current = true;
        updateUnsyncedState();
      }

      let sessionId = currentSessionIdRef.current;
      if (!sessionId) {
        sessionId = generateId();
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
      }
      const now = Date.now();
      const existing = getSessionHistory().find((s) => s.id === sessionId);
      upsertSessionToHistory({
        id: sessionId,
        title: workshop.workshop.title,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastOpenedAt: now,
        ...getPlanStats(workshop),
        type: 'dynamic',
        serverKey: key,
        serverHash: window.location.hash,
      });
      return window.location.href;
    } finally {
      creationInFlightRef.current = false;
      setIsEnablingServerMode(false);
    }
  }, [workshop, applySyncedVersion, updateUnsyncedState, currentSessionIdRef, setCurrentSessionId]);

  const disableServerMode = useCallback(async (): Promise<boolean> => {
    if (serverKey) {
      const deleted = await deleteServerSession(serverKey);
      if (!deleted) {
        setHasSyncError(true);
        return false;
      }
    }
    startNewSyncEpoch();
    clearServerSessionState();
    clearKeyFromUrl();
    // Persist current data to hash so work is not lost
    setWorkshopToHash(workshop);

    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      const now = Date.now();
      const existing = getSessionHistory().find((s) => s.id === sessionId);
      upsertSessionToHistory({
        id: sessionId,
        title: workshop.workshop.title,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastOpenedAt: now,
        ...getPlanStats(workshop),
        type: 'local',
        urlHash: encodeWorkshopToUrl(workshop),
      });
    }
    return true;
  }, [workshop, serverKey, currentSessionIdRef, startNewSyncEpoch, clearServerSessionState]);

  const acceptIncomingUpdate = useCallback(() => {
    const current = incomingUpdateRef.current;
    if (!current) return;
    incomingUpdateRef.current = null;
    setIncomingUpdate(null);
    onExternalUpdate?.(current.version);
    setWorkshop(() => current.data);
    applySyncedVersion(current.version, current.data);
    // Accepting discards all local unsynced changes, so any pending
    // sync-error state is resolved with it.
    clearPutTimers();
    clearSyncFailure();
    unconfirmedPutsRef.current = [];
    isConflictedRef.current = false;
    // Polling paused during the conflict, so the server may be further ahead.
    pollOnce().catch((error) => console.error('Polling failed:', error));
  }, [applySyncedVersion, clearPutTimers, clearSyncFailure, onExternalUpdate, pollOnce, setWorkshop]);

  const migrateLegacySession = useCallback(async (): Promise<string | null> => {
    const legacyKey = serverKeyRef.current;
    if (!legacyKey || !isLegacyServerKey(legacyKey) || creationInFlightRef.current) return null;
    creationInFlightRef.current = true;
    setIsEnablingServerMode(true);
    try {
      const target = migrationsRef.current.get(legacyKey) ?? getLegacyMigration(legacyKey);
      let key: string;
      let hash: string;
      let version: number;
      let data = workshop;
      if (target && missingMigrationKey !== legacyKey) {
        const result = await fetchServerSessionStatus(target.serverKey, getServerSessionAccess(target.serverHash));
        if (result.status === 'not-found') {
          setMissingMigrationKey(legacyKey);
          return null;
        }
        if (result.status !== 'available') throw new Error('Could not open migrated session.');
        key = target.serverKey;
        hash = target.serverHash;
        version = result.version;
        data = result.data;
      } else {
        const created = await createServerSession(workshop);
        key = created.key;
        version = created.version;
        hash = `#k=${created.encryptionKey}&w=${created.writeCapability}`;
        const mapping = { serverKey: key, serverHash: hash };
        migrationsRef.current.set(legacyKey, mapping);
        try {
          saveLegacyMigration(legacyKey, mapping);
        } catch {
          // The open session and this mount still retain the new link.
          // Do not turn a storage failure into another POST on retry.
          console.warn('Could not persist the local migration mapping.');
        }
      }
      const url = new URL(window.location.href);
      url.searchParams.set('id', key);
      url.hash = hash;
      window.history.pushState(null, '', url.toString());
      startNewSyncEpoch();
      setWorkshop(() => data);
      setIsServerSessionLoaded(true);
      setServerKey(key);
      serverKeyRef.current = key;
      isConflictedRef.current = false;
      incomingUpdateRef.current = null;
      setIncomingUpdate(null);
      applySyncedVersion(version, data);
      setHasSyncError(false);
      setSyncFailureReason(null);
      syncFailureReasonRef.current = null;
      setMissingMigrationKey(null);
      const now = Date.now();
      const existing = getSessionHistory().find((entry) => entry.serverKey === key);
      const sessionId = existing?.id ?? generateId();
      setCurrentSessionId(sessionId);
      currentSessionIdRef.current = sessionId;
      upsertSessionToHistory({
        id: sessionId,
        title: data.workshop.title,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastOpenedAt: now,
        ...getPlanStats(data),
        type: 'dynamic',
        serverKey: key,
        serverHash: hash,
      });
      // Hide the old entry after success; actively reopening its URL may
      // add it to history again. The server session itself stays untouched.
      for (const entry of getSessionHistory()) {
        if (entry.type === 'dynamic' && entry.serverKey === legacyKey) {
          removeSessionFromHistory(entry.id);
        }
      }
      return url.toString();
    } finally {
      creationInFlightRef.current = false;
      setIsEnablingServerMode(false);
    }
  }, [workshop, missingMigrationKey, applySyncedVersion, startNewSyncEpoch, currentSessionIdRef, setCurrentSessionId, setWorkshop]);

  /**
   * Detach a read-only Dynamic Link without touching its server copy. The
   * current in-memory edits become a standalone hash-backed local session.
   */
  const createLocalCopy = useCallback(() => {
    const localHash = encodeWorkshopToUrl(workshop);
    if (!localHash) return;

    const now = Date.now();
    const sessionId = generateId();
    startNewSyncEpoch();
    serverKeyRef.current = null;
    setServerKey(null);
    setIsServerSessionLoaded(false);
    setHasSyncError(false);
    setHasUnsyncedChanges(false);
    setSyncFailureReason(null);
    syncFailureReasonRef.current = null;
    isDirtyRef.current = false;
    isConflictedRef.current = false;
    incomingUpdateRef.current = null;
    setIncomingUpdate(null);
    // A copy must always receive a shareable local link, including an empty
    // session. Keep the read-only URL as a history entry for Back navigation.
    const localUrl = new URL(window.location.href);
    localUrl.searchParams.delete('id');
    localUrl.hash = `data=${localHash}`;
    window.history.pushState(null, '', localUrl.toString());
    setHistorySessionId(sessionId);
    setCurrentSessionId(sessionId);
    currentSessionIdRef.current = sessionId;
    upsertSessionToHistory({
      id: sessionId,
      title: workshop.workshop.title,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      ...getPlanStats(workshop),
      type: 'local',
      urlHash: localHash,
    });
  }, [workshop, currentSessionIdRef, setCurrentSessionId, startNewSyncEpoch]);

  const setHasPendingFormEdits = useCallback((hasEdits: boolean) => {
    hasPendingFormEditsRef.current = hasEdits;
  }, []);

  const leaveServerSession = useCallback(() => {
    const hasPendingPut = putDebounceTimerRef.current !== null || putDueRef.current;
    if (hasPendingPut && serverKeyRef.current && writeAccessRef.current && !inFlightPutRef.current) {
      sendPut(true);
    }
    resetSyncState();
    setIsLoadingFromServer(false);
  }, [resetSyncState, sendPut]);

  const loadServerSession = useCallback((key: string, hash = window.location.hash) => {
    if (!key) return;

    // A pending edit still belongs to the session being left. Its response is
    // void, the new epoch below ignores it.
    const hasPendingPut = putDebounceTimerRef.current !== null || putDueRef.current;
    if (hasPendingPut && serverKeyRef.current && writeAccessRef.current && !inFlightPutRef.current) {
      sendPut(true);
    }
    startNewSyncEpoch();
    isDirtyRef.current = false;
    isConflictedRef.current = false;
    incomingUpdateRef.current = null;
    setIncomingUpdate(null);
    setHasSyncError(false);
    setSyncFailureReason(null);
    syncFailureReasonRef.current = null;
    const sessionGeneration = sessionGenerationRef.current;

    setIsLoadingFromServer(true);
    setIsServerSessionLoaded(false);

    fetchServerSessionStatus(key, getServerSessionAccess(hash)).then((result) => {
      if (sessionGenerationRef.current !== sessionGeneration) return;
      if (result.status === 'available') {
        setIsServerSessionLoaded(true);
        setWorkshop(() => result.data);
        serverKeyRef.current = key;
        setServerKey(key);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        applySyncedVersion(result.version, result.data);

        const sessions = getSessionHistory();
        const existing = sessions.find((s) => s.serverKey === key);
        const sessionId = existing?.id ?? generateId();
        const now = Date.now();
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        upsertSessionToHistory({
          id: sessionId,
          title: result.data.workshop.title,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          lastOpenedAt: now,
          ...getPlanStats(result.data),
          type: 'dynamic',
          serverKey: key,
          serverHash: historyHash(existing),
        });
      } else if (result.status === 'not-found') {
        clearKeyFromUrl();
        serverKeyRef.current = null;
        setServerKey(null);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        setIsLoadingFromServer(false);
        updateUnsyncedState();
        onSessionNotFound?.();
      } else {
        // 'unavailable' — keep the key in the URL and surface the reason.
        serverKeyRef.current = key;
        setServerKey(key);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        setIsLoadingFromServer(false);
        updateUnsyncedState();
        onSessionUnavailable?.(result.reason);
      }
      setIsLoadingFromServer(false);
    });
  }, [setWorkshop, applySyncedVersion, setCurrentSessionId, currentSessionIdRef, onSessionNotFound, onSessionUnavailable, updateUnsyncedState, historyHash, sendPut, startNewSyncEpoch]);

  return {
    serverKey,
    serverVersion,
    canEditServerSession: !!serverKey && syncFailureReason !== 'forbidden' && (isLegacyServerKey(serverKey) || !!getServerSessionAccess().writeCapability),
    isLegacyServerSession: !!serverKey && isLegacyServerKey(serverKey),
    isLoadingFromServer,
    isServerSessionLoaded,
    isEnablingServerMode,
    incomingUpdate,
    hasUnsyncedChanges,
    hasSyncError,
    syncFailureReason,
    enableServerMode,
    disableServerMode,
    pollNow: pollOnce,
    acceptIncomingUpdate,
    legacyMigrationStatus,
    migrateLegacySession,
    createLocalCopy,
    markDirty: () => {
      dirtyGenerationRef.current += 1;
      isDirtyRef.current = true;
      updateUnsyncedState();
    },
    setHasPendingFormEdits,
    loadServerSession,
    resetSyncState,
    leaveServerSession,
    getHasUnsavedCloseRisk,
  };
};
