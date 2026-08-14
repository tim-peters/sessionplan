import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from './atoms/ConfirmDialog';
import type { WorkshopTemplate } from '@/lib/workshopStorage';

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
  pendingTemplate: WorkshopTemplate | null;
  onClearPendingTemplate: () => void;
  onConfirmLoadTemplate: () => void;
}

export const SidebarDialogs = ({
  showClearAllDialog,
  onShowClearAllDialogChange,
  onClearAll,
  pendingDelete,
  onClearPendingDelete,
  onConfirmDelete,
  pendingTemplate,
  onClearPendingTemplate,
  onConfirmLoadTemplate,
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

      <ConfirmDialog
        open={!!pendingTemplate}
        onOpenChange={(open) => !open && onClearPendingTemplate()}
        title={t('dialog.loadTemplateConfirm')}
        description={t('dialog.loadTemplateDescription')}
        confirmLabel={t('dialog.loadTemplate')}
        cancelLabel={t('dialog.cancel')}
        onConfirm={onConfirmLoadTemplate}
      />
    </>
  );
};
