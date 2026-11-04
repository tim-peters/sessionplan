/**
 * HeaderActionButtons — Action button bar rendered beside the WorkshopHeader.
 *
 * Contains the play/stop toggle, reset button, and share button (with
 * desktop Popover and mobile Drawer). Owns the share popover state
 * and copy-to-clipboard timers internally.
 */
import { useState, useCallback, useRef } from 'react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, X, Play, Square, Link, ChevronDown, Undo2, Printer, Menu } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/primitives/tooltip';
import { Separator } from '@/components/primitives/separator';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/primitives/popover';
import { Drawer, DrawerContent } from '@/components/primitives/drawer';
import { SharePopoverContent } from './SharePopoverContent';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCopiedState } from '@/hooks/useCopiedState';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import { toast } from 'sonner';
import { armFeedbackValuableAction } from '@/hooks/useFeedbackPrompt';
import { cn } from '@/lib/utils';
import { toReadOnlyShareUrl } from '@/lib/workshopUrl';

interface PlayModeControls {
  isActive: boolean;
  activate: () => void;
  deactivate: () => void;
}

interface HeaderActionButtonsProps {
  actionBarRef?: Ref<HTMLDivElement>;
  playMode: PlayModeControls;
  onReset: () => void;
  serverKey: string | null;
  isEnablingServerMode: boolean;
  onToggleServerMode: (checked: boolean) => Promise<string | null>;
  getEditorShareUrl: () => string;
  getReadOnlyShareUrl: () => string;
  canEditServerSession: boolean;
  isLegacyServerSession: boolean;
  onMigrateLegacyLink: () => Promise<string | null>;
  legacyMigrationStatus: 'new' | 'existing' | 'missing';
  snapshotUrl: string;
  lastModified?: string;
  dateLocale: string;
  canUndo: boolean;
  onUndo: () => void;
  onMenuClick: () => void;
  isSidebarCollapsed?: boolean;
  hasActions?: boolean;
  isReadOnly?: boolean;
  /** Notifies the parent when the share popover opens or closes (used by
   *  the optional feedback prompt to gate exit-intent / card eligibility). */
  onSharePopoverOpenChange?: (open: boolean) => void;
}

const PrintPlanButton = () => {
  const { t } = useTranslation('common');

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full mt-2"
      onClick={() => {
        armFeedbackValuableAction('print');
        window.print();
      }}
    >
      <Printer className="h-4 w-4" />
      {t('settings.exportPdf')}
    </Button>
  );
};

const LastSavedLabel = ({ lastModified, dateLocale }: { lastModified: string; dateLocale: string }) => {
  const { t } = useTranslation('common');
  const date = new Date(lastModified);
  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <span className="hidden md:inline text-xs">
      {t('planner.sharedAt')} {!isToday && date.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' '}
      {date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} Uhr
    </span>
  );
};

