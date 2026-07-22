import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/primitives/switch';
import { Label } from '@/components/primitives/label';
import { Separator } from '@/components/primitives/separator';
import { Loader2 } from 'lucide-react';
import { CopyButton } from './CopyButton';

interface SharePopoverContentProps {
  serverKey: string | null;
  isEnablingServerMode: boolean;
  onToggleServerMode: (checked: boolean) => void;
  shareUrl: string;
  wasCopied: boolean;
  onCopyLink: () => void;
  snapshotUrl?: string;
  wasCopiedSnapshot?: boolean;
  onCopySnapshotLink?: () => void;
}

export const SharePopoverContent = ({
  serverKey,
  isEnablingServerMode,
  onToggleServerMode,
  shareUrl,
  wasCopied,
  onCopyLink,
  snapshotUrl,
  wasCopiedSnapshot,
  onCopySnapshotLink,
}: SharePopoverContentProps) => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-4">
      {/* Snapshot link (URL-hash based) */}
      {!serverKey && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('planner.urlLinkLabel')}</p>
          <p className="text-xs text-muted-foreground">{t('planner.urlLinkDescription')}</p>
          <CopyButton
            copied={wasCopied}
            label={t('planner.copyLink')}
            copiedLabel={t('planner.copyLinkCopied')}
            onClick={onCopyLink}
          />
        </div>
      )}

      {/* Dynamic link (server) */}
      {serverKey && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('planner.serverLinkLabel')}</p>
          <p className="text-xs text-muted-foreground">{t('planner.permanentLinkDescription')}</p>
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs font-mono break-all">
            {shareUrl}
          </div>
          <CopyButton
            copied={wasCopied}
            label={t('planner.copyEditorLink')}
            copiedLabel={t('planner.copyEditorLinkCopied')}
            onClick={onCopyLink}
            variant="outline"
          />
          {onCopySnapshotLink && (
            <CopyButton
              copied={wasCopiedSnapshot ?? false}
              label={t('planner.copySnapshotLink')}
              copiedLabel={t('planner.copySnapshotLinkCopied')}
              onClick={onCopySnapshotLink}
            />
          )}
        </div>
      )}

      <Separator />

      {/* Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="server-mode-toggle" className="text-sm font-medium">
            {t('planner.permanentLink')}{!serverKey && '*'}
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
        {!serverKey && (
          <p className="text-xs text-muted-foreground">* {t('planner.permanentLinkSyncsNote')}</p>
        )}
      </div>
    </div>
  );
};
