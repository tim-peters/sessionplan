import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../atoms/ConfirmDialog';

interface PendingDelete {
  kind: 'blockType' | 'person';
  id: string;
  name: string;
}

interface SidebarDialogsProps {
  showClearAllDialog: boolean;
  onShowClearAllDialogChange: (open: boolean) => void;
  onClearAll: () => void;
  pendingDelete: PendingDelete | null;
  onClearPendingDelete: () => void;
  onConfirmDelete: () => void;
}

export const SidebarDialogs = ({
  showClearAllDialog,
  onShowClearAllDialogChange,
  onClearAll,
  pendingDelete,
  onClearPendingDelete,
  onConfirmDelete,
}: SidebarDialogsProps) => {
  const { t } = useTranslation('common');

  return (
    <>
      <ConfirmDialog
        open={showClearAllDialog}
        onOpenChange={onShowClearAllDialogChange}
        title={t('settings.clearAllTitle')}
        description={t('settings.clearAllConfirm')}
        confirmLabel={t('settings.clearAll')}
        cancelLabel={t('settings.clearAllCancel')}
        onConfirm={onClearAll}
        destructive
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && onClearPendingDelete()}
        title={
          pendingDelete?.kind === 'blockType'
            ? t('sidebar.deleteTypeTitle')
            : t('sidebar.deletePersonTitle')
        }
        description={
          pendingDelete?.kind === 'blockType'
            ? t('sidebar.deleteTypeConfirm')
            : t('sidebar.deletePersonConfirm')
        }
        confirmLabel={t('actions.delete')}
        cancelLabel={t('dialog.cancel')}
        onConfirm={onConfirmDelete}
        destructive
      />
    </>
  );
};
