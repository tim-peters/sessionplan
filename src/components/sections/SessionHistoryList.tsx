import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { EyeOff, Link, Link2Off, SquareChartGantt, Trash2 } from 'lucide-react';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import { getSessionHistory, removeSessionFromHistory, upsertSessionToHistory } from '@/lib/workshopLocalStorage';
import { deleteServerSession, fetchServerSessionStatus, getServerSessionAccess } from '@/lib/workshopServer';
import { Button } from '@/components/primitives/button';
import { RECENT_INDICATOR_MS } from '@/lib/timing';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/primitives/alert-dialog';

interface SessionHistoryListProps {
  onReopenSession: (entry: SessionHistoryEntry) => void;
  onEmpty?: () => void;
}

const formatRelativeDate = (ms: number, t: TFunction, locale: string): string => {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return t('sessionHistory.relative.justNow');
  if (minutes < 60) return t('sessionHistory.relative.minutes', { count: minutes });
  if (hours < 24) return t('sessionHistory.relative.hours', { count: hours });
  if (days === 1) return t('sessionHistory.relative.yesterday');
  if (days < 30) return t('sessionHistory.relative.days', { count: days });
  return new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Distance from the edge (px) that still counts as "scrolled all the way".
const SCROLL_EDGE_TOLERANCE = 8;

export const SessionHistoryList = ({ onReopenSession, onEmpty }: SessionHistoryListProps) => {
  const { t, i18n } = useTranslation('common');
  const [sessions, setSessions] = useState<SessionHistoryEntry[]>(() =>
    getSessionHistory().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isScrolledToTop, setIsScrolledToTop] = useState(true);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight > el.clientHeight + 1;
    setIsScrollable(scrollable);
    setIsScrolledToTop(!scrollable || el.scrollTop < SCROLL_EDGE_TOLERANCE);
    setIsScrolledToBottom(
      !scrollable ||
        el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_EDGE_TOLERANCE
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const inner = contentRef.current;
    if (!el || !inner) return;

    updateScrollState();
    // Re-evaluate whenever the container, its content, or the viewport resizes
    // (e.g. status refreshes change titles/item counts, or the window resizes).
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    observer.observe(inner);
    window.addEventListener('resize', updateScrollState);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [sessions, updateScrollState]);


  useEffect(() => {
    let cancelled = false;
    const dynamicSessions = getSessionHistory().filter((entry) => entry.type === 'dynamic' && entry.serverKey);

    if (dynamicSessions.length === 0) return;

    Promise.all(dynamicSessions.map(async (entry) => {
      const result = await fetchServerSessionStatus(entry.serverKey!, getServerSessionAccess(entry.serverHash));

      if (result.status === 'available') {
        const updatedEntry: SessionHistoryEntry = {
          ...entry,
          title: result.data.workshop.title,
          updatedAt: result.data.workshop.lastModified
            ? Date.parse(result.data.workshop.lastModified) || entry.updatedAt
            : entry.updatedAt,
          itemCount: result.data.items.length,
          totalDuration: result.data.items.reduce((sum, item) => sum + (item.duration ?? 0), 0),
          unavailable: false,
          lastOpenedAt: entry.lastOpenedAt,
        };
        // Keep the local entry's timestamps stable; this refresh is not an open action.
        upsertSessionToHistory(updatedEntry);
        return updatedEntry;
      }

      if (result.status === 'not-found') {
        const updatedEntry = { ...entry, unavailable: true };
        upsertSessionToHistory(updatedEntry);
        return updatedEntry;
      }

      return entry;
    })).then((updatedEntries) => {
      if (cancelled) return;
      const updates = new Map(updatedEntries.map((entry) => [entry.id, entry]));
      setSessions((current) => current.map((entry) => updates.get(entry.id) ?? entry));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (sessions.length === 0) return null;

  const handleHide = (id: string) => {
    removeSessionFromHistory(id);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) onEmpty?.();
      return next;
    });
  };

  const handleHideAll = () => {
    for (const entry of sessions) {
      removeSessionFromHistory(entry.id);
    }
    setSessions([]);
    onEmpty?.();
  };

  const handleDeleteServer = async (entry: SessionHistoryEntry) => {
    if (entry.serverKey && !await deleteServerSession(entry.serverKey, getServerSessionAccess(entry.serverHash))) {
      return;
    }
    removeSessionFromHistory(entry.id);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== entry.id);
      if (next.length === 0) onEmpty?.();
      return next;
    });
  };

  const showBottomFade = isScrollable && !isScrolledToBottom;
  const showTopFade = isScrollable && !isScrolledToTop;

  // Edge fade as a mask on the scroll container (instead of an overlay div):
  // it dissolves the cards *including* borders, shadows and text into the
  // background, independent of theme colors. The respective stop is dropped
  // once the scroll reaches that edge.
  const FADE_SIZE_PX = 40;
  let fadeMask: string | undefined;
  if (showTopFade || showBottomFade) {
    const stops: string[] = [];
    if (showTopFade) {
      stops.push(`transparent 0`, `black ${FADE_SIZE_PX}px`);
    } else {
      stops.push(`black 0`);
    }
    if (showBottomFade) {
      stops.push(`black calc(100% - ${FADE_SIZE_PX}px)`, `transparent 100%`);
    } else {
      stops.push(`black 100%`);
    }
    fadeMask = `linear-gradient(to bottom, ${stops.join(', ')})`;
  }

  return (
    <div className="w-full" data-nosnippet="true">
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="w-full md:max-h-[70vh] overflow-y-auto sm:px-0.5 py-2"
        style={fadeMask ? { WebkitMaskImage: fadeMask, maskImage: fadeMask } : undefined}
      >
        <div ref={contentRef} className="flex flex-col gap-2">
        {sessions.map((entry, idx) => {
          const href = entry.type === 'dynamic' && entry.serverKey
            ? `/?id=${entry.serverKey}${entry.serverHash ?? ''}`
            : entry.type === 'local' && entry.urlHash
              ? `#data=${entry.urlHash}`
              : null;
          const canOpen = !entry.unavailable && href !== null;
          const content = (
            <>
              {/* Icon */}
              <div className="mt-1.5 ml-1 shrink-0 text-muted-foreground">
                {entry.type === 'dynamic' ? (
                  entry.unavailable
                    ? <Link2Off className="h-4 w-4" aria-label={t('sessionHistory.unavailable')} />
                    : <Link className="h-4 w-4" />
                ) : (
                  <SquareChartGantt className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="font-medium text-sm truncate">{entry.title || t('sessionHistory.untitled')}</span>
                  {idx === 0 && !entry.unavailable && Date.now() - entry.lastOpenedAt < RECENT_INDICATOR_MS && (
                    <span className="inline-block h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>
                    {t('sessionHistory.itemsCount', { count: entry.itemCount })}
                  </span>
                  {entry.totalDuration > 0 && (
                    <span>{t('sessionHistory.minutes', { count: entry.totalDuration })}</span>
                  )}
                </div>
              </div>
            </>
          );

            return (
              <div
                key={entry.id}
                className={`group relative flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow no-underline text-left w-full ${
                  entry.unavailable
                    ? 'text-muted-foreground opacity-60 cursor-default'
                    : canOpen
                      ? 'text-foreground hover:shadow-md cursor-pointer'
                      : 'text-foreground cursor-default'
                }`}
              >
                {canOpen && (
                  <a
                    href={href}
                    aria-label={entry.title || t('sessionHistory.untitled')}
                    className="absolute inset-0 z-20 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={(event) => {
                      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                        event.preventDefault();
                        onReopenSession(entry);
                      }
                    }}
                  />
                )}

                <div className="relative z-10 flex min-w-0 flex-1 items-start gap-3 pr-16">
                  {content}
                </div>

                <div className="absolute top-3 right-3 z-30 flex items-center gap-1">
                  {entry.type === 'dynamic' && !entry.unavailable && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title={t('sessionHistory.deleteServer')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('sessionHistory.deleteConfirmTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('sessionHistory.deleteConfirmText')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('sessionHistory.deleteConfirmCancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteServer(entry)}
                          >
                            {t('sessionHistory.deleteConfirmAction')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-7 p-0
                          ${entry.unavailable ? "text-foreground ": "text-muted-foreground "},
                           hover:text-foreground`}
                        title={t('sessionHistory.hide')}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('sessionHistory.hideConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('sessionHistory.hideConfirmText')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('sessionHistory.deleteConfirmCancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleHide(entry.id)}>
                          {t('sessionHistory.hideConfirmAction')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <span className="absolute bottom-3 right-3 z-10 flex items-center gap-1 text-xs text-muted-foreground">
                  {formatRelativeDate(entry.updatedAt, t, i18n.language)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isScrollable && (
        <div className="mt-1 pr-1 text-right">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 p-0 text-xs text-muted-foreground hover:text-foreground"
              >
                {t('sessionHistory.hideAll')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('sessionHistory.hideAllConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('sessionHistory.hideAllConfirmText')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('sessionHistory.deleteConfirmCancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleHideAll}>
                  {t('sessionHistory.hideAllConfirmAction')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
};
