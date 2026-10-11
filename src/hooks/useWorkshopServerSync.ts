/**
 * useWorkshopServerSync — Server-mode state and side effects for the workshop planner.
 *
 * Role: Companion to useWorkshop. Manages the "dynamic link" / server-sync layer:
 *       holds the server key/version, loads from the server, debounces PUTs,
 *       polls for incoming updates (with conflict resolution), and exposes
 *       enable/disable server mode plus accept/fork actions.
 *       Does NOT own the workshop data — receives it from useWorkshop.
 * Used by: useWorkshop (orchestrator), WorkshopPlanner (via useWorkshop destructure)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkshopData, generateId } from '@/types/workshop';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import {
  getKeyFromSearch,
  setKeyToUrl,
  clearKeyFromUrl,
  setWorkshopToHash,
  createServerSession,
  fetchServerSession,
  fetchServerSessionStatus,
  updateServerSession,
  deleteServerSession,
  UpdateServerSessionResult,
  getSessionHistory,
  upsertSessionToHistory,
  encodeWorkshopToUrl,
} from '@/lib/workshopStorage';
import { getServerSessionAccess, isLegacyServerKey, type SessionUnavailableReason, type UpdateServerFailureReason } from '@/lib/workshopServer';
import { POLLING_INTERVALS, POLLING_AGE_THRESHOLDS, DEBOUNCE_TIMES, SERVER_PUT_RETRY_MS } from '@/lib/timing';

interface UseWorkshopServerSyncArgs {
  workshop: WorkshopData;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  setWorkshop: (updater: (prev: WorkshopData) => WorkshopData) => void;
  setEmptyWorkshop: () => void;
  navigate: ReturnType<typeof useNavigate>;
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
  isEnablingServerMode: boolean;
  incomingUpdate: { data: WorkshopData; version: number } | null;
  hasUnsyncedChanges: boolean;
  hasSyncError: boolean;
  /**
   * Cause of the most recent failed PUT. `null` while the sync is healthy
   * or while a session is loading. `forbidden` means the link lost its write
   * permission and the renderer should show the read-only banner; `server`
   * means a transient transport/server error and the renderer should show
   * the unsynced-changes banner.
   */
  syncFailureReason: UpdateServerFailureReason | null;
  enableServerMode: () => Promise<void>;
  disableServerMode: () => Promise<boolean>;
  pollNow: () => Promise<void>;
  acceptIncomingUpdate: () => void;
  forkSession: () => Promise<void>;
  createLocalCopy: () => void;
  markDirty: () => void;
  loadServerSession: (key: string, hash?: string) => void;
  /** Reset every sync-state flag without touching the workshop data itself. */
  resetSyncState: () => void;
  /**
   * Read the current refs and return true when local edits or a sync
   * failure would be lost by closing the session right now.
   */
  getHasUnsavedCloseRisk: () => boolean;
}

