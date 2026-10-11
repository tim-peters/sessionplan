/**
 * UnsyncedChangesBanner — Warning banner for failed server sync.
 *
 * Shown when a dynamic-link session has local changes that could not be
 * synced to the server (network/server error). Offers a JSON download as an
 * inline link inside the message as a safety net so no changes are lost.
 * Clears automatically once syncing succeeds again.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface UnsyncedChangesBannerProps {
  onDownload: () => void;
}

export const UnsyncedChangesBanner = ({ onDownload }: UnsyncedChangesBannerProps) => {
  const { t } = useTranslation('common');

  return (
    <div role="alert" className="mx-4 mt-2 mb-1 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm print:hidden">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="font-medium">
        <span className="text-destructive">{t('planner.unsyncedChangesBanner')}</span>{' '}
        {t('planner.unsyncedChangesHintBefore')}
        <button
          type="button"
          onClick={onDownload}
          className="font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-destructive rounded-sm"
        >
          {t('planner.unsyncedChangesLink')}
        </button>
        {t('planner.unsyncedChangesHintAfter')}
      </p>
    </div>
  );
};
