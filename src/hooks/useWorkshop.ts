/**
 * useWorkshop — Master state hook for the workshop planner.
 *
 * Role: Single source of truth for WorkshopData. Handles init priority
 *       (URL hash → prefillData → localStorage temp save → empty workshop),
 *       auto-persists to localStorage + URL hash on every change, and
 *       generates share links. All workshop mutations go through this hook.
 *       Server-mode state is delegated to useWorkshopServerSync; this hook
 *       composes it and forwards the relevant fields to callers.
 * Used by: WorkshopPlanner, Index, LandingPage
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  WorkshopData,
  WorkshopItem,
  BlockType,
  Person,
  createEmptyWorkshop,
  generateId,
} from '@/types/workshop';
import { LandingPageContent } from '@/types/landingPage';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import {
  getWorkshopFromHash,
  hasWorkshopItems,
  setWorkshopToHash,
  encodeWorkshopToUrl,
  decodeWorkshopFromUrl,
  getTempWorkshop,
  getTempWorkshopStore,
  saveTempWorkshop,
  clearTempWorkshop,
  shouldRestoreTempWorkshopOnEntry,
  clearTempWorkshopRestoreMarker,
  getKeyFromSearch,
  clearKeyFromUrl,
  getSessionHistory,
  upsertSessionToHistory,
  removeSessionFromHistory,
  updateSessionLastOpened,
} from '@/lib/workshopStorage';
import {
  updateItemInTree,
  removeItemFromTree,
  updateGroupDurations,
  findItemById,
  findItemAndParent,
} from '@/lib/workshopUtils';
import { useWorkshopServerSync } from './useWorkshopServerSync';
import { DEBOUNCE_TIMES } from '@/lib/timing';

const createWorkshopFromPrefill = (prefillData: LandingPageContent['prefillData']) => {
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
  };
};

const hasUrlData = (): boolean =>
  window.location.hash.startsWith('#data=') || window.location.search.includes('id=');

const stripDataFromUrl = () => {
  if (hasUrlData()) {
    window.history.pushState(null, '', window.location.pathname);
  } else {
    window.history.replaceState(null, '', window.location.pathname);
  }
};

export const useWorkshop = (prefillData?: LandingPageContent['prefillData']) => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasPrefillData = !!prefillData;

  const isWorkshopPage = useCallback(() => {
    if (location.pathname === '/') return true;
    if (location.pathname === '/en') return true;
    const exactNonWorkshop = [
      '/templates', '/en/templates', '/blog', '/en/blog',
      '/impressum', '/datenschutz', '/landing-pages', '/en/landing-pages',
    ];
    if (exactNonWorkshop.includes(location.pathname)) return false;
    if (location.pathname.startsWith('/blog/') || location.pathname.startsWith('/en/blog/')) return false;
    return true;
  }, [location.pathname]);

  const [workshop, setWorkshopState] = useState<WorkshopData>(() => {
    if (getKeyFromSearch()) {
      return createEmptyWorkshop();
    }
    const fromHash = getWorkshopFromHash();
    if (hasWorkshopItems(fromHash)) {
      return fromHash;
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

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    if (hasWorkshopItems(getWorkshopFromHash())) {
      return getTempWorkshopStore()?.sessionId ?? null;
    }
    return null;
  });
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  const [sessionNotFound, setSessionNotFound] = useState(false);

  const workshopRef = useRef(workshop);
  workshopRef.current = workshop;
  const workshopEntryHandledRef = useRef(false);

  const debounceTrackingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metadataTrackingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(
    () => () => {
      if (debounceTrackingTimeoutRef.current) clearTimeout(debounceTrackingTimeoutRef.current);
      if (metadataTrackingTimeoutRef.current) clearTimeout(metadataTrackingTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    workshopEntryHandledRef.current = false;
  }, [location.pathname]);

  // Restore priority when entering workshop page
  useEffect(() => {
    if (!isWorkshopPage()) return;
    if (workshopEntryHandledRef.current) return;
    workshopEntryHandledRef.current = true;

    const fromHash = getWorkshopFromHash();
    if (hasWorkshopItems(fromHash)) {
      setWorkshopState(fromHash);
      clearTempWorkshopRestoreMarker();
      return;
    }

    const fromTemp = getTempWorkshop();
    const shouldRestoreFromTemp = shouldRestoreTempWorkshopOnEntry();

    if (shouldRestoreFromTemp && fromTemp && !hasPrefillData) {
      setWorkshopState(fromTemp);
      clearTempWorkshopRestoreMarker();
      const storedId = getTempWorkshopStore()?.sessionId;
      if (storedId) {
        setCurrentSessionId(storedId);
        currentSessionIdRef.current = storedId;
      }
      return;
    }

    clearTempWorkshopRestoreMarker();

    if (prefillData && workshopRef.current.items.length === 0) {
      setWorkshopState(createWorkshopFromPrefill(prefillData));
    }
  }, [location.pathname, isWorkshopPage, hasPrefillData, prefillData]);

  const sync = useWorkshopServerSync({
    workshop,
    currentSessionId,
    setCurrentSessionId,
    currentSessionIdRef,
    setWorkshop,
    setEmptyWorkshop: () => setWorkshopState(createEmptyWorkshop()),
    navigate,
    onSessionNotFound: () => setSessionNotFound(true),
  });

  // Update hash when workshop changes (on workshop pages with debounce)
  useEffect(() => {
    if (isWorkshopPage() && !sync.serverKey) {
      const timeoutId = setTimeout(() => {
        const currentlyHasHash = window.location.hash.startsWith('#data=');
        if (!currentlyHasHash && hasWorkshopItems(workshop)) {
          window.history.pushState(null, '', window.location.href);
        }
        setWorkshopToHash(workshop);
      }, DEBOUNCE_TIMES.HASH_WRITE);
      return () => clearTimeout(timeoutId);
    }
  }, [workshop, location.pathname, isWorkshopPage, sync.serverKey]);

  // Keep temporary storage fresh and maintain session history
  useEffect(() => {
    if (!isWorkshopPage()) return;
    if (workshop.items.length === 0) return;

    const timeoutId = setTimeout(() => {
      let sessionId = currentSessionIdRef.current;
      if (!sessionId) {
        sessionId = generateId();
        setCurrentSessionId(sessionId);
        currentSessionIdRef.current = sessionId;
      }

      saveTempWorkshop(workshop, sessionId);

      if (!sync.serverKey) {
        const totalDuration = workshop.items.reduce((sum, item) => sum + (item.duration ?? 0), 0);
        const now = Date.now();
        const existing = getSessionHistory().find((s) => s.id === sessionId);
        upsertSessionToHistory({
          id: sessionId,
          title: workshop.workshop.title,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          lastOpenedAt: now,
          itemCount: workshop.items.length,
          totalDuration,
          type: 'local',
          urlHash: encodeWorkshopToUrl(workshop),
        });
      }
    }, DEBOUNCE_TIMES.TEMP_SAVE);

    return () => clearTimeout(timeoutId);
  }, [workshop, isWorkshopPage, sync.serverKey]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isWorkshopPage()) {
        setWorkshopToHash(workshop);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [workshop, location.pathname, isWorkshopPage]);

  // React to browser back/forward navigation (popstate).
  useEffect(() => {
    const handlePopState = () => {
      const key = getKeyFromSearch();
      const fromHash = getWorkshopFromHash();

      if (key) {
        if (key !== sync.serverKey) {
          // Re-trigger server load by updating the URL search param
          // The server sync watches ?id=; a new key will load itself.
          // For now, force a reload by navigating to the same URL.
          window.location.reload();
        }
      } else if (hasWorkshopItems(fromHash)) {
        setWorkshopState(fromHash);
        clearTempWorkshopRestoreMarker();
      } else {
        setWorkshopState(createEmptyWorkshop());
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [sync.serverKey]);

  // Mark workshop as dirty when a mutation runs. We can't intercept setWorkshop
  // directly, so this is a sentinel the mutations themselves must flip.
  const markDirty = sync.markDirty;

  const withLastModified = useCallback(
    (data: WorkshopData): WorkshopData => {
      markDirty();
      return {
        ...data,
        workshop: {
          ...data.workshop,
          lastModified: new Date().toISOString(),
        },
      };
    },
    [markDirty],
  );

  const updateMetadata = useCallback(
    (updates: Partial<WorkshopData['workshop']>) => {
      const changedAttributes = Object.keys(updates).join(', ');
      if (changedAttributes) {
        if (metadataTrackingTimeoutRef.current) {
          clearTimeout(metadataTrackingTimeoutRef.current);
        }
        metadataTrackingTimeoutRef.current = setTimeout(() => {
          metadataTrackingTimeoutRef.current = null;
        }, DEBOUNCE_TIMES.METADATA_TRACKING);
      }
      setWorkshopState((prev) =>
        withLastModified({
          ...prev,
          workshop: { ...prev.workshop, ...updates },
        }),
      );
    },
    [withLastModified],
  );

  const addItem = useCallback(
    (item: Omit<WorkshopItem, 'id'>, parentId?: string) => {
      const newItem: WorkshopItem = { ...item, id: generateId() };

      setWorkshopState((prev) => {
        let updatedItems = prev.items;

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
          updatedItems = addToParent(prev.items);
        } else {
          updatedItems = [...prev.items, newItem];
        }

        updatedItems = updateGroupDurations(updatedItems);
        return withLastModified({ ...prev, items: updatedItems });
      });

      return newItem.id;
    },
    [withLastModified],
  );

  const insertItemAfter = useCallback(
    (afterId: string, newItem: Omit<WorkshopItem, 'id'>): string | null => {
      const generated: WorkshopItem = { ...newItem, id: generateId() };

      let inserted = false;
      setWorkshopState((prev) => {
        const { parentId } = findItemAndParent(prev.items, afterId);
        const reference = findItemById(prev.items, afterId);
        if (!reference) return prev;

        let finalItem: WorkshopItem = generated;
        if (parentId) {
          const parent = findItemById(prev.items, parentId);
          if (parent?.type === 'breakout' && generated.laneIndex === undefined) {
            finalItem = { ...generated, laneIndex: reference.laneIndex ?? 0 };
          }
        }

        const insertInto = (items: WorkshopItem[]): WorkshopItem[] => {
          const idx = items.findIndex((i) => i.id === afterId);
          if (idx !== -1) {
            inserted = true;
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

        let updatedItems = insertInto(prev.items);
        if (!inserted) return prev;

        updatedItems = updateGroupDurations(updatedItems);
        return withLastModified({ ...prev, items: updatedItems });
      });

      return inserted ? generated.id : null;
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

        const item = findItem(prev.items);

        let updatedItems = updateItemInTree(prev.items, id, updates);
        updatedItems = updateGroupDurations(updatedItems);

        if (item) {
          if (debounceTrackingTimeoutRef.current) {
            clearTimeout(debounceTrackingTimeoutRef.current);
          }

          debounceTrackingTimeoutRef.current = setTimeout(() => {
            const changedAttributes = Object.keys(updates).join(', ');
            if (item.type === 'block') {
            } else if (item.type === 'group') {
            } else if (item.type === 'breakout') {
            }
            debounceTrackingTimeoutRef.current = null;
          }, DEBOUNCE_TIMES.METADATA_TRACKING);
        }

        return withLastModified({ ...prev, items: updatedItems });
      });
    },
    [withLastModified],
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

        const itemType = findItemType(prev.items);

        let updatedItems = removeItemFromTree(prev.items, id);
        updatedItems = updateGroupDurations(updatedItems);

        if (itemType === 'block') {
        } else if (itemType === 'group') {
        } else if (itemType === 'breakout') {
        }

        return withLastModified({ ...prev, items: updatedItems });
      });
    },
    [withLastModified],
  );

  const reorderItems = useCallback(
    (newItems: WorkshopItem[]) => {
      setWorkshopState((prev) => {
        const updatedItems = updateGroupDurations(newItems);
        return withLastModified({ ...prev, items: updatedItems });
      });
    },
    [withLastModified],
  );

  const moveItem = useCallback(
    (
      itemId: string,
      targetParentId: string | null,
      targetIndex?: number,
      additionalUpdates?: Partial<WorkshopItem>,
    ) => {
      setWorkshopState((prev) => {
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

        const itemsWithoutMoved = removeItem(prev.items);

        if (!movedItem) return prev;

        if (additionalUpdates) {
          movedItem = { ...movedItem, ...additionalUpdates };
        }

        let updatedItems: WorkshopItem[];

        if (targetParentId === null) {
          const targetIdx = targetIndex ?? itemsWithoutMoved.length;
          const newItems = [...itemsWithoutMoved];
          newItems.splice(targetIdx, 0, movedItem);
          updatedItems = newItems;
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
          updatedItems = addToParent(itemsWithoutMoved);
        }

        updatedItems = updateGroupDurations(updatedItems);

        if (movedItem.type === 'block') {
        } else if (movedItem.type === 'group') {
        } else if (movedItem.type === 'breakout') {
        }

        return withLastModified({ ...prev, items: updatedItems });
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
    setWorkshopState(data);
  }, []);

  const resetWorkshop = useCallback(() => {
    setWorkshopState(createEmptyWorkshop());
    clearTempWorkshop();
    clearTempWorkshopRestoreMarker();
    setCurrentSessionId(null);
    stripDataFromUrl();
  }, []);

  const clearWorkshopCompletely = useCallback(() => {
    const sessionId = currentSessionIdRef.current;
    if (sessionId) {
      removeSessionFromHistory(sessionId);
    }
    setWorkshopState(createEmptyWorkshop());
    clearTempWorkshop();
    clearTempWorkshopRestoreMarker();
    setCurrentSessionId(null);
    stripDataFromUrl();
  }, []);

  const loadSessionFromHistory = useCallback(
    (entry: SessionHistoryEntry) => {
      updateSessionLastOpened(entry.id);

      if (entry.type === 'dynamic' && entry.serverKey) {
        navigate(`/?id=${entry.serverKey}`);
        sync.loadServerSession(entry.serverKey);
        return;
      }

      if (entry.type === 'local' && entry.urlHash) {
        const data = decodeWorkshopFromUrl(entry.urlHash);
        if (data) {
          window.history.pushState(null, '', window.location.pathname);
          setWorkshopState(data);
          setWorkshopToHash(data);
          setCurrentSessionId(entry.id);
          currentSessionIdRef.current = entry.id;
        }
      }
    },
    [navigate, sync.loadServerSession],
  );

  return {
    workshop,
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
    serverKey: sync.serverKey,
    isLoadingFromServer: sync.isLoadingFromServer,
    isEnablingServerMode: sync.isEnablingServerMode,
    enableServerMode: sync.enableServerMode,
    disableServerMode: sync.disableServerMode,
    pollNow: sync.pollNow,
    incomingUpdate: sync.incomingUpdate,
    acceptIncomingUpdate: sync.acceptIncomingUpdate,
    forkSession: sync.forkSession,
  };
};
