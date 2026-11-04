/**
 * useWorkshop — Master state hook for the workshop planner.
 *
 * Role: Single source of truth for WorkshopData. Handles init priority
 *       (URL hash → prefillData → empty workshop), auto-persists to the session
 *       history + URL hash on every change, and generates share links. All
 *       workshop mutations go through this hook.
 *
 * History rules: saving never adds a browser history entry. Only opening a
 *       session from the list does, closing replaces the entry. The session
 *       history stays reachable either way, so Back always leads to the previous
 *       page. Each browser history entry names its session in `history.state`.
 *       Server-mode state is delegated to useWorkshopServerSync; this hook
 *       composes it and forwards the relevant fields to callers.
 * Used by: WorkshopPlanner, Index, LandingPage
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  WorkshopData,
  WorkshopItem,
  BlockType,
  Person,
  WorkshopPrefillData,
  createEmptyWorkshop,
  generateId,
} from '@/types/workshop';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import {
  getWorkshopFromHash,
  setWorkshopToHash,
  encodeWorkshopToUrl,
  decodeWorkshopFromUrl,
  clearSessionFromUrl,
  createOpenedFromListState,
  getHistorySessionId,
  setHistorySessionId,
  notifySessionUrlChanged,
  wasOpenedFromList,
  getKeyFromSearch,
  getSessionHistory,
  upsertSessionToHistory,
  removeSessionFromHistory,
  updateSessionLastOpened,
  setDayParamInUrl,
} from '@/lib/workshopStorage';
import {
  addDay as addDayToPlan,
  duplicateDay as duplicateDayInPlan,
  removeDay as removeDayFromPlan,
  moveDay as moveDayInPlan,
  updateDayItems,
  updateDayMeta,
  updatePlanMetadata,
  getDay,
  getDays,
  getAllItems,
  getPlanStats,
  hasAnyItems,
  projectDay,
  findDayIdOfItem,
  type DayMetaUpdates,
} from '@/lib/workshop-days';
import {
  updateItemInTree,
  removeItemFromTree,
  updateGroupDurations,
  findItemById,
  findItemAndParent,
} from '@/lib/workshopUtils';
import { useWorkshopServerSync } from './useWorkshopServerSync';
import { useActiveDay } from './useActiveDay';
import type { SessionUnavailableReason } from '@/lib/workshopServer';
import { DEBOUNCE_TIMES } from '@/lib/timing';
import { formatTitle } from '@/lib/metaConfig';
import { getLocaleRoot } from '@/lib/localeUtils';
import { getLocaleFromPathname } from '@/lib/i18n';

const UNDO_LIMIT = 20;
const UNDO_COALESCE_MS = 500;

const createWorkshopFromPrefill = (prefillData: WorkshopPrefillData) => {
  const emptyWorkshop = createEmptyWorkshop();

  return {
    ...emptyWorkshop,
    workshop: {
      ...emptyWorkshop.workshop,
      title: prefillData?.workshopTitle || emptyWorkshop.workshop.title,
      description: prefillData?.workshopDescription || emptyWorkshop.workshop.description,
      date: prefillData?.date !== undefined ? prefillData.date : emptyWorkshop.workshop.date,
      startTime: prefillData?.startTime !== undefined ? prefillData.startTime : emptyWorkshop.workshop.startTime,
      targetDuration: prefillData?.targetDuration,
      durationLocked: prefillData?.durationLocked,
    },
    blockTypes:
      prefillData?.blockTypes && prefillData.blockTypes.length > 0
        ? [...prefillData.blockTypes]
        : emptyWorkshop.blockTypes,
    persons:
      prefillData?.persons && prefillData.persons.length > 0
        ? [...prefillData.persons]
        : emptyWorkshop.persons,
    items:
      prefillData?.items && prefillData.items.length > 0
        ? [...prefillData.items]
        : emptyWorkshop.items,
    ...(prefillData?.days && { days: prefillData.days }),
  };
};

/**
 * The local session the current URL shows. A browser history entry that names
 * its session gets the latest state from the session history, as its own hash
 * may be older. A snapshot without one only matches an identical entry, so
 * opening it can never overwrite a different session.
 */
