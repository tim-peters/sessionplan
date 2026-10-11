import { useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/dialog';
import { Button } from '@/components/primitives/button';
import { Textarea } from '@/components/primitives/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/primitives/drawer';

const SCHEMA_URL = 'https://sessionplan.de/import-schema.md';
const API_SKILL_URL = 'https://sessionplan.de/data/sessionplan-api.md';
const CUSTOM_GPT_URL = import.meta.env.VITE_SESSIONPLAN_CUSTOM_GPT_URL as string | undefined;

interface AiImportHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportText?: (text: string) => Promise<void>;
  onImportFile?: (file: File) => Promise<void>;
}

export const AiImportHelpDialog = ({ open, onOpenChange, onImportText, onImportFile }: AiImportHelpDialogProps) => {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [response, setResponse] = useState('');
  const [importError, setImportError] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prompt = t('settings.aiPrompt', { schemaUrl: SCHEMA_URL });

  const handleCopy = async () => {
    let copiedSuccessfully = false;
    try {
      await navigator.clipboard.writeText(prompt);
      copiedSuccessfully = true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = prompt;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      copiedSuccessfully = document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    if (!copiedSuccessfully) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = async () => {
    if (!response.trim() || !onImportText) return;
    setIsImporting(true);
    setImportError(false);
    try {
      await onImportText(response);
      setResponse('');
      onOpenChange(false);
    } catch {
      setImportError(true);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onImportFile) return;

    setIsImporting(true);
    try {
      await onImportFile(file);
      onOpenChange(false);
    } finally {
      setIsImporting(false);
    }
  };

  const body = (
    <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="ai-prompt" className="text-sm font-medium">
              {t('settings.aiPromptLabel')}
            </label>
            <Textarea id="ai-prompt" value={prompt} readOnly className="min-h-28 resize-none" />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
            <Button type="button" onClick={handleCopy} className="w-full sm:w-auto">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('settings.aiPromptCopied') : t('settings.aiCopyPrompt')}
            </Button>
            <a
              href={SCHEMA_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('settings.aiSchemaLink')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {CUSTOM_GPT_URL && (
            <a
              href={CUSTOM_GPT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('settings.aiOpenCustomGpt')}
            </a>
          )}
          <div className="space-y-2 border-t pt-4">
            <label htmlFor="ai-response" className="text-sm font-medium">
              {t('settings.aiResponseLabel')}
            </label>
            <Textarea
              id="ai-response"
              value={response}
              onChange={(event) => {
                setResponse(event.target.value);
                setImportError(false);
              }}
              placeholder={t('settings.aiResponsePlaceholder')}
              className="min-h-36 font-mono text-xs"
              spellCheck={false}
            />
            {importError && <p className="text-sm text-destructive">{t('settings.aiResponseError')}</p>}
            <div className="flex justify-between gap-2 flex-col sm:flex-row items-start sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting || !onImportFile}
                className="w-full sm:w-auto"
              >
                {t('settings.aiChooseFile')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                onClick={handleImport}
                disabled={!response.trim() || isImporting || !onImportText}
                className="w-full sm:w-auto"
              >
                {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('settings.aiImportResponse')}
             </Button>
            </div>
          </div>
          <div className="space-y-2 border-t pt-4">
            <a
              href={API_SKILL_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('settings.aiApiSkillLink')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('settings.aiTitle')}
            </DrawerTitle>
            <DrawerDescription>{t('settings.aiDescription')}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('settings.aiTitle')}
          </DialogTitle>
          <DialogDescription>{t('settings.aiDescription')}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
};
