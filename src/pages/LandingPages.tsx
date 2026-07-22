/**
 * LandingPages — Landing pages index route (/landing-pages and /en/landing-pages).
 *
 * Role: Overview of all topic-specific landing pages (use-case entry points).
 *       Not pre-rendered (excluded from prerender script). Content loaded
 *       via landingPagesLoader.
 */
import { Suspense, useEffect } from 'react';
import { Link, useLoaderData, Await } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { PageFooter } from '@/components/layout/PageFooter';
import { TemplateHeader } from '@/components/sections/TemplateHeader';
import { LandingPageContent } from '@/types/landingPage';
import { signalPrerenderReady } from '@/lib/prerender';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalePrefix, getLocaleRoot, createSymmetricAlternates } from '@/lib/localeUtils';

interface LandingPagesLoaderData {
  index: { pages: Array<{ slug: string }> };
  pages: Promise<LandingPageContent[]>;
}

interface LandingPagesGridProps {
  pages: LandingPageContent[];
  localePrefix: string;
}

const LandingPagesGrid = ({ pages, localePrefix }: LandingPagesGridProps) => {
  const { t } = useTranslation('common');

  useEffect(() => {
    let secondFrame: number | undefined;

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        signalPrerenderReady();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
      {pages.map((page) => (
        <Link
          key={page.slug}
          to={`${localePrefix}/${page.slug}`}
          className="group block p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all bg-card"
        >
          <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
            {page.title}
          </h2>
          <p className="text-muted-foreground text-sm line-clamp-3">
            {page.metaDescription || page.heroDescription}
          </p>
          <span className="inline-block mt-4 text-primary text-sm font-medium">
            {t('landingPages.learnMore')} →
          </span>
        </Link>
      ))}
    </div>
  );
};

const LandingPages = () => {
  const { t } = useTranslation('common');
  const { pages } = useLoaderData() as LandingPagesLoaderData;
  const { locale } = useLocale();

  const localePrefix = getLocalePrefix(locale);
  const canonicalPath = `${localePrefix}/landing-pages`;
  const alternates = createSymmetricAlternates('/landing-pages');

  return (
    <>
      <DocumentMeta
        title={t('landingPages.title')}
        description={t('landingPages.description')}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={alternates}
      />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TemplateHeader
            backTo={getLocaleRoot(locale)}
            backLabel={t('nav.backToPlanner')}
            title={t('landingPages.heading')}
            subtitle={t('landingPages.subheading')}
            className="max-w-2xl"
          />

          <Suspense fallback={
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('loading')}</p>
            </div>
          }>
            <Await resolve={pages}>
              {(loadedPages: LandingPageContent[]) => {
                // Filter out templates (only show landing pages)
                const landingPages = loadedPages.filter(page => page.type !== 'template');

                return <LandingPagesGrid pages={landingPages} localePrefix={localePrefix} />;
              }}
            </Await>
          </Suspense>

        </div>
        <PageFooter />
      </div>
    </>
  );
};

export default LandingPages;
