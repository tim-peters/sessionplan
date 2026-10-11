import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/primitives/switch';
import { Label } from '@/components/primitives/label';
import { Separator } from '@/components/primitives/separator';
import { Loader2, Trash2 } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { Button } from '@/components/primitives/button';
import { useCopiedState } from '@/hooks/useCopiedState';

interface SharePopoverContentProps {
  serverKey: string | null;
  isEnablingServerMode: boolean;
  onToggleServerMode: (checked: boolean) => void;
  onCopyReadOnlyLink: () => void;
  onCopyEditorLink: () => void;
  /** Copied-state of the share button / hash-link copy (owned by the parent). Used by the `!serverKey` branch. */
  wasCopied?: boolean;
  canEditServerSession: boolean;
  isLegacyServerSession: boolean;
  onMigrateLegacyLink: () => Promise<void>;
  snapshotUrl?: string;
  wasCopiedSnapshot?: boolean;
  onCopySnapshotLink?: () => void;
}

export const SharePopoverContent = ({
  serverKey,
  isEnablingServerMode,
  onToggleServerMode,
  onCopyReadOnlyLink,
  onCopyEditorLink,
  wasCopied: wasCopiedHashLink,
  canEditServerSession,
  isLegacyServerSession,
  onMigrateLegacyLink,
  snapshotUrl,
  wasCopiedSnapshot,
  onCopySnapshotLink,
}: SharePopoverContentProps) => {
  const { t } = useTranslation('common');
  const [allowEditing, setAllowEditing] = useState(false);
  // Single copied-state for the adaptive dynamic-link copy button so the
  // "copied" label never dangles from a stale mode after toggling.
  const [wasCopied, triggerCopied, resetCopied] = useCopiedState();

  // Restore the auto-flash on the copy button when a dynamic link has just
  // been enabled (clipboard already contains the new link at that point).
  const prevServerKeyRef = useRef(serverKey);
  useEffect(() => {
    if (prevServerKeyRef.current === null && serverKey !== null) triggerCopied();
    prevServerKeyRef.current = serverKey;
  }, [serverKey, triggerCopied]);

  // Effective mode for the adaptive copy button.
  const copyAsEditor = isLegacyServerSession || allowEditing;
  const handleCopyDynamicLink = () => {
    if (copyAsEditor) onCopyEditorLink();
    else onCopyReadOnlyLink();
    triggerCopied();
  };

  return (
    <div className="space-y-4">
      {/* Snapshot link (URL-hash based) */}
      {!serverKey && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('planner.urlLinkLabel')}</p>
          <p className="text-xs text-muted-foreground">{t('planner.urlLinkDescription')}</p>
          <CopyButton
            copied={wasCopiedHashLink ?? false}
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
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <CopyButton
            copied={wasCopied}
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
                onCheckedChange={(checked) => {
                  setAllowEditing(checked);
                  // The clipboard content of the last copy no longer matches
                  // the new mode — drop the "kopiert" state so the label and
                  // the copy target switch together.
                  resetCopied();
                }}
              />
            </div>
          )}
          {isLegacyServerSession && (
            <Button variant="outline" className="w-full" onClick={onMigrateLegacyLink} disabled={isEnablingServerMode}>
              {t('planner.migrateLegacyLink')}
            </Button>
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
