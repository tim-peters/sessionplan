/**
 * HeaderActionButtons — Action button bar rendered beside the WorkshopHeader.
 *
 * Contains the play/stop toggle, reset button, and share button (with
 * desktop Popover and mobile Drawer). Owns the share popover state
 * and copy-to-clipboard timers internally.
 */
import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, X, Play, Square, Link, ChevronDown, Undo2, Printer, Menu } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { Separator } from '@/components/primitives/separator';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/primitives/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/primitives/drawer';
import { SharePopoverContent } from './SharePopoverContent';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCopiedState } from '@/hooks/useCopiedState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  canUndo: boolean;
  onUndo: () => void;
  onMenuClick: () => void;
  isSidebarCollapsed?: boolean;
  hasActions?: boolean;
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
  canUndo,
  onUndo,
  onMenuClick,
  isSidebarCollapsed = false,
  hasActions = true,
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

  const handleMobileShareButtonClick = useCallback(async () => {
    setSharePopoverOpen(true);
    try {
      await navigator.clipboard.writeText(getShareUrl());
      triggerCopied();
    } catch {
      // silent
    }
  }, [getShareUrl, triggerCopied]);

  const sharePopoverContentProps = {
    serverKey,
    isEnablingServerMode,
    onToggleServerMode: handleToggleServerModeWithCopy,
    wasCopied,
    onCopyLink: handleCopyLink,
    snapshotUrl,
    wasCopiedSnapshot,
    onCopySnapshotLink: handleCopySnapshotLink,
  };

  return (
    <div className={cn(
      'flex items-center justify-between gap-1 px-2 md:px-1 py-1 pt-3 sm:pt-1 print:hidden',
      'sm:bg-card/95 sm:backdrop-blur-sm sm:supports-[backdrop-filter]:bg-card/70 sm:border sm:rounded-xl sm:shadow-sm sm:ml-auto',
      'sm:order-1 w-full sm:justify-end sm:order-none sm:w-auto sm:justify-start')}>
      {/* Mobile menu control; the desktop control remains in WorkshopHeader to preserve its layout. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className={[
          'h-8 w-8 shrink-0 ml-1 sm:hidden',
          !isSidebarCollapsed && 'lg:hidden',
        ].filter(Boolean).join(' ')}
        aria-label={t('planner.menu')}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className={cn('flex items-start gap-1 md:gap-0', 
        !hasActions && 'hidden'
      )}>
        {canUndo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            title={`${t('planner.undo')} (Ctrl/Cmd+Z)`}
          aria-label={t('planner.undo')}
        >
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
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

        {/* Share button — desktop: split button with anchored Popover */}
        <Popover open={!isMobile && sharePopoverOpen} onOpenChange={(v) => { if (!isMobile) setSharePopoverOpen(v); }}>
          <PopoverAnchor asChild>
            <div className="hidden md:flex items-center print:hidden">
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
                    <span className="hidden md:inline text-xs">
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
            <Separator className="mt-3" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                window.print();
              }}
            >
              <Printer className="h-4 w-4" />
              {t('settings.exportPdf')}
            </Button>
          </PopoverContent>
        </Popover>
        {/* Mobile: one button that always opens the Drawer */}
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            title={t('planner.share')}
            onClick={handleMobileShareButtonClick}
            data-share-trigger
          >
            {serverKey ? <Link className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          title={`${t('planner.reset')} (Esc)`}
          data-reset-trigger
        >
          <X className="h-4 w-4" />
        </Button>

        <Drawer open={isMobile && sharePopoverOpen} onOpenChange={setSharePopoverOpen}>
          <DrawerContent className="max-h-[92dvh] print:hidden">
            <div className="overflow-y-auto px-4 pb-4">
              <SharePopoverContent {...sharePopoverContentProps} />
              <Separator className="mt-6" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer className="h-4 w-4" />
                {t('settings.exportPdf')}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
};
