import { ChevronDown, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/primitives/badge';
import { Button } from '@/components/primitives/button';
import { SeoSection } from '@/components/landingcontent/SeoSection';
import { LandingPageContent } from '@/types/landingPage';
import { SessionHistoryEntry } from '@/types/sessionHistory';
import { getSessionHistory } from '@/lib/workshopLocalStorage';
import { SessionHistoryList } from '@/components/sections/SessionHistoryList';

interface EmptyStateHeroProps {
  onAddBlock: () => void;
  landingPageContent?: LandingPageContent;
  onReopenSession?: (entry: SessionHistoryEntry) => void;
}

const renderWithPrimary = (text: string) =>
  text.split(/\*([^*]+)\*/).map((part, i) =>
    i % 2 === 1 ? <span key={i} className="text-primary">{part}</span> : part
  );

export const EmptyStateHero = ({ onAddBlock, landingPageContent, onReopenSession }: EmptyStateHeroProps) => {
  const { t } = useTranslation('common');
  const emptyStateContent = landingPageContent?.type === 'template' && landingPageContent.emptyStateFallback
    ? landingPageContent.emptyStateFallback
    : landingPageContent;

  const heroTitle = emptyStateContent?.heroTitle || 'Workshop Agenda erstellen';
  const heroDescription = emptyStateContent?.heroDescription || 'Plane deine Agenda visuell auf einer Timeline.';
  const ctaText = emptyStateContent?.ctaText || 'Session erstellen';
  const exampleSlug = emptyStateContent?.exampleSlug;

  // Show session history list instead of the preview image when sessions exist.
  // Always start with false (matching the prerendered DOM, which always has an
  // <img>) so hydration doesn't see a mismatch. Then read localStorage once on
  // the client to flip the state if needed.
  const [hasSessions, setHasSessions] = useState(false);
  useEffect(() => {
    setHasSessions(getSessionHistory().length > 0);
  }, []);

  const { resolvedTheme } = useTheme();
  const [previewSrc, setPreviewSrc] = useState(
    () => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? '/assets/preview-dark.png'
      : '/assets/preview.png')
  );
  useEffect(() => {
    setPreviewSrc(resolvedTheme === 'dark' ? '/assets/preview-dark.png' : '/assets/preview.png');
  }, [resolvedTheme]);

  return (
    <div id="hero-planner" className="relative mx-auto min-h-[calc(100vh-260px)] lg:pt-[4vh] sm:px-6">    
      {/* Content */}
      <div className="relative z-10 mx-auto lg:px-10 flex items-center justify-center gap-8 md:gap-16 flex-col md:flex-row">
        <div className="flex-1 max-w-md">
          <div className="flex flex-wrap gap-2 mb-3 -ml-2">
            <Badge variant="secondary" className="text-primary">{t('emptyState.freeTier')}</Badge>
            <Badge variant="secondary" className="text-primary">{t('emptyState.noRegistration')}</Badge>
            <Badge variant="secondary" className="text-primary">{t('emptyState.privateByDesign')}</Badge>
          </div>
          <h1 className="text-4xl leading-10 xl:text-5xl xl:leading-[3.5rem] font-bold my-6">
            {renderWithPrimary(heroTitle)}
          </h1>
          <p className="my-8 text-sm lg:text-md">
            {heroDescription}
            {!emptyStateContent && (
              <>
                <br />
                {t('emptyState.devWarning')}
              </>
            )}
          </p>
          <Button onClick={onAddBlock} className="gap-2 mt-4 mr-4" size="lg">
            <Plus className="h-4 w-4" />
            {ctaText}
          </Button>
          {exampleSlug && (
            <>
            <Button variant="secondary" size="lg" className={`mt-2${hasSessions ? ' hidden lg:inline-flex' : ''}`} asChild>
              <Link to={`/${exampleSlug}`}>{t('emptyState.openExample')}</Link>
            </Button>
            </>
          )}
        </div>
        <div className="w-full flex-1 max-w-md">
          {hasSessions && onReopenSession ? (
            <SessionHistoryList onReopenSession={onReopenSession} onEmpty={() => setHasSessions(false)} />
          ) : (
            <img
            src={previewSrc}
            alt="Sessionplan Workshop Agenda Example Preview"
            aria-hidden="true"
            className="-mx-10  max-w-[calc(100%+5rem)] md:-mx-5 xl:mx-auto xl:max-w-full"
          />
          )}
        </div>
      </div>
    </div>
  );
};

interface EmptyStateSEOProps {
  onAddBlock: () => void;
  landingPageContent?: LandingPageContent;
}

export const EmptyStateSEO = ({ onAddBlock, landingPageContent }: EmptyStateSEOProps) => {
  const { t } = useTranslation('common');
  const emptyStateContent = landingPageContent?.type === 'template' && landingPageContent.emptyStateFallback
    ? landingPageContent.emptyStateFallback
    : landingPageContent;

  // SEO content section for homepage and landing pages.
  // Each section renders as a full-bleed <section> with its own background;
  // the outer wrapper just provides the scroll target and bottom padding.
  const sections = emptyStateContent?.seoContent?.sections;

  return (
    <div id="seo-content">
      <div className="my-8 flex justify-center">
        <a
          href="#seo-content"
          aria-label={t('emptyState.scrollLabel')}
          className="group inline-flex flex-col items-center gap-2 text-muted-foreground transition hover:text-foreground"
        >
          <span className="text-xs font-medium uppercase tracking-[0.18em]">{t('emptyState.learnMore')}</span>
          <span className="inline-flex h-10 w-10 items-center justify-center">
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </span>
        </a>
      </div>

      {sections?.length ? (
        <div id="landing-sections">
          {sections.map((section, idx) => (
            <SeoSection
              key={`${section.type ?? 'prose'}-${idx}`}
              section={section}
              onAddBlock={onAddBlock}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
