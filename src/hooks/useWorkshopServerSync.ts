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
  updateServerSession,
  deleteServerSession,
  UpdateServerSessionResult,
  getSessionHistory,
  upsertSessionToHistory,
  encodeWorkshopToUrl,
} from '@/lib/workshopStorage';
import { POLLING_INTERVALS, POLLING_AGE_THRESHOLDS, DEBOUNCE_TIMES } from '@/lib/timing';

interface UseWorkshopServerSyncArgs {
  workshop: WorkshopData;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  setWorkshop: (updater: (prev: WorkshopData) => WorkshopData) => void;
  setEmptyWorkshop: () => void;
  navigate: ReturnType<typeof useNavigate>;
  onSessionNotFound?: () => void;
}

export interface WorkshopServerSync {
  serverKey: string | null;
  serverVersion: number;
  isLoadingFromServer: boolean;
  isEnablingServerMode: boolean;
  incomingUpdate: { data: WorkshopData; version: number } | null;
  enableServerMode: () => Promise<void>;
  disableServerMode: () => void;
  pollNow: () => Promise<void>;
  acceptIncomingUpdate: () => void;
  forkSession: () => Promise<void>;
  markDirty: () => void;
  loadServerSession: (key: string) => void;
}

export const useWorkshopServerSync = ({
  workshop,
  currentSessionId,
  setCurrentSessionId,
  currentSessionIdRef,
  setWorkshop,
  setEmptyWorkshop,
  navigate,
  onSessionNotFound,
}: UseWorkshopServerSyncArgs): WorkshopServerSync => {
  const [serverKey, setServerKey] = useState<string | null>(() => getKeyFromSearch());
  const [serverVersion, setServerVersion] = useState<number>(0);
  const [incomingUpdate, setIncomingUpdate] = useState<{ data: WorkshopData; version: number } | null>(null);
  const [isLoadingFromServer, setIsLoadingFromServer] = useState<boolean>(() => !!getKeyFromSearch());
  const [isEnablingServerMode, setIsEnablingServerMode] = useState(false);

  const serverKeyRef = useRef(serverKey);
  serverKeyRef.current = serverKey;
  const serverVersionRef = useRef(serverVersion);
  serverVersionRef.current = serverVersion;
  const lastSyncedVersionRef = useRef(0);
  const activityTimestampRef = useRef(0);
  const isDirtyRef = useRef(false);
  const isConflictedRef = useRef(false);

  const applySyncedVersion = useCallback((version: number) => {
    setServerVersion(version);
    lastSyncedVersionRef.current = version;
    isDirtyRef.current = false;
  }, []);

  // Load workshop from server when a key is present in the URL on initial mount.
  // For navigating between sessions from the UI, loadServerSession() is used instead.
  useEffect(() => {
    const key = getKeyFromSearch();
    if (!key) return;

    let cancelled = false;
    setIsLoadingFromServer(true);

    fetchServerSession(key).then((result) => {
      if (cancelled) return;
      if (result) {
        setWorkshop(() => result.data);
        setServerKey(key);
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
        });
      } else {
        clearKeyFromUrl();
        setServerKey(null);
        setIsLoadingFromServer(false);
        onSessionNotFound?.();
      }
      setIsLoadingFromServer(false);
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync to server when in server mode
  useEffect(() => {
    if (!serverKey || isLoadingFromServer) return;
    if (!isDirtyRef.current) return;
    if (isConflictedRef.current) return;
    const timeoutId = setTimeout(() => {
      updateServerSession(serverKey, workshop, serverVersionRef.current).then(
        (result: UpdateServerSessionResult) => {
          if (result.ok) {
            applySyncedVersion(result.version);
          } else if ('serverData' in result) {
            isConflictedRef.current = true;
            setIncomingUpdate({ data: result.serverData, version: result.serverServerVersion ?? result.serverVersion });
            applySyncedVersion(result.serverServerVersion ?? result.serverVersion);
          }
        },
      );
    }, DEBOUNCE_TIMES.SERVER_PUT);
    return () => clearTimeout(timeoutId);
  }, [workshop, serverKey, isLoadingFromServer, applySyncedVersion]);

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
      if (hasLocalUnsavedChanges) {
        isConflictedRef.current = true;
        setIncomingUpdate({ data: result.data, version: result.version });
      } else {
        setWorkshop(() => result.data);
        applySyncedVersion(result.version);
      }
    }
  }, [applySyncedVersion, setWorkshop]);

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
      const { key, version } = await createServerSession(workshop);
      setKeyToUrl(key);
      setServerKey(key);
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
      });
    } finally {
      setIsEnablingServerMode(false);
    }
  }, [workshop, applySyncedVersion, currentSessionIdRef, setCurrentSessionId]);

  const disableServerMode = useCallback(() => {
    if (serverKey) {
      deleteServerSession(serverKey);
    }
    setServerKey(null);
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
  }, [workshop, serverKey, currentSessionIdRef]);

  const acceptIncomingUpdate = useCallback(() => {
    setIncomingUpdate((current) => {
      if (!current) return current;
      setWorkshop(() => current.data);
      applySyncedVersion(current.version);
      isConflictedRef.current = false;
      return null;
    });
  }, [applySyncedVersion, setWorkshop]);

  const forkSession = useCallback(async () => {
    setIsEnablingServerMode(true);
    try {
      const { key, version } = await createServerSession(workshop);
      const url = new URL(window.location.href);
      url.searchParams.set('id', key);
      url.hash = '';
      window.history.pushState(null, '', url.toString());
      setServerKey(key);
      serverKeyRef.current = key;
      applySyncedVersion(version);
      isConflictedRef.current = false;
      setIncomingUpdate(null);
    } finally {
      setIsEnablingServerMode(false);
    }
  }, [workshop, applySyncedVersion]);

  const loadServerSession = useCallback((key: string) => {
    if (!key) return;

    setIsLoadingFromServer(true);

    fetchServerSession(key).then((result) => {
      if (result) {
        setWorkshop(() => result.data);
        setServerKey(key);
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
        });
      } else {
        clearKeyFromUrl();
        setServerKey(null);
        setIsLoadingFromServer(false);
        onSessionNotFound?.();
      }
      setIsLoadingFromServer(false);
    });
  }, [setWorkshop, applySyncedVersion, setCurrentSessionId, currentSessionIdRef, onSessionNotFound]);

  return {
    serverKey,
    serverVersion,
    isLoadingFromServer,
    isEnablingServerMode,
    incomingUpdate,
    enableServerMode,
    disableServerMode,
    pollNow: pollOnce,
    acceptIncomingUpdate,
    forkSession,
    markDirty: () => {
      isDirtyRef.current = true;
    },
    loadServerSession,
  };
};
