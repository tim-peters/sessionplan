import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/primitives/switch';
import { Label } from '@/components/primitives/label';
import { Separator } from '@/components/primitives/separator';
import { Loader2, Trash2 } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { Button } from '@/components/primitives/button';

interface SharePopoverContentProps {
  serverKey: string | null;
  isEnablingServerMode: boolean;
  onToggleServerMode: (checked: boolean) => void;
  onCopyReadOnlyLink: () => void;
  onCopyEditorLink: () => void;
  /** Confirmation for the currently selected link, owned by the sharing controller. */
  wasCopied?: boolean;
  canEditServerSession: boolean;
  isLegacyServerSession: boolean;
  onMigrateLegacyLink: () => Promise<void>;
  legacyMigrationStatus: 'new' | 'existing' | 'missing';
  allowEditing: boolean;
  onAllowEditingChange: (checked: boolean) => void;
  wasCopiedSnapshot?: boolean;
  onCopySnapshotLink?: () => void;
}

export const SharePopoverContent = ({
  serverKey,
  isEnablingServerMode,
  onToggleServerMode,
  onCopyReadOnlyLink,
  onCopyEditorLink,
  wasCopied,
  canEditServerSession,
  isLegacyServerSession,
  onMigrateLegacyLink,
  legacyMigrationStatus,
  allowEditing,
  onAllowEditingChange,
  wasCopiedSnapshot,
  onCopySnapshotLink,
}: SharePopoverContentProps) => {
  const { t } = useTranslation('common');
  const copyAsEditor = canEditServerSession && (isLegacyServerSession || allowEditing);
  const handleCopyDynamicLink = () => {
    if (copyAsEditor) onCopyEditorLink();
    else onCopyReadOnlyLink();
  };

  return (
    <div className="space-y-4">
      {/* Snapshot link (URL-hash based) */}
      {!serverKey && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('planner.urlLinkLabel')}</p>
          <p className="text-xs text-muted-foreground">{t('planner.urlLinkDescription')}</p>
          <CopyButton
            copied={wasCopied ?? false}
            label={t('planner.copyLink')}
            copiedLabel={t('planner.copyLinkCopied')}
            onClick={onCopyEditorLink}
          />
          <Separator className="!my-5 sm:!my-2"  />
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="server-mode-toggle" className="text-sm font-medium">
              {t('planner.permanentLink')}*
            </Label>
            {isEnablingServerMode ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('planner.permanentLinkCreating')}
              </p>
            ) : (
              <Switch
                id="server-mode-toggle"
                checked={!!serverKey}
                disabled={isEnablingServerMode}
                onCheckedChange={onToggleServerMode}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">* {t('planner.permanentLinkSyncsNote')}</p>
        </div>
      )}

      {/* Dynamic link (server) */}
      {serverKey && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm font-medium">
              {t('planner.serverLinkLabel')}
            </Label>
            {isEnablingServerMode ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('planner.permanentLinkCreating')}
              </p>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleServerMode(false)}
                disabled={isEnablingServerMode || (!isLegacyServerSession && !canEditServerSession)}
                aria-label={t('planner.deleteDynamicLink')}
                title={t('planner.deleteDynamicLink')}
              >
                <Trash2 className="h-4 w-4 text-destructive-text" />
              </Button>
            )}
          </div>
          <CopyButton
            copied={wasCopied ?? false}
            variant="outline"
            label={copyAsEditor ? t('planner.copyEditorLink') : t('planner.copyReaderLink')}
            copiedLabel={copyAsEditor ? t('planner.copyEditorLinkCopied') : t('planner.copyReaderLinkCopied')}
            onClick={handleCopyDynamicLink}
          />
          <p className="text-xs font-medium text-muted-foreground">{t(
            isLegacyServerSession
              ? 'planner.legacyLinkNotice'
              : !canEditServerSession
              ? 'planner.readOnlyLinkNotice'
              : copyAsEditor
              ? 'planner.editorLinkTrustWarning'
              : 'planner.serverLinkNotice'
          )}</p>
          {!isLegacyServerSession && canEditServerSession && (
            <div className="flex items-center justify-between gap-2 pt-1 pb-2">
              <Label htmlFor="allow-editing-toggle" className="text-sm">
                {t('planner.allowEditing')}
              </Label>
              <Switch
                id="allow-editing-toggle"
                checked={allowEditing}
                onCheckedChange={onAllowEditingChange}
              />
            </div>
          )}
          {isLegacyServerSession && (
            <Button variant="outline" className="w-full" onClick={onMigrateLegacyLink} disabled={isEnablingServerMode}>
              {t(legacyMigrationStatus === 'existing' ? 'planner.openMigratedLink' : legacyMigrationStatus === 'missing' ? 'planner.recreateMigratedLink' : 'planner.migrateLegacyLink')}
            </Button>
          )}
          {isLegacyServerSession && legacyMigrationStatus === 'missing' && (
            <p className="text-xs text-muted-foreground">{t('planner.migratedLinkMissing')}</p>
          )}
          <Separator className="!my-5 sm:!my-2" />
          {onCopySnapshotLink && (
            <CopyButton
              variant="secondary"
              copied={wasCopiedSnapshot ?? false}
              label={t('planner.copySnapshotLink')}
              copiedLabel={t('planner.copySnapshotLinkCopied')}
              onClick={onCopySnapshotLink}
            />
          )}
          <p className="text-xs text-muted-foreground">{t('planner.urlLinkDescription')}</p>
        </div>
      )}

    </div>
  );
};
