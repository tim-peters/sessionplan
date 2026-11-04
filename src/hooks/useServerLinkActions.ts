/**
 * useServerLinkActions — Share URLs of the open session, and turning its
 * Dynamic Link on and off.
 */
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getDayParamValue } from '@/lib/workshop-days';
import { toReadOnlyShareUrl } from '@/lib/workshopUrl';
import { encodeWorkshopToUrl, withDayParam } from '@/lib/workshopStorage';
import type { WorkshopData } from '@/types/workshop';

interface UseServerLinkActionsArgs {
  plan: WorkshopData;
  activeDayId: string;
  serverKey: string | null;
  enableServerMode: () => Promise<string | null>;
  disableServerMode: () => Promise<boolean>;
  clearSessionNotFound: () => void;
}

interface ServerLinkActions {
  snapshotUrl: string;
  getEditorShareUrl: () => string;
  getReadOnlyShareUrl: () => string;
  handleToggleServerMode: (checked: boolean) => Promise<string | null>;
  showDisableServerDialog: boolean;
  setShowDisableServerDialog: (open: boolean) => void;
  handleConfirmDisableServer: () => Promise<void>;
}

export const useServerLinkActions = ({
  plan,
  activeDayId,
  serverKey,
  enableServerMode,
  disableServerMode,
  clearSessionNotFound,
}: UseServerLinkActionsArgs): ServerLinkActions => {
  const { t } = useTranslation('common');
  const [showDisableServerDialog, setShowDisableServerDialog] = useState(false);

  const snapshotUrl = useMemo(() => {
    const encoded = encodeWorkshopToUrl(plan);
    if (!encoded) return window.location.href;
    // Multi-day links open with the day currently shown.
    return withDayParam(
      `${window.location.origin}${window.location.pathname}#data=${encoded}`,
      getDayParamValue(plan, activeDayId),
    );
  }, [plan, activeDayId]);

  const getEditorShareUrl = useCallback(() => {
    if (serverKey) {
      const url = new URL(window.location.href);
      url.searchParams.set('id', serverKey);
      return url.toString();
    }
    return window.location.href;
  }, [serverKey]);

  const getReadOnlyShareUrl = useCallback(() => toReadOnlyShareUrl(getEditorShareUrl()), [getEditorShareUrl]);

  const handleToggleServerMode = useCallback(async (checked: boolean) => {
    if (!checked) {
      setShowDisableServerDialog(true);
      return null;
    }
    try {
      const url = await enableServerMode();
      return url;
    } catch {
      toast.error(t('planner.permanentLinkError'));
      return null;
    }
  }, [enableServerMode, t]);

  return {
    snapshotUrl,
    getEditorShareUrl,
    getReadOnlyShareUrl,
    handleToggleServerMode,
    showDisableServerDialog,
    setShowDisableServerDialog,
    handleConfirmDisableServer: async () => {
      if (await disableServerMode()) {
        setShowDisableServerDialog(false);
        clearSessionNotFound();
      } else {
        toast.error(t('planner.permanentLinkDeleteError'));
      }
    },
  };
};