export const useWorkshopServerSync = ({
  workshop,
  currentSessionId,
  setCurrentSessionId,
  currentSessionIdRef,
  setWorkshop,
  setEmptyWorkshop,
  navigate,
  onExternalUpdate,
  onSessionNotFound,
  onSessionUnavailable,
}: UseWorkshopServerSyncArgs): WorkshopServerSync => {
  const [serverKey, setServerKey] = useState<string | null>(() => getKeyFromSearch());
  const [serverVersion, setServerVersion] = useState<number>(0);
  const [incomingUpdate, setIncomingUpdate] = useState<{ data: WorkshopData; version: number } | null>(null);
  const [isLoadingFromServer, setIsLoadingFromServer] = useState<boolean>(() => !!getKeyFromSearch());
  const [isEnablingServerMode, setIsEnablingServerMode] = useState(false);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [syncFailureReason, setSyncFailureReason] = useState<UpdateServerFailureReason | null>(null);
  const [putRetryTick, setPutRetryTick] = useState(0);

  const serverKeyRef = useRef(serverKey);
  serverKeyRef.current = serverKey;
  const serverVersionRef = useRef(serverVersion);
  serverVersionRef.current = serverVersion;
  const incomingUpdateRef = useRef(incomingUpdate);
  incomingUpdateRef.current = incomingUpdate;
  const lastSyncedVersionRef = useRef(0);
  const activityTimestampRef = useRef(0);
  const isDirtyRef = useRef(false);
  const isConflictedRef = useRef(false);
  const syncFailureReasonRef = useRef<UpdateServerFailureReason | null>(null);
  syncFailureReasonRef.current = syncFailureReason;

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

  const applySyncedVersion = useCallback((version: number) => {
    setServerVersion(version);
    lastSyncedVersionRef.current = version;
    isDirtyRef.current = false;
    updateUnsyncedState();
  }, [updateUnsyncedState]);

  /**
   * Wipe every piece of sync bookkeeping: server key + ref, failure reason,
   * in-flight error flag, dirty flag, conflict flag and any incoming update.
   * The caller is responsible for URL/redirect changes — this just guarantees
   * no banner can stick around in memory after the session is closed.
   */
  const resetSyncState = useCallback(() => {
    serverKeyRef.current = null;
    setServerKey(null);
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
      syncFailureReasonRef.current !== null
    );
  }, []);

  // Load workshop from server when a key is present in the URL on initial mount.
  // For navigating between sessions from the UI, loadServerSession() is used instead.
  useEffect(() => {
    const key = getKeyFromSearch();
    if (!key) return;

    let cancelled = false;
    setIsLoadingFromServer(true);

    fetchServerSessionStatus(key).then((result) => {
      if (cancelled) return;
      if (result.status === 'available') {
        setWorkshop(() => result.data);
        serverKeyRef.current = key;
        setServerKey(key);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        applySyncedVersion(result.version);

        const sessions = getSessionHistory();
        const existing = sessions.find((s) => s.serverKey === key);
        const sessionId = existing?.id ?? generateId();
        const now = Date.now();
        const totalDuration = result.data.items.reduce(
          (sum: number, item) => sum + (item.duration ?? 0),
          0,
        );
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        upsertSessionToHistory({
          id: sessionId,
          title: result.data.workshop.title,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          lastOpenedAt: now,
          itemCount: result.data.items.length,
          totalDuration,
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

  // Sync to server when in server mode. A failed PUT (network/server error,
  // not a conflict) is surfaced via hasSyncError and retried periodically via
  // putRetryTick until it succeeds, a conflict occurs, or the session changes.
  // A 403 is a permanent permission failure: it stays surfaced but is NOT
  // retried because it cannot recover without the user re-requesting write
  // access or forking the session.
  useEffect(() => {
    if (!serverKey || isLoadingFromServer) return;
    if (!isLegacyServerKey(serverKey) && !getServerSessionAccess().writeCapability) return;
    if (!isDirtyRef.current) return;
    if (isConflictedRef.current) return;
    let cancelled = false;
    let retryTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutId = setTimeout(() => {
      updateServerSession(serverKey, workshop, serverVersionRef.current).then(
        (result: UpdateServerSessionResult) => {
          if (cancelled) return;
          if (result.ok) {
            applySyncedVersion(result.version);
            setHasSyncError(false);
            setSyncFailureReason(null);
          } else if ('serverData' in result) {
            isConflictedRef.current = true;
            const incoming = { data: result.serverData, version: result.serverVersion };
            incomingUpdateRef.current = incoming;
            setIncomingUpdate(incoming);
            applySyncedVersion(result.serverVersion);
            // The conflict banner takes over from the sync-error banner.
            setHasSyncError(false);
            setSyncFailureReason(null);
          } else {
            setSyncFailureReason(result.reason);
            // Only transport/server failures get a transient retry; a 403
            // won't recover on its own.
            if (result.reason === 'server') {
              setHasSyncError(true);
              retryTimeoutId = setTimeout(() => {
                if (!cancelled) setPutRetryTick((tick) => tick + 1);
              }, SERVER_PUT_RETRY_MS);
            } else {
              setHasSyncError(false);
            }
          }
        },
      );
    }, DEBOUNCE_TIMES.SERVER_PUT);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearTimeout(retryTimeoutId);
    };
  }, [workshop, serverKey, isLoadingFromServer, applySyncedVersion, putRetryTick]);

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
    if (!serverKeyRef.current) return;
    const result = await fetchServerSession(serverKeyRef.current);
    if (!result) return;
    const localVersion = serverVersionRef.current;
    if (result.version > localVersion) {
      const hasLocalUnsavedChanges = isDirtyRef.current;
      onExternalUpdate?.(result.version);
      if (hasLocalUnsavedChanges) {
        isConflictedRef.current = true;
        const incoming = { data: result.data, version: result.version };
        incomingUpdateRef.current = incoming;
        setIncomingUpdate(incoming);
        updateUnsyncedState();
      } else {
        setWorkshop(() => result.data);
        applySyncedVersion(result.version);
      }
    }
  }, [applySyncedVersion, onExternalUpdate, setWorkshop, updateUnsyncedState]);

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
  }, [serverKey, isLoadingFromServer, pollOnce]);

  const enableServerMode = useCallback(async () => {
    setIsEnablingServerMode(true);
    try {
      const { key, version, encryptionKey, writeCapability } = await createServerSession(workshop);
      setKeyToUrl(key, encryptionKey, writeCapability);
      serverKeyRef.current = key;
      setServerKey(key);
      setHasSyncError(false);
      applySyncedVersion(version);

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
        itemCount: workshop.items.length,
        totalDuration: workshop.items.reduce((sum, item) => sum + (item.duration ?? 0), 0),
        type: 'dynamic',
        serverKey: key,
        serverHash: window.location.hash,
      });
    } finally {
      setIsEnablingServerMode(false);
    }
  }, [workshop, applySyncedVersion, currentSessionIdRef, setCurrentSessionId]);

  const disableServerMode = useCallback(async (): Promise<boolean> => {
    if (serverKey) {
      const deleted = await deleteServerSession(serverKey);
      if (!deleted) {
        setHasSyncError(true);
        return false;
      }
    }
    serverKeyRef.current = null;
    setServerKey(null);
    setHasSyncError(false);
    setHasUnsyncedChanges(false);
    setSyncFailureReason(null);
    syncFailureReasonRef.current = null;
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
        itemCount: workshop.items.length,
        totalDuration: workshop.items.reduce((sum, item) => sum + (item.duration ?? 0), 0),
        type: 'local',
        urlHash: encodeWorkshopToUrl(workshop),
      });
    }
    return true;
  }, [workshop, serverKey, currentSessionIdRef]);

  const acceptIncomingUpdate = useCallback(() => {
    const current = incomingUpdateRef.current;
    if (!current) return;
    incomingUpdateRef.current = null;
    setIncomingUpdate(null);
    onExternalUpdate?.(current.version);
    setWorkshop(() => current.data);
    applySyncedVersion(current.version);
    // Accepting discards all local unsynced changes, so any pending
    // sync-error state is resolved with it.
    setHasSyncError(false);
    setSyncFailureReason(null);
    syncFailureReasonRef.current = null;
    isConflictedRef.current = false;
  }, [applySyncedVersion, onExternalUpdate, setWorkshop]);

  const forkSession = useCallback(async () => {
    // A fork from a legacy (unencrypted) Dynamic Link is the migration path
    // to the encrypted format: the fresh encrypted session mirrors the old
    // data. Track the conversion itself, independent of the trigger (share
    // popover "migrate" button or fork action).
    const migratedLegacyLink =
      serverKeyRef.current !== null && isLegacyServerKey(serverKeyRef.current);
    setIsEnablingServerMode(true);
    try {
      const { key, version, encryptionKey, writeCapability } = await createServerSession(workshop);
      if (migratedLegacyLink) {
      }
      const url = new URL(window.location.href);
      url.searchParams.set('id', key);
      url.hash = `k=${encryptionKey}&w=${writeCapability}`;
      window.history.pushState(null, '', url.toString());
      setServerKey(key);
      serverKeyRef.current = key;
      applySyncedVersion(version);
      isConflictedRef.current = false;
      incomingUpdateRef.current = null;
      setIncomingUpdate(null);
      setHasSyncError(false);
      setSyncFailureReason(null);
      syncFailureReasonRef.current = null;
      const now = Date.now();
      const sessionId = generateId();
      setCurrentSessionId(sessionId);
      currentSessionIdRef.current = sessionId;
      upsertSessionToHistory({
        id: sessionId,
        title: workshop.workshop.title,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        itemCount: workshop.items.length,
        totalDuration: workshop.items.reduce((sum, item) => sum + (item.duration ?? 0), 0),
        type: 'dynamic',
        serverKey: key,
        serverHash: window.location.hash,
      });
    } finally {
      setIsEnablingServerMode(false);
    }
  }, [workshop, applySyncedVersion, currentSessionIdRef, setCurrentSessionId]);

  /**
   * Detach a read-only Dynamic Link without touching its server copy. The
   * current in-memory edits become a standalone hash-backed local session.
   */
  const createLocalCopy = useCallback(() => {
    const localHash = encodeWorkshopToUrl(workshop);
    if (!localHash) return;

    const now = Date.now();
    const sessionId = generateId();
    serverKeyRef.current = null;
    setServerKey(null);
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
    setCurrentSessionId(sessionId);
    currentSessionIdRef.current = sessionId;
    upsertSessionToHistory({
      id: sessionId,
      title: workshop.workshop.title,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      itemCount: workshop.items.length,
      totalDuration: workshop.items.reduce((sum, item) => sum + (item.duration ?? 0), 0),
      type: 'local',
      urlHash: localHash,
    });
  }, [workshop, currentSessionIdRef, setCurrentSessionId]);

  const loadServerSession = useCallback((key: string, hash = window.location.hash) => {
    if (!key) return;

    setIsLoadingFromServer(true);

    fetchServerSessionStatus(key, getServerSessionAccess(hash)).then((result) => {
      if (result.status === 'available') {
        setWorkshop(() => result.data);
        serverKeyRef.current = key;
        setServerKey(key);
        setHasSyncError(false);
        setSyncFailureReason(null);
        syncFailureReasonRef.current = null;
        applySyncedVersion(result.version);

        const sessions = getSessionHistory();
        const existing = sessions.find((s) => s.serverKey === key);
        const sessionId = existing?.id ?? generateId();
        const now = Date.now();
        const totalDuration = result.data.items.reduce(
          (sum: number, item) => sum + (item.duration ?? 0),
          0,
        );
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
        upsertSessionToHistory({
          id: sessionId,
          title: result.data.workshop.title,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          lastOpenedAt: now,
          itemCount: result.data.items.length,
          totalDuration,
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
  }, [setWorkshop, applySyncedVersion, setCurrentSessionId, currentSessionIdRef, onSessionNotFound, onSessionUnavailable, updateUnsyncedState, historyHash]);

  return {
    serverKey,
    serverVersion,
    canEditServerSession: !!serverKey && (isLegacyServerKey(serverKey) || !!getServerSessionAccess().writeCapability),
    isLegacyServerSession: !!serverKey && isLegacyServerKey(serverKey),
    isLoadingFromServer,
    isEnablingServerMode,
    incomingUpdate,
    hasUnsyncedChanges,
    hasSyncError,
    syncFailureReason,
    enableServerMode,
    disableServerMode,
    pollNow: pollOnce,
    acceptIncomingUpdate,
    forkSession,
    createLocalCopy,
    markDirty: () => {
      isDirtyRef.current = true;
      updateUnsyncedState();
    },
    loadServerSession,
    resetSyncState,
    getHasUnsavedCloseRisk,
  };
};
