/**
 * HeaderActionButtons — Action button bar rendered beside the WorkshopHeader.
 *
 * Contains the play/stop toggle, reset button, and share button (with
 * desktop Popover and mobile curtain-modal). Owns the share popover state
 * and copy-to-clipboard timers internally.
 */
import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Share2, X, Play, Square, Link, ChevronDown } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/primitives/popover';
import { SharePopoverContent } from '../atoms/SharePopoverContent';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCopiedState } from '@/hooks/useCopiedState';
import { toast } from 'sonner';

interface PlayModeControls {
  isActive: boolean;
  canActivate: boolean;
  activate: () => void;
  deactivate: () => void;
}

interface HeaderActionButtonsProps {
  playMode: PlayModeControls;
  onReset: () => void;
  serverKey: string | null;
  isEnablingServerMode: boolean;
  onToggleServerMode: (checked: boolean) => Promise<void> | void;
  getShareUrl: () => string;
  snapshotUrl: string;
  lastModified?: string;
  dateLocale: string;
}

export const HeaderActionButtons = ({
  playMode,
  onReset,
  serverKey,
  isEnablingServerMode,
  onToggleServerMode,
  getShareUrl,
  snapshotUrl,
  lastModified,
  dateLocale,
}: HeaderActionButtonsProps) => {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();

  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [wasCopied, triggerCopied] = useCopiedState();
  const [wasCopiedSnapshot, triggerCopiedSnapshot] = useCopiedState();
  const hasSeenPopoverRef = useRef(false);

  const handleToggleServerModeWithCopy = useCallback(async (checked: boolean) => {
    await onToggleServerMode(checked);
    if (checked) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        triggerCopied();
      } catch {
        // silent
      }
    }
  }, [onToggleServerMode, triggerCopied]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      triggerCopied();
    } catch {
      // silent
    }
  }, [getShareUrl, triggerCopied, serverKey]);

  const handleCopySnapshotLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snapshotUrl);
      triggerCopiedSnapshot();
    } catch {
      // silent
    }
  }, [snapshotUrl, triggerCopiedSnapshot]);

  const handleShareButtonClick = useCallback(async () => {
    const isFirstTime = !hasSeenPopoverRef.current;
    if (isFirstTime) {
      hasSeenPopoverRef.current = true;
      setSharePopoverOpen(true);
    }
    try {
      await navigator.clipboard.writeText(getShareUrl());
      triggerCopied();
      if (!isFirstTime) {
        toast.success(t('planner.copyLinkCopied'));
      }
    } catch {
      if (isFirstTime) setSharePopoverOpen(true);
    }
  }, [getShareUrl, triggerCopied, t]);

  const handleChevronClick = useCallback(() => {
    hasSeenPopoverRef.current = true;
    setSharePopoverOpen(true);
  }, []);

  const sharePopoverContentProps = {
    serverKey,
    isEnablingServerMode,
    onToggleServerMode: handleToggleServerModeWithCopy,
    shareUrl: getShareUrl(),
    wasCopied,
    onCopyLink: handleCopyLink,
    snapshotUrl,
    wasCopiedSnapshot,
    onCopySnapshotLink: handleCopySnapshotLink,
  };

  return (
    <div className="flex items-start gap-1 md:gap-0 px-2 md:px-1 py-1 pt-3 sm:pt-1 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/70 border-b sm:border sm:rounded-xl sm:shadow-sm sm:ml-auto print:hidden">
      <Button
        variant={playMode.isActive ? 'default' : 'ghost'}
        size="sm"
        onClick={() => {
          if (playMode.isActive) {
            playMode.deactivate();
          } else {
            playMode.activate();
          }
        }}
        disabled={!playMode.canActivate && !playMode.isActive}
        className="gap-2"
        title={
          (!playMode.canActivate && !playMode.isActive
            ? t('planner.setDateTime')
            : playMode.isActive
            ? t('planner.stopLiveMode')
            : t('planner.startLiveMode')) + ' (Leertaste)'
        }
        data-play-mode-trigger
      >
        {playMode.isActive ? (
          <Square className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      {/* Share button — desktop: anchored Popover; mobile: curtain modal via portal */}
      <Popover open={!isMobile && sharePopoverOpen} onOpenChange={(v) => { if (!isMobile) setSharePopoverOpen(v); }}>
        <PopoverAnchor asChild>
          <div className="flex items-center print:hidden">
            <Button
              variant="ghost"
              size="sm"
              title={`${t('planner.share')} (Shift+C)`}
              className="gap-2 rounded-r-none border-r-0"
              onClick={handleShareButtonClick}
              data-share-trigger
            >
              {serverKey ? <Link className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {!serverKey && lastModified && (() => {
                const d = new Date(lastModified);
                const today = new Date();
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <span className="hidden sm:inline text-xs">
                    {t('planner.sharedAt')} {!isToday && d.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' '}
                    {d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} Uhr
                  </span>
                );
              })()}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title={t('planner.shareOptions')}
              className="px-1.5 rounded-l-none"
              onClick={handleChevronClick}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </PopoverAnchor>
        <PopoverContent className="w-80 p-4" align="end">
          <SharePopoverContent {...sharePopoverContentProps} />
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        title={`${t('planner.reset')} (Esc)`}
        data-reset-trigger
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Mobile: centered curtain modal — rendered via portal */}
      {isMobile && sharePopoverOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => setSharePopoverOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div
            className="relative w-full max-w-sm rounded-lg border bg-popover p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <SharePopoverContent {...sharePopoverContentProps} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
