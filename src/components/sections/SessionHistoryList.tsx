import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOff, Link, SquareChartGantt, Trash2 } from 'lucide-react';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import { getSessionHistory, removeSessionFromHistory } from '@/lib/workshopLocalStorage';
import { deleteServerSession } from '@/lib/workshopServer';
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

const formatRelativeDate = (ms: number): string => {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days === 1) return 'Gestern';
  if (days < 30) return `vor ${days} Tagen`;
  return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const SessionHistoryList = ({ onReopenSession, onEmpty }: SessionHistoryListProps) => {
  const { t } = useTranslation('common');
  const [sessions, setSessions] = useState<SessionHistoryEntry[]>(() =>
    getSessionHistory().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  );

  if (sessions.length === 0) return null;

  const handleHide = (id: string) => {
    removeSessionFromHistory(id);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) onEmpty?.();
      return next;
    });
  };

  const handleDeleteServer = async (entry: SessionHistoryEntry) => {
    if (entry.serverKey) {
      await deleteServerSession(entry.serverKey);
    }
    removeSessionFromHistory(entry.id);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== entry.id);
      if (next.length === 0) onEmpty?.();
      return next;
    });
  };

  return (
    <div className="w-full md:max-h-[70vh] overflow-y-auto sm:px-0.5 py-2">
      <div className="flex flex-col gap-2">
        {sessions.map((entry, idx) => {
          return (
          <div
            key={entry.id}
            role="button"
            tabIndex={0}
            onClick={() => onReopenSession(entry)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onReopenSession(entry);
              }
            }}
            className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow no-underline text-foreground text-left w-full cursor-pointer"
          >
            {/* Icon */}
            <div className="mt-1.5 ml-1 shrink-0 text-muted-foreground">
              {entry.type === 'dynamic' ? (
                <Link className="h-4 w-4" />
              ) : (
                <SquareChartGantt className="h-4 w-4" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-medium text-sm truncate">{entry.title}</span>
                {idx === 0 && Date.now() - entry.lastOpenedAt < RECENT_INDICATOR_MS && (
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

            <div className="flex items-end flex-col gap-1">
              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}>
                {entry.type === 'dynamic' && (
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
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
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
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {formatRelativeDate(entry.lastOpenedAt)}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};
