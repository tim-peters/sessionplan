import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/button';
import { Textarea } from '@/components/primitives/textarea';
import { AGENT_BRIEFING_TEMPLATE, API_SKILL_URL, OPENAPI_URL, copyToClipboard } from '@/lib/ai-import';

/**
 * Tab content for "Weg C — Code-Agent".
 *
 * Localized briefing is composed from the `settings.aiAgent*` keys via
 * AGENT_BRIEFING_TEMPLATE; we still build the link list (API skill +
 * OpenAPI spec) directly from the URLs in ai-import.ts.
 */
export const AiImportPathAgent = () => {
  const { t } = useTranslation('common');
  const briefing = AGENT_BRIEFING_TEMPLATE(
    API_SKILL_URL,
    t('settings.aiAgentBriefing'),
    t('settings.aiAgentBriefingDescriptionPlaceholder')
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(briefing);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('settings.aiAgentIntro')}</p>
      <div className="space-y-2">
        <label htmlFor="ai-agent-briefing" className="text-sm font-medium">
          {t('settings.aiAgentBriefingLabel')}
        </label>
        <Textarea
          id="ai-agent-briefing"
          value={briefing}
          readOnly
          className="min-h-28 resize-none"
        />
      </div>
      <Button type="button" onClick={handleCopy} className="w-full sm:w-auto">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? t('settings.aiAgentBriefingCopied') : t('settings.aiCopyAgentBriefing')}
      </Button>

      <div className="space-x-3 border-t pt-4">
        <a
          href={API_SKILL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {t('settings.aiApiSkillLink')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href={OPENAPI_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {t('settings.aiAgentOpenApiLink')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
};