export const HeaderActionButtons = ({
  actionBarRef,
  playMode,
  onReset,
  serverKey,
  isEnablingServerMode,
  onToggleServerMode,
  getEditorShareUrl,
  getReadOnlyShareUrl,
  canEditServerSession,
  isLegacyServerSession,
  onMigrateLegacyLink,
  legacyMigrationStatus,
  snapshotUrl,
  lastModified,
  dateLocale,
  canUndo,
  onUndo,
  onMenuClick,
  isSidebarCollapsed = false,
  hasActions = true,
  isReadOnly = false,
  onSharePopoverOpenChange,
}: HeaderActionButtonsProps) => {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const { withHint, hintAttrs } = useShortcutLabels();

  const [sharePopoverOpen, setSharePopoverOpenRaw] = useState(false);
  const setSharePopoverOpen = useCallback((open: boolean) => {
    setSharePopoverOpenRaw(open);
    onSharePopoverOpenChange?.(open);
  }, [onSharePopoverOpenChange]);
  const [wasCopied, triggerCopied, resetCopied] = useCopiedState();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState({ serverKey, canEdit: canEditServerSession, allowEditing: false });
  const shareModeChanged = shareMode.serverKey !== serverKey || shareMode.canEdit !== canEditServerSession;
  if (shareModeChanged) {
    setShareMode({ serverKey, canEdit: canEditServerSession, allowEditing: false });
  }
  const allowEditing = canEditServerSession && !shareModeChanged && shareMode.allowEditing;
  const getShareUrl = useCallback(() => (
    canEditServerSession && (isLegacyServerSession || allowEditing)
      ? getEditorShareUrl() : getReadOnlyShareUrl()
  ), [canEditServerSession, isLegacyServerSession, allowEditing, getEditorShareUrl, getReadOnlyShareUrl]);
  const [wasCopiedSnapshot, triggerCopiedSnapshot] = useCopiedState();
  const hasSeenPopoverRef = useRef(false);

  const copyDynamicLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      triggerCopied();
      armFeedbackValuableAction('link');
      return true;
    } catch {
      resetCopied();
      toast.error(t('planner.copyLinkError'));
      return false;
    }
  }, [triggerCopied, resetCopied, t]);

  const handleToggleServerModeWithCopy = useCallback(async (checked: boolean) => {
    const url = await onToggleServerMode(checked);
    // Use the new URL rather than callbacks for the previous session.
    // Creation and migration both share a view link initially.
    if (checked && url) {
      await copyDynamicLink(toReadOnlyShareUrl(url));
    }
  }, [onToggleServerMode, copyDynamicLink]);

  const handleMigrateLegacyLink = useCallback(async () => {
    const url = await onMigrateLegacyLink();
    if (url) {
      await copyDynamicLink(toReadOnlyShareUrl(url));
    }
  }, [onMigrateLegacyLink, copyDynamicLink]);

  const handleCopyEditorLink = useCallback(async () => {
    await copyDynamicLink(getShareUrl());
  }, [getShareUrl, copyDynamicLink]);

  const handleCopySnapshotLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snapshotUrl);
      triggerCopiedSnapshot();
      armFeedbackValuableAction('link');
    } catch {
      // silent
    }
  }, [snapshotUrl, triggerCopiedSnapshot]);

  const handleCopyReadOnlyLink = useCallback(async () => {
    await copyDynamicLink(getReadOnlyShareUrl());
  }, [getReadOnlyShareUrl, copyDynamicLink]);

  const handleShareButtonClick = useCallback(async () => {
    const isFirstTime = !hasSeenPopoverRef.current;
    if (isFirstTime) {
      hasSeenPopoverRef.current = true;
      setSharePopoverOpen(true);
    }
    if (await copyDynamicLink(getShareUrl())) {
      if (!isFirstTime) toast.success(t('planner.copyLinkCopied'));
    }
  }, [getShareUrl, copyDynamicLink, setSharePopoverOpen, t]);

  const handleChevronClick = useCallback(() => {
    hasSeenPopoverRef.current = true;
    setSharePopoverOpen(true);
  }, [setSharePopoverOpen]);

  const handleMobileShareButtonClick = useCallback(async () => {
    setSharePopoverOpen(true);
    await copyDynamicLink(getShareUrl());
  }, [getShareUrl, copyDynamicLink, setSharePopoverOpen]);

  const sharePopoverContentProps = {
    serverKey,
    isEnablingServerMode,
    onToggleServerMode: handleToggleServerModeWithCopy,
    wasCopied: wasCopied && copiedUrl === getShareUrl(),
    onCopyReadOnlyLink: handleCopyReadOnlyLink,
    onCopyEditorLink: handleCopyEditorLink,
    canEditServerSession,
    isLegacyServerSession,
    onMigrateLegacyLink: handleMigrateLegacyLink,
    legacyMigrationStatus,
    allowEditing,
    onAllowEditingChange: (checked: boolean) => {
      setShareMode({ serverKey, canEdit: canEditServerSession, allowEditing: checked });
      resetCopied();
    },
    wasCopiedSnapshot,
    onCopySnapshotLink: handleCopySnapshotLink,
  };

  return (
    <div ref={actionBarRef} data-shortcut-bar className={cn(
      'flex items-center justify-between gap-1 px-2 md:px-1 md:py-1 pt-3 md:pt-1 print:hidden',
      'md:bg-card/95 md:backdrop-blur-sm md:supports-[backdrop-filter]:bg-card/70 md:border md:rounded-xl md:shadow-sm md:ml-auto',
      'md:order-1 w-full md:justify-end md:order-none md:w-auto md:justify-start')}>
      {/* Mobile menu control; the desktop control remains in WorkshopHeader to preserve its layout. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className={cn('h-8 w-8 shrink-0 ml-1 md:hidden', !isSidebarCollapsed && 'lg:hidden')}
        aria-label={t('planner.menu')}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className={cn('flex items-start gap-1 md:gap-0', 
        !hasActions && 'hidden'
      )}>
        {isReadOnly && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} aria-label={t('planner.readOnlyChipDescription')} className="self-center shrink-0 px-1 print:hidden">
                  <Badge variant="secondary" className="whitespace-nowrap font-normal text-muted-foreground print:hidden md:-translate-y-0.5">
                    {t('planner.readOnlyChip')}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{t('planner.readOnlyChipDescription')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {canUndo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            title={withHint(t('planner.undo'), 'undo')}
            aria-label={t('planner.undo')}
            {...hintAttrs('undo')}
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
          className="gap-2"
          title={withHint(
            playMode.isActive ? t('planner.stopLiveMode') : t('planner.startLiveMode'),
            'togglePlayMode',
          )}
          data-play-mode-trigger
          {...hintAttrs('togglePlayMode')}
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
                title={withHint(t('planner.share'), 'openShare')}
                className="gap-2 rounded-r-none border-r-0"
                onClick={handleShareButtonClick}
                data-share-trigger
                {...hintAttrs('openShare')}
              >
                {serverKey ? <Link className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {!serverKey && lastModified && <LastSavedLabel lastModified={lastModified} dateLocale={dateLocale} />}
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
            <PrintPlanButton />
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
          title={withHint(t('planner.reset'), 'closeSession')}
          data-reset-trigger
          {...hintAttrs('closeSession')}
        >
          <X className="h-4 w-4" />
        </Button>

        <Drawer open={isMobile && sharePopoverOpen} onOpenChange={setSharePopoverOpen}>
          <DrawerContent className="max-h-[92dvh] print:hidden">
            <div className="overflow-y-auto px-4 pb-4">
              <SharePopoverContent {...sharePopoverContentProps} />
              <Separator className="mt-6" />
              <PrintPlanButton />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
};
