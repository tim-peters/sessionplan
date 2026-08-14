import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/primitives/alert-dialog';
import { Button } from '@/components/primitives/button';
import { Input } from '@/components/primitives/input';
import { Label } from '@/components/primitives/label';

interface PlannerDialogsProps {
  saveTemplateDialog: boolean;
  onSaveTemplateDialogChange: (open: boolean) => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
  onSaveTemplate: () => void;
  showDisableServerDialog: boolean;
  onShowDisableServerDialogChange: (open: boolean) => void;
  onConfirmDisableServer: () => void;
}

export const PlannerDialogs = ({
  saveTemplateDialog,
  onSaveTemplateDialogChange,
  templateName,
  onTemplateNameChange,
  onSaveTemplate,
  showDisableServerDialog,
  onShowDisableServerDialogChange,
  onConfirmDisableServer,
}: PlannerDialogsProps) => {
  const { t } = useTranslation('common');

  return (
    <>
      <Dialog open={saveTemplateDialog} onOpenChange={onSaveTemplateDialogChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('dialog.saveAsTemplate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">{t('dialog.templateName')}</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => onTemplateNameChange(e.target.value)}
                placeholder={t('dialog.templateNamePlaceholder')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onSaveTemplateDialogChange(false)}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={onSaveTemplate}>
              {t('dialog.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDisableServerDialog} onOpenChange={onShowDisableServerDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('planner.disableServerModeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('planner.disableServerModeText')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('planner.disableServerModeCancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmDisableServer}
            >
              {t('planner.disableServerModeAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
