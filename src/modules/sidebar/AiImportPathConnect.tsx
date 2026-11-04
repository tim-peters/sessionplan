import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/primitives/button';
import { Textarea } from '@/components/primitives/textarea';
import {
  CLAUDE_PLUGIN_REPO_URL,
  MCP_DOCS_URL,
  buildClaudeInstallSnippet,
  copyToClipboard,
  getChatgptAppUrl,
} from '@/lib/ai-import';

/**
 * Tab content for "Weg A — Direkt verbinden (MCP)".
 *
 * Always renders both the Claude and ChatGPT sections. The ChatGPT URL
 * comes from getChatgptAppUrl() (env override or hardcoded default), so
 * local/dev builds without env vars still see the ChatGPT alternative.
 */
export const AiImportPathConnect = () => {
  const { t } = useTranslation('common');
  const chatgptUrl = getChatgptAppUrl();
  const claudeInstallSnippet = buildClaudeInstallSnippet();
  const [copied, setCopied] = useState(false);
  const examplePrompt = t('settings.aiConnectClaudePromptExample');

  const handleCopy = async () => {
    const ok = await copyToClipboard(claudeInstallSnippet);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('settings.aiConnectIntro')}</p>

      {/* ChatGPT section (rendered first; the app URL resolver always yields a
          value — env overrides first, hardcoded public plugin URL as default) */}
      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-semibold">{t('settings.aiConnectChatgptTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.aiConnectChatgptDescription')}</p>
        <a
          href={chatgptUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-text underline-offset-4 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('settings.aiOpenCustomGpt')}
        </a>
      </section>

      {/* Claude section */}
      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-semibold">{t('settings.aiConnectClaudeTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.aiConnectClaudeDescription')}</p>
        <Textarea
          readOnly
          value={claudeInstallSnippet}
          className="min-h-16 resize-none font-mono text-xs"
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
          <Button type="button" onClick={handleCopy} className="w-full sm:w-auto">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t('settings.aiPromptCopied') : t('settings.aiCopyInstallSnippet')}
          </Button>
          <a
            href={CLAUDE_PLUGIN_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-text underline-offset-4 hover:underline"
          >
            {t('settings.aiConnectClaudeRepoLink')}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('settings.aiConnectClaudeExample', { prompt: examplePrompt })}
        </p>
      </section>

      {/* Footer — single MCP technical-docs link */}
      <div className="border-t pt-4">
        <a
          href={MCP_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {t('settings.aiConnectMcpDocsLink')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
};
