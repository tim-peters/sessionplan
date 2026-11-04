import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/primitives/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/primitives/drawer';
import { AiImportPathConnect } from '@/modules/sidebar/AiImportPathConnect';
import { AiImportPathManual } from '@/modules/sidebar/AiImportPathManual';
import { AiImportPathAgent } from '@/modules/sidebar/AiImportPathAgent';

type AiPath = 'connect' | 'manual' | 'agent';
const DEFAULT_PATH: AiPath = 'connect';

interface AiImportHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportText?: (text: string) => Promise<void>;
  onImportFile?: (file: File) => Promise<void>;
}

/**
 * Orchestrator for the AI-assisted session import dialog.
 *
 * Owns the dialog/drawer shell, the tab state, the manual-tab state (so user
 * input survives tab switches — Radix TabsContent unmounts inactive panels),
 * and the tracking of tab views. Delegates pure presentation to one of three
 * "path" components. `onImportText` / `onImportFile` are only relevant for the
 * manual path.
 */
export const AiImportHelpDialog = ({ open, onOpenChange, onImportText, onImportFile }: AiImportHelpDialogProps) => {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const [activePath, setActivePath] = useState<AiPath>(DEFAULT_PATH);

  // Manual-tab state lives here (not in AiImportPathManual) so the user-typed
  // response, copy-button feedback, validation error and picker ref survive
  // Radix unmounting inactive TabsContent panels.
  const [response, setResponse] = useState('');
  const [manualCopied, setManualCopied] = useState(false);
  const [importError, setImportError] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Always record the currently active tab whenever the dialog becomes
    // visible — this covers both the first open and re-opens after a tab
    // switch (otherwise the default tab would mask the user's choice).
    if (!open) return;
  }, [open, activePath]);

  const handleManualImported = useCallback(() => {
    setResponse('');
    setImportError(false);
    setIsImporting(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleImportText = useCallback(
    async (text: string) => {
      if (!onImportText) return;
      setIsImporting(true);
      setImportError(false);
      try {
        await onImportText(text);
        handleManualImported();
      } catch {
        setImportError(true);
        setIsImporting(false);
      }
    },
    [onImportText, handleManualImported]
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!onImportFile) return;
      setIsImporting(true);
      try {
        await onImportFile(file);
        handleManualImported();
      } catch {
        // File import failures show the same error banner as text imports;
        // don't close the dialog so the user can retry with a different file.
        setImportError(true);
        setIsImporting(false);
      }
    },
    [onImportFile, handleManualImported]
  );

  const tabs = (
    <Tabs
      value={activePath}
      onValueChange={(value) => setActivePath(value as AiPath)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="connect" className="h-8 px-2 text-xs sm:px-3 sm:text-sm">
          {isMobile ? t('settings.aiTabConnectShort') : t('settings.aiTabConnect')}
        </TabsTrigger>
        <TabsTrigger value="manual" className="h-8 px-2 text-xs sm:px-3 sm:text-sm">
          {isMobile ? t('settings.aiTabManualShort') : t('settings.aiTabManual')}
        </TabsTrigger>
        <TabsTrigger value="agent" className="h-8 px-2 text-xs sm:px-3 sm:text-sm">
          {isMobile ? t('settings.aiTabAgentShort') : t('settings.aiTabAgent')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="connect" className="mt-4 focus-visible:outline-none">
        <AiImportPathConnect />
      </TabsContent>
      <TabsContent value="manual" className="mt-4 focus-visible:outline-none">
        <AiImportPathManual
          response={response}
          onResponseChange={(value) => {
            setResponse(value);
            setImportError(false);
          }}
          copied={manualCopied}
          onCopiedChange={setManualCopied}
          importError={importError}
          isImporting={isImporting}
          onImportText={onImportText ? handleImportText : undefined}
          onImportFile={onImportFile ? handleImportFile : undefined}
          onPickFile={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
        />
      </TabsContent>
      <TabsContent value="agent" className="mt-4 focus-visible:outline-none">
        <AiImportPathAgent />
      </TabsContent>
    </Tabs>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-text" />
              {t('settings.aiTitle')}
            </DrawerTitle>
            <DrawerDescription>{t('settings.aiDescription')}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{tabs}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-text" />
            {t('settings.aiTitle')}
          </DialogTitle>
          <DialogDescription>{t('settings.aiDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{tabs}</div>
      </DialogContent>
    </Dialog>
  );
};
