/**
 * IncomingUpdateBanner — Notification banner for collaborative session updates.
 *
 * Shown when another participant has pushed changes to a shared session.
 * Offers "Accept" (overwrite local) or "Fork" (create independent copy).
 */
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Button } from '@/components/primitives/button';

interface IncomingUpdateBannerProps {
  onAccept: () => void;
  onFork: () => void;
  isForking: boolean;
  serverKey?: string | null;
}

export const IncomingUpdateBanner = ({ onAccept, onFork, isForking, serverKey }: IncomingUpdateBannerProps) => {
  const { t } = useTranslation('common');

  return (
    <div className="mx-4 mt-2 mb-1 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm flex flex-row justify-between items-center print:hidden">
      <p className="font-medium flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          <span className="text-primary">{t('planner.incomingUpdateBanner')}</span>{' '}
          {t('planner.incomingUpdateHint')}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onFork}
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
    </div>
  );
};
