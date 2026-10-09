import { useTranslation } from 'react-i18next';
import { CopyButton } from './CopyButton';

interface SharePopoverContentProps {
  wasCopied: boolean;
  onCopyLink: () => void;
}

export const SharePopoverContent = ({ wasCopied, onCopyLink }: SharePopoverContentProps) => {
  const { t } = useTranslation('common');
  return (
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
  );
};