const resolveSessionFromUrl = (): { data: WorkshopData; sessionId: string | null } | null => {
  if (getKeyFromSearch()) return null;
  const fromHash = getWorkshopFromHash();
  if (!hasAnyItems(fromHash)) return null;

  const sessions = getSessionHistory();
  const sessionId = getHistorySessionId();
  const entry = sessions.find((s) => s.id === sessionId);
  if (sessionId && entry?.type !== 'dynamic') {
    const stored = entry?.urlHash ? decodeWorkshopFromUrl(entry.urlHash) : null;
    return { data: hasAnyItems(stored) ? stored : fromHash, sessionId };
  }

  const encoded = window.location.hash.substring('#data='.length);
  const identical = sessions.find((s) => s.type === 'local' && s.urlHash === encoded);
  return { data: fromHash, sessionId: identical?.id ?? null };
};

export const useWorkshop = (prefillData?: WorkshopPrefillData) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [sessionFromUrl] = useState(resolveSessionFromUrl);

  const [workshop, setWorkshopState] = useState<WorkshopData>(() => {
    if (getKeyFromSearch()) {
      return createEmptyWorkshop();
    }
    if (sessionFromUrl) {
      return sessionFromUrl.data;
    }
    if (prefillData) {
      return createWorkshopFromPrefill(prefillData);
    }
    return createEmptyWorkshop();
  });

  // The setWorkshop wrapper ensures server-sync can also write the workshop
  // state. We type-narrow to allow both a value and a function updater.
  const setWorkshop = useCallback((updater: WorkshopData | ((prev: WorkshopData) => WorkshopData)) => {
    setWorkshopState((prev) => (typeof updater === 'function' ? (updater as (p: WorkshopData) => WorkshopData)(prev) : updater));
  }, []);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionFromUrl?.sessionId ?? null);
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [sessionUnavailable, setSessionUnavailable] = useState<SessionUnavailableReason | null>(null);

  const workshopRef = useRef(workshop);
  workshopRef.current = workshop;

  const workshopEntryHandledRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const undoStackRef = useRef<WorkshopData[]>([]);
  const redoStackRef = useRef<WorkshopData[]>([]);
  const lastUndoRecordRef = useRef<{ key: string; at: number } | null>(null);
  const recordExternalUpdateRef = useRef<(version: number) => void>(() => {});
  const onExternalUpdate = useCallback((version: number) => {
    recordExternalUpdateRef.current(version);
  }, []);

  const itemEditDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const metadataEditDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const titleChangeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(
    () => () => {
      if (itemEditDebounceRef.current) clearTimeout(itemEditDebounceRef.current);
      if (metadataEditDebounceRef.current) clearTimeout(metadataEditDebounceRef.current);
      if (titleChangeDebounceRef.current) clearTimeout(titleChangeDebounceRef.current);
    },
    [],
  );

  useEffect(() => {
    workshopEntryHandledRef.current = false;
  }, [location.pathname]);

  // Restore priority when entering workshop page
  useEffect(() => {
    if (workshopEntryHandledRef.current) return;
    workshopEntryHandledRef.current = true;

    const fromUrl = resolveSessionFromUrl();
    if (fromUrl) {
      setWorkshopState(fromUrl.data);
      setCurrentSessionId(fromUrl.sessionId);
      currentSessionIdRef.current = fromUrl.sessionId;
      return;
    }

    if (prefillData && !hasAnyItems(workshopRef.current)) {
      setWorkshopState(createWorkshopFromPrefill(prefillData));
    }
  }, [location.pathname, prefillData]);

  const sync = useWorkshopServerSync({
    workshop,
    setCurrentSessionId,
    currentSessionIdRef,
    setWorkshop,
    onExternalUpdate,
    onSessionNotFound: () => setSessionNotFound(true),
    onSessionUnavailable: (reason) => setSessionUnavailable(reason),
  });

  const { loadServerSession } = sync;

  const { activeDayId, activeDayRef, setActiveDay, resetDaySelection, showChangedDay } = useActiveDay(
    workshop,
    sync.isLoadingFromServer,
  );

  const serverKeyRef = useRef(sync.serverKey);
  serverKeyRef.current = sync.serverKey;

  const writeSessionToUrl = useCallback((data: WorkshopData) => {
    // A Dynamic Link opened from the list has no server key yet while it loads.
    if (getKeyFromSearch()) return;
    setWorkshopToHash(data);
    setHistorySessionId(hasAnyItems(data) ? currentSessionIdRef.current : null);
  }, []);

  // Update hash when workshop changes (with debounce)
  useEffect(() => {
    if (!sync.serverKey) {
      const timeoutId = setTimeout(() => writeSessionToUrl(workshop), DEBOUNCE_TIMES.HASH_WRITE);
      return () => clearTimeout(timeoutId);
    }
  }, [workshop, location.pathname, sync.serverKey, writeSessionToUrl]);

  /**
   * Write a local session to the session history. A dynamic entry holds its
   * link's secrets, so local data only ever goes into an entry of its own.
   */
  const saveLocalSession = useCallback((data: WorkshopData) => {
    let sessionId = currentSessionIdRef.current;
    let existing = getSessionHistory().find((s) => s.id === sessionId);
    if (!sessionId || existing?.type === 'dynamic') {
      sessionId = generateId();
      existing = undefined;
      setCurrentSessionId(sessionId);
      currentSessionIdRef.current = sessionId;
    }

    const now = Date.now();
    upsertSessionToHistory({
      id: sessionId,
      title: data.workshop.title,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastOpenedAt: now,
      ...getPlanStats(data),
      type: 'local',
      urlHash: encodeWorkshopToUrl(data),
    });
  }, []);

  const flushPendingSave = useCallback(() => {
    if (!pendingSaveRef.current) return;
    pendingSaveRef.current = false;
    saveLocalSession(workshopRef.current);
  }, [saveLocalSession]);

  // Maintain the session history
  useEffect(() => {
    pendingSaveRef.current = false;
    if (sync.serverKey || !hasAnyItems(workshop)) return;

    pendingSaveRef.current = true;
    const timeoutId = setTimeout(() => {
      pendingSaveRef.current = false;
      saveLocalSession(workshop);
    }, DEBOUNCE_TIMES.SESSION_SAVE);

    return () => clearTimeout(timeoutId);
  }, [workshop, sync.serverKey, saveLocalSession]);

  // In-app navigation away from the planner must not drop the last edit.
  useEffect(() => flushPendingSave, [flushPendingSave]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!serverKeyRef.current) {
        flushPendingSave();
        writeSessionToUrl(workshopRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushPendingSave, writeSessionToUrl]);

  // Mark workshop as dirty when a mutation runs. We can't intercept setWorkshop
  // directly, so this is a sentinel the mutations themselves must flip.
  const markDirty = sync.markDirty;

  const clearUndoHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastUndoRecordRef.current = null;
  }, []);

  const leaveServerSession = sync.leaveServerSession;

  // React to browser back/forward navigation (popstate).
  useEffect(() => {
    const handlePopState = () => {
      const key = getKeyFromSearch();
      if (key) {
        if (key !== serverKeyRef.current) {
          // The server sync only reads ?id= when it mounts.
          window.location.reload();
        }
        return;
      }

      flushPendingSave();
      leaveServerSession();
      clearUndoHistory();
      resetDaySelection();
      const fromUrl = resolveSessionFromUrl();
      setWorkshopState(fromUrl?.data ?? createEmptyWorkshop());
      setCurrentSessionId(fromUrl?.sessionId ?? null);
      currentSessionIdRef.current = fromUrl?.sessionId ?? null;
      notifySessionUrlChanged();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [clearUndoHistory, flushPendingSave, leaveServerSession, resetDaySelection]);

  const recordUndoState = useCallback((previous: WorkshopData, key = 'mutation') => {
    const now = Date.now();
    const last = lastUndoRecordRef.current;
    redoStackRef.current = [];
    if (last?.key === key && now - last.at < UNDO_COALESCE_MS) return;

    // React may invoke state updaters more than once in development. Avoid
    // recording the same immutable state twice in that case.
    if (undoStackRef.current[undoStackRef.current.length - 1] === previous) return;

    undoStackRef.current = [...undoStackRef.current.slice(-(UNDO_LIMIT - 1)), previous];
    lastUndoRecordRef.current = { key, at: now };
  }, []);

  recordExternalUpdateRef.current = (version: number) => {
    recordUndoState(workshopRef.current, `external:${version}`);
  };

  const withLastModified = useCallback(
    (data: WorkshopData, historyKey = 'mutation'): WorkshopData => {
      recordUndoState(workshopRef.current, historyKey);
      markDirty();
      return {
        ...data,
        workshop: {
          ...data.workshop,
          lastModified: new Date().toISOString(),
        },
      };
    },
    [markDirty, recordUndoState],
  );

  const updateMetadata = useCallback(
    (updates: Partial<WorkshopData['workshop']>) => {
      const changedAttributes = Object.keys(updates).join(', ');
      if (changedAttributes) {
        if (metadataEditDebounceRef.current) {
          clearTimeout(metadataEditDebounceRef.current);
        }
        metadataEditDebounceRef.current = setTimeout(() => {
          metadataEditDebounceRef.current = null;
        }, DEBOUNCE_TIMES.EDIT_DEBOUNCE);
      }
      // After the LAST change of the session title, only run the deferred
      // title handling once the title has settled (truthy format checks).
      if (typeof updates.title === 'string' && updates.title.length > 0) {
        const newTitle = updates.title;
        if (titleChangeDebounceRef.current) {
          clearTimeout(titleChangeDebounceRef.current);
        }
        titleChangeDebounceRef.current = setTimeout(() => {
          titleChangeDebounceRef.current = null;
        }, DEBOUNCE_TIMES.TITLE_CHANGE);
      }
      // Description, date, start time and target belong to the active day;
      // the title stays plan-wide.
      setWorkshopState((prev) =>
        withLastModified(updatePlanMetadata(prev, activeDayRef.current, updates), 'metadata'),
      );
    },
    [withLastModified, activeDayRef],
  );

  const addItem = useCallback(
    (item: Omit<WorkshopItem, 'id'>, parentId?: string) => {
      const newItem: WorkshopItem = { ...item, id: generateId() };

      setWorkshopState((prev) => {
        const dayId = (parentId && findDayIdOfItem(prev, parentId)) || activeDayRef.current;
        const next = updateDayItems(prev, dayId, (dayItems) => {
          let updatedItems = dayItems;

          if (parentId) {
            const addToParent = (items: WorkshopItem[]): WorkshopItem[] => {
              return items.map((i) => {
                if (i.id === parentId) {
                  return { ...i, children: [...(i.children || []), newItem] };
                }
                if (i.children) {
                  return { ...i, children: addToParent(i.children) };
                }
                return i;
              });
            };
            updatedItems = addToParent(dayItems);
          } else {
            updatedItems = [...dayItems, newItem];
          }

          return updateGroupDurations(updatedItems);
        });
        return withLastModified(next);
      });

      return newItem.id;
    },
    [withLastModified, activeDayRef],
  );

  const insertItemAfter = useCallback(
    (afterId: string, newItem: Omit<WorkshopItem, 'id'>): string | null => {
      // The state updater may run asynchronously. Validate the reference before
      // scheduling the update so the generated ID can be returned synchronously.
      if (!findItemById(getAllItems(workshopRef.current), afterId)) return null;

      const generated: WorkshopItem = { ...newItem, id: generateId() };

      setWorkshopState((prev) => {
        const dayId = findDayIdOfItem(prev, afterId);
        if (!dayId) return prev;
        const dayItems = getDay(prev, dayId).items;
        const { parentId } = findItemAndParent(dayItems, afterId);
        const reference = findItemById(dayItems, afterId);
        if (!reference) return prev;

        let finalItem: WorkshopItem = generated;
        if (parentId) {
          const parent = findItemById(dayItems, parentId);
          if (parent?.type === 'breakout' && generated.laneIndex === undefined) {
            finalItem = { ...generated, laneIndex: reference.laneIndex ?? 0 };
          }
        }

        const insertInto = (items: WorkshopItem[]): WorkshopItem[] => {
          const idx = items.findIndex((i) => i.id === afterId);
          if (idx !== -1) {
            const next = [...items];
            next.splice(idx + 1, 0, finalItem);
            return next;
          }
          return items.map((i) => {
            if (!i.children) return i;
            const updatedChildren = insertInto(i.children);
            if (updatedChildren !== i.children) {
              return { ...i, children: updatedChildren };
            }
            return i;
          });
        };

        const updatedItems = updateGroupDurations(insertInto(dayItems));
        return withLastModified(updateDayItems(prev, dayId, () => updatedItems));
      });

      return generated.id;
    },
    [withLastModified],
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<WorkshopItem>) => {
      setWorkshopState((prev) => {
        const findItem = (items: WorkshopItem[]): WorkshopItem | null => {
          for (const item of items) {
            if (item.id === id) return item;
            if (item.children) {
              const found = findItem(item.children);
              if (found) return found;
            }
          }
          return null;
        };

        const item = findItem(getAllItems(prev));
        // Live Mode may extend a block of a day other than the visible one.
        const dayId = findDayIdOfItem(prev, id) ?? activeDayRef.current;

        if (item) {
          if (itemEditDebounceRef.current) {
            clearTimeout(itemEditDebounceRef.current);
          }

          itemEditDebounceRef.current = setTimeout(() => {
            const changedAttributes = Object.keys(updates).join(', ');
            if (item.type === 'block') {
            } else if (item.type === 'group') {
            } else if (item.type === 'breakout') {
            }
            itemEditDebounceRef.current = null;
          }, DEBOUNCE_TIMES.EDIT_DEBOUNCE);
        }

        const next = updateDayItems(prev, dayId, (items) =>
          updateGroupDurations(updateItemInTree(items, id, updates)),
        );
        return withLastModified(next, `item:${id}`);
      });
    },
    [withLastModified, activeDayRef],
  );

  const deleteItem = useCallback(
    (id: string) => {
      setWorkshopState((prev) => {
        const findItemType = (items: WorkshopItem[]): string | null => {
          for (const item of items) {
            if (item.id === id) return item.type;
            if (item.children) {
              const found = findItemType(item.children);
              if (found) return found;
            }
          }
          return null;
        };

        const itemType = findItemType(getAllItems(prev));
        const dayId = findDayIdOfItem(prev, id) ?? activeDayRef.current;

        if (itemType === 'block') {
        } else if (itemType === 'group') {
        } else if (itemType === 'breakout') {
        }

        const next = updateDayItems(prev, dayId, (items) =>
          updateGroupDurations(removeItemFromTree(items, id)),
        );
        return withLastModified(next);
      });
    },
    [withLastModified, activeDayRef],
  );

  const reorderItems = useCallback(
    (newItems: WorkshopItem[]) => {
      setWorkshopState((prev) => {
        const updatedItems = updateGroupDurations(newItems);
        return withLastModified(updateDayItems(prev, activeDayRef.current, () => updatedItems));
      });
    },
    [withLastModified, activeDayRef],
  );

  const moveItem = useCallback(
    (
      itemId: string,
      targetParentId: string | null,
      targetIndex?: number,
      additionalUpdates?: Partial<WorkshopItem>,
    ) => {
      setWorkshopState((prev) => {
        const dayId = findDayIdOfItem(prev, itemId);
        if (!dayId) return prev;
        const dayItems = getDay(prev, dayId).items;
        let movedItem: WorkshopItem | null = null;

        const removeItem = (items: WorkshopItem[]): WorkshopItem[] => {
          const result: WorkshopItem[] = [];
          for (const item of items) {
            if (item.id === itemId) {
              movedItem = item;
              continue;
            }
            if (item.children) {
              const newChildren = removeItem(item.children);
              result.push({ ...item, children: newChildren });
            } else {
              result.push(item);
            }
          }
          return result;
        };

        const itemsWithoutMoved = removeItem(dayItems);

        if (!movedItem) return prev;

        if (additionalUpdates) {
          movedItem = { ...movedItem, ...additionalUpdates };
        }

        let placedItems: WorkshopItem[];

        if (targetParentId === null) {
          const targetIdx = targetIndex ?? itemsWithoutMoved.length;
          const newItems = [...itemsWithoutMoved];
          newItems.splice(targetIdx, 0, movedItem);
          placedItems = newItems;
        } else {
          const addToParent = (items: WorkshopItem[]): WorkshopItem[] => {
            return items.map((item) => {
              if (item.id === targetParentId && item.children) {
                const targetIdx = targetIndex ?? item.children.length;
                const newChildren = [...item.children];
                newChildren.splice(targetIdx, 0, movedItem!);
                return { ...item, children: newChildren };
              }
              if (item.children) {
                return { ...item, children: addToParent(item.children) };
              }
              return item;
            });
          };
          placedItems = addToParent(itemsWithoutMoved);
        }

        const updatedItems = updateGroupDurations(placedItems);

        if (movedItem.type === 'block') {
        } else if (movedItem.type === 'group') {
        } else if (movedItem.type === 'breakout') {
        }

        return withLastModified(updateDayItems(prev, dayId, () => updatedItems));
      });
    },
    [withLastModified],
  );

  const addBlockType = useCallback(
    (blockType: Omit<BlockType, 'id'>) => {
      const newType: BlockType = { ...blockType, id: generateId() };
      setWorkshopState((prev) =>
        withLastModified({
          ...prev,
          blockTypes: [...prev.blockTypes, newType],
        }),
      );
      return newType.id;
    },
    [withLastModified],
  );

  const updateBlockType = useCallback(
    (id: string, updates: Partial<BlockType>) => {
      setWorkshopState((prev) => {
        const blockType = prev.blockTypes.find((bt) => bt.id === id);
        const updated = withLastModified({
          ...prev,
          blockTypes: prev.blockTypes.map((bt) =>
            bt.id === id ? { ...bt, ...updates } : bt,
          ),
        });
        if (blockType) {
        }
        return updated;
      });
    },
    [withLastModified],
  );

  const deleteBlockType = useCallback(
    (id: string) => {
      setWorkshopState((prev) => {
        const blockType = prev.blockTypes.find((bt) => bt.id === id);
        const updated = withLastModified({
          ...prev,
          blockTypes: prev.blockTypes.filter((bt) => bt.id !== id),
        });
        if (blockType) {
        }
        return updated;
      });
    },
    [withLastModified],
  );

  const addPerson = useCallback(
    (person: Omit<Person, 'id'>) => {
      const newPerson: Person = { ...person, id: generateId() };
      setWorkshopState((prev) =>
        withLastModified({
          ...prev,
          persons: [...(prev.persons || []), newPerson],
        }),
      );
      return newPerson.id;
    },
    [withLastModified],
  );

  const updatePerson = useCallback(
    (id: string, updates: Partial<Person>) => {
      setWorkshopState((prev) =>
        withLastModified({
          ...prev,
          persons: (prev.persons || []).map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        }),
      );
    },
    [withLastModified],
  );

  const deletePerson = useCallback(
    (id: string) => {
      setWorkshopState((prev) =>
        withLastModified({
          ...prev,
          persons: (prev.persons || []).filter((p) => p.id !== id),
        }),
      );
    },
    [withLastModified],
  );

  const loadWorkshop = useCallback((data: WorkshopData) => {
    if (hasAnyItems(workshop) && !sync.serverKey) {
      saveLocalSession(workshop);
    }
    pendingSaveRef.current = false;
    resetDaySelection();
    setDayParamInUrl(null);
    setWorkshopState(data);
    clearUndoHistory();
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    setHistorySessionId(null);
  }, [workshop, sync.serverKey, saveLocalSession, clearUndoHistory, resetDaySelection]);

  const addDay = useCallback((): string | null => {
    const result = addDayToPlan(workshopRef.current, getDays(workshopRef.current).at(-1)?.id);
    if (!result) return null;
    setWorkshopState(withLastModified(result.data, `day-add:${result.dayId}`));
    setActiveDay(result.dayId);
    return result.dayId;
  }, [withLastModified, setActiveDay]);

  const duplicateDay = useCallback((dayId: string): string | null => {
    const result = duplicateDayInPlan(workshopRef.current, dayId);
    if (!result) return null;
    setWorkshopState(withLastModified(result.data, `day-add:${result.dayId}`));
    setActiveDay(result.dayId);
    return result.dayId;
  }, [withLastModified, setActiveDay]);

  const removeDay = useCallback((dayId: string) => {
    const current = workshopRef.current;
    const days = getDays(current);
    const index = days.findIndex((day) => day.id === dayId);
    if (index === -1 || days.length <= 1) return;
    const neighbour = days[index + 1] ?? days[index - 1];
    setWorkshopState(withLastModified(removeDayFromPlan(current, dayId), `day-remove:${dayId}`));
    if (dayId === activeDayRef.current) setActiveDay(neighbour.id);
  }, [withLastModified, setActiveDay, activeDayRef]);

  const moveDay = useCallback((dayId: string, toIndex: number) => {
    const current = workshopRef.current;
    const next = moveDayInPlan(current, dayId, toIndex);
    if (next === current) return;
    setWorkshopState(withLastModified(next, `day-move:${dayId}`));
  }, [withLastModified]);

  const updateDay = useCallback((dayId: string, updates: DayMetaUpdates) => {
    setWorkshopState((prev) => withLastModified(updateDayMeta(prev, dayId, updates), `day:${dayId}`));
  }, [withLastModified]);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return false;

    redoStackRef.current = [...redoStackRef.current.slice(-(UNDO_LIMIT - 1)), workshopRef.current];
    lastUndoRecordRef.current = null;
    showChangedDay(workshopRef.current, previous);
    setWorkshopState(previous);
    workshopRef.current = previous;
    markDirty();
    return true;
  }, [markDirty, showChangedDay]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return false;

    undoStackRef.current = [...undoStackRef.current.slice(-(UNDO_LIMIT - 1)), workshopRef.current];
    lastUndoRecordRef.current = null;
    showChangedDay(workshopRef.current, next);
    setWorkshopState(next);
    workshopRef.current = next;
    markDirty();
    return true;
  }, [markDirty, showChangedDay]);

  const resetWorkshop = useCallback(({ navigatesAway = false }: { navigatesAway?: boolean } = {}) => {
    flushPendingSave();
    resetDaySelection();
    setWorkshopState(createEmptyWorkshop());
    clearUndoHistory();
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    // The entry before one opened from the list already is this empty state.
    if (!navigatesAway && wasOpenedFromList()) window.history.back();
    else clearSessionFromUrl();
  }, [clearUndoHistory, flushPendingSave, resetDaySelection]);

  const clearWorkshopCompletely = useCallback(() => {
    pendingSaveRef.current = false;
    resetDaySelection();
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      removeSessionFromHistory(sessionId);
    }
    setWorkshopState(createEmptyWorkshop());
    clearUndoHistory();
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    clearSessionFromUrl();
  }, [clearUndoHistory, resetDaySelection]);

  const localeRoot = getLocaleRoot(getLocaleFromPathname(location.pathname));

  const loadSessionFromHistory = useCallback(
    (entry: SessionHistoryEntry) => {
      clearUndoHistory();
      resetDaySelection();
      updateSessionLastOpened(entry.id);
      if (entry.type === 'dynamic' && entry.serverKey) {
        navigate(`${localeRoot}?id=${entry.serverKey}${entry.serverHash ?? ''}`, {
          state: createOpenedFromListState(),
        });
        loadServerSession(entry.serverKey, entry.serverHash);
        return;
      }

      if (entry.type === 'local' && entry.urlHash) {
        const data = decodeWorkshopFromUrl(entry.urlHash);
        if (data) {
          window.history.pushState(createOpenedFromListState(entry.id), '', window.location.pathname);
          setWorkshopState(data);
          setWorkshopToHash(data);
          setCurrentSessionId(entry.id);
          currentSessionIdRef.current = entry.id;
        }
      }
    },
    [navigate, localeRoot, loadServerSession, clearUndoHistory, resetDaySelection],
  );

  const days = useMemo(() => getDays(workshop), [workshop]);
  const dayWorkshop = useMemo(() => projectDay(workshop, activeDayId), [workshop, activeDayId]);

  const migrateServerSession = sync.migrateLegacySession;
  const migrateLegacySession = useCallback(async () => {
    const url = await migrateServerSession();
    if (url) clearUndoHistory();
    return url;
  }, [migrateServerSession, clearUndoHistory]);

  return {
    workshop,
    /** The active day as a regular single-day plan (the full plan when single-day). */
    dayWorkshop,
    days,
    activeDayId,
    setActiveDay,
    addDay,
    duplicateDay,
    removeDay,
    moveDay,
    updateDay,
    updateMetadata,
    addItem,
    insertItemAfter,
    updateItem,
    deleteItem,
    reorderItems,
    moveItem,
    addBlockType,
    updateBlockType,
    deleteBlockType,
    addPerson,
    updatePerson,
    deletePerson,
    loadWorkshop,
    resetWorkshop,
    clearWorkshopCompletely,
    loadSessionFromHistory,
    sessionNotFound,
    clearSessionNotFound: () => setSessionNotFound(false),
    sessionUnavailable,
    clearSessionUnavailable: () => setSessionUnavailable(null),
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    serverKey: sync.serverKey,
    canEditServerSession: sync.canEditServerSession,
    isLegacyServerSession: sync.isLegacyServerSession,
    isLoadingFromServer: sync.isLoadingFromServer,
    isServerSessionLoaded: sync.isServerSessionLoaded,
    isEnablingServerMode: sync.isEnablingServerMode,
    enableServerMode: sync.enableServerMode,
    disableServerMode: sync.disableServerMode,
    pollNow: sync.pollNow,
    incomingUpdate: sync.incomingUpdate,
    hasUnsyncedChanges: sync.hasUnsyncedChanges,
    hasSyncError: sync.hasSyncError,
    syncFailureReason: sync.syncFailureReason,
    acceptIncomingUpdate: sync.acceptIncomingUpdate,
    setHasPendingFormEdits: sync.setHasPendingFormEdits,
    legacyMigrationStatus: sync.legacyMigrationStatus,
    migrateLegacySession,
    createLocalCopy: sync.createLocalCopy,
    resetSyncState: sync.resetSyncState,
    getHasUnsavedCloseRisk: sync.getHasUnsavedCloseRisk,
  };
};
