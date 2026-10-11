/**
 * SessionBanners — status banners for server-synced (dynamic-link) sessions.
 *
 * All three banners share the same chrome (position, padding, print
 * behaviour) and are rendered in the same slot above the planner grid by
 * WorkshopPlanner. Only the tone (info/warning/error) and the layout of
 * message and actions differ.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/primitives/button';
type BannerTone = 'info' | 'warning' | 'error';

const toneClasses: Record<BannerTone, string> = {
  info: 'border border-primary/20 bg-primary/10',
  warning: 'bg-amber-500/10',
  error: 'border border-destructive/20 bg-destructive/10',
};

const toneTitleClasses: Record<BannerTone, string> = {
  info: 'text-primary',
  warning: 'text-amber-800 dark:text-amber-300',
  error: 'text-destructive',
};

const toneIconClasses: Record<BannerTone, string> = {
  info: 'text-primary',
  warning: 'text-amber-700 dark:text-amber-400',
  error: 'text-destructive',
};

const toneIcons: Record<BannerTone, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
};

interface BannerShellProps {
  tone: BannerTone;
  /** Render with role="alert" so screen readers announce the banner. */
  alert?: boolean;
  className?: string;
  children: ReactNode;
}

/** Shared outer chrome for all planner banners. */
const BannerShell = ({ tone, alert = false, className, children }: BannerShellProps) => (
  <div
    role={alert ? 'alert' : undefined}
    className={`mx-4 mt-2 mb-1 rounded-lg backdrop-blur px-4 py-3 text-sm print:hidden ${toneClasses[tone]}${className ? ` ${className}` : ''}`}
  >
    {children}
  </div>
);

/** Icon + emphasised title + hint text, shared by the info and warning banners. */
const BannerMessage = ({ tone, title, hint }: { tone: BannerTone; title: string; hint: string }) => {
  const Icon = toneIcons[tone];
  return (
    <p className="font-medium flex items-start gap-2">
      <Icon className={`mt-0.5 size-4 shrink-0 ${toneIconClasses[tone]}`} />
      <span>
        <span className={toneTitleClasses[tone]}>{title}</span>
        {' '}
        {hint}
      </span>
    </p>
  );
};

/**
 * IncomingUpdateBanner — notification banner for collaborative session updates.
 *
 * Shown when another participant has pushed changes to a shared session.
 * Offers "Accept" (overwrite local) or "Fork" (create independent copy).
 */
interface IncomingUpdateBannerProps {
  onAccept: () => void;
  onFork: () => void;
  isForking: boolean;
  serverKey?: string | null;
}

export const IncomingUpdateBanner = ({ onAccept, onFork, isForking, serverKey }: IncomingUpdateBannerProps) => {
  const { t } = useTranslation('common');


  return (
    <BannerShell tone="info" className="flex flex-row justify-between items-center">
      <BannerMessage tone="info" title={t('planner.incomingUpdateBanner')} hint={t('planner.incomingUpdateHint')} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onFork();
          }}
          disabled={isForking}
        >
          {isForking ? t('planner.incomingUpdateForking') : t('planner.incomingUpdateFork')}
        </Button>
        <Button
          variant="default"
          size="sm"
          asChild
        >
          <a
            href={serverKey ? `/?id=${serverKey}` : '#'}
            onClick={(e) => {
              e.preventDefault();
              onAccept();
            }}
          >
            {t('planner.incomingUpdateAccept')}
          </a>
        </Button>
      </div>
    </BannerShell>
  );
};

/**
 * UnsyncedChangesBanner — warning banner for failed server sync.
 *
 * Shown when a dynamic-link session has local changes that could not be
 * synced to the server (network/server error). Offers a JSON download as an
 * inline link inside the message as a safety net so no changes are lost.
 * Clears automatically once syncing succeeds again.
 */
interface UnsyncedChangesBannerProps {
  onDownload: () => void;
}

export const UnsyncedChangesBanner = ({ onDownload }: UnsyncedChangesBannerProps) => {
  const { t } = useTranslation('common');


  return (
    <BannerShell tone="error" alert className="flex items-start gap-2">
      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${toneIconClasses.error}`} />
      <p className="font-medium">
        <span className={toneTitleClasses.error}>{t('planner.unsyncedChangesBanner')}</span>{' '}
        {t('planner.unsyncedChangesHintBefore')}
        <button
          type="button"
          onClick={() => {
            onDownload();
          }}
          className="font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-destructive rounded-sm"
        >
          {t('planner.unsyncedChangesLink')}
        </button>
        {t('planner.unsyncedChangesHintAfter')}
      </p>
    </BannerShell>
  );
};

/** ReadOnlyChangesBanner — warns readers after their first local change to a Dynamic Link. */
interface ReadOnlyChangesBannerProps {
  onCreateLocalCopy: () => void;
}

export const ReadOnlyChangesBanner = ({ onCreateLocalCopy }: ReadOnlyChangesBannerProps) => {
  const { t } = useTranslation('common');


  return (
    <BannerShell tone="warning" alert className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <BannerMessage tone="warning" title={t('planner.readOnlyChangesBanner')} hint={t('planner.readOnlyChangesRequest')} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onCreateLocalCopy();
        }}
        className="shrink-0"
      >
        {t('planner.readOnlyChangesCopy')}
      </Button>
    </BannerShell>
  );
};
