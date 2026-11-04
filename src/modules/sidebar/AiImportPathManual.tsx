import type { RefObject } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/button';
import { Textarea } from '@/components/primitives/textarea';
import { SCHEMA_URL, copyToClipboard } from '@/lib/ai-import';

interface AiImportPathManualProps {
  /** Current value of the pasted-JSON textarea. Controlled by the orchestrator. */
  response: string;
  onResponseChange: (value: string) => void;
  /** Copy-button "copied" indicator. */
  copied: boolean;
  onCopiedChange: (copied: boolean) => void;
  /** True when the most recent import attempt was rejected by the validator. */
  importError: boolean;
  /** True while an import is in flight (disables buttons). */
  isImporting: boolean;
  /** Import the JSON text the user pasted. Throws on invalid schema. */
  onImportText?: (text: string) => Promise<void>;
  /** Import a JSON file picked via the system file picker. */
  onImportFile?: (file: File) => Promise<void>;
  /** Open the hidden file picker. */
  onPickFile: () => void;
  /** Ref the path attaches to the <input type="file"> element. */
  fileInputRef: RefObject<HTMLInputElement>;
}

/**
 * Tab content for "Weg B — Manuell (Copy-Prompt & JSON einfügen)".
 *
 * Pure presentational: state (response text, copy feedback, validation
 * error, importing flag) and the file picker ref live in the orchestrator
 * so they survive tab switches. Imports are dispatched through `copyToClipboard`
 * and the shared tracking helpers.
 */
export const AiImportPathManual = ({
  response,
  onResponseChange,
  copied,
  onCopiedChange,
  importError,
  isImporting,
  onImportText,
  onImportFile,
  onPickFile,
  fileInputRef,
}: AiImportPathManualProps) => {
  const { t } = useTranslation('common');
  const prompt = t('settings.aiPrompt', { schemaUrl: SCHEMA_URL });

  const handleCopy = async () => {
    const ok = await copyToClipboard(prompt);
    if (!ok) return;
    onCopiedChange(true);
    window.setTimeout(() => onCopiedChange(false), 2000);
  };

  const handleImport = () => {
    if (!response.trim() || !onImportText) return;
    void onImportText(response);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onImportFile) return;
    void onImportFile(file);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('settings.aiManualIntro')}</p>
      <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
        <li>{t('settings.aiManualStep1')}</li>
        <li>{t('settings.aiManualStep2')}</li>
        <li>{t('settings.aiManualStep3')}</li>
      </ol>

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
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {t('settings.aiSchemaLink')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="space-y-2 border-t pt-4">
        <label htmlFor="ai-response" className="text-sm font-medium">
          {t('settings.aiResponseLabel')}
        </label>
        <Textarea
          id="ai-response"
          aria-invalid={importError || undefined}
          aria-describedby={importError ? 'ai-response-error' : undefined}
          value={response}
          onChange={(event) => onResponseChange(event.target.value)}
          placeholder={t('settings.aiResponsePlaceholder')}
          className="min-h-36 font-mono text-xs"
          spellCheck={false}
        />
        {importError && <p id="ai-response-error" role="alert" className="text-sm text-destructive-text">{t('settings.aiResponseError')}</p>}
        <div className="flex justify-between gap-2 flex-col sm:flex-row items-start sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={onPickFile}
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
            aria-busy={isImporting}
            disabled={!response.trim() || isImporting || !onImportText}
            className="w-full sm:w-auto"
          >
            {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('settings.aiImportResponse')}
          </Button>
        </div>
      </div>
    </div>
  );
};
