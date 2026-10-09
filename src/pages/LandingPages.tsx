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
import { TemplateHeader } from '@/components/layout/TemplateHeader';
import { HubFilter } from '@/components/atoms/HubFilter';
import { LandingPageContent } from '@/types/landingPage';
import type { Hub } from '@/types/hub';
import { signalPrerenderReady } from '@/lib/prerender';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalePrefix, getLocaleRoot, createSymmetricAlternates } from '@/lib/localeUtils';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { getCanonicalUrl, getOrganizationSchema } from '@/lib/metaConfig';
import { createCollectionPageSchema } from '@/lib/collectionStructuredData';
import { buildBreadcrumbList } from '@/lib/breadcrumbStructuredData';

interface LandingPagesLoaderData {
  index: { pages: Array<{ slug: string }> };
  pages: Promise<LandingPageContent[]>;
  hubs: Hub[];
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
            {decodeHtmlEntities(page.title)}
          </h2>
          <p className="text-muted-foreground text-sm line-clamp-3">
            {decodeHtmlEntities(page.metaDescription || page.heroDescription)}
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
  const { pages, hubs } = useLoaderData() as LandingPagesLoaderData;
  const { locale } = useLocale();

  const localePrefix = getLocalePrefix(locale);
  const canonicalPath = `${localePrefix}/landing-pages`;
  const alternates = createSymmetricAlternates('/landing-pages');

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TemplateHeader
            title={t('landingPages.heading')}
            subtitle={t('landingPages.subheading')}
            breadcrumbs={[{ label: t('landingPages.heading') }]}
            className="max-w-2xl"
          />

          {hubs && hubs.length > 0 && (
            <HubFilter
              hubs={hubs}
              basePath="/landing-pages"
              allLabel={t('landingPages.allPages')}
              filterLabel={t('landingPages.filterLabel')}
            />
          )}

          <Suspense fallback={
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('loading')}</p>
            </div>
          }>
            <Await resolve={pages}>
              {(loadedPages: LandingPageContent[]) => {
                // Filter out templates (only show landing pages)
                const landingPages = loadedPages.filter(page => page.type !== 'template');
                const structuredData = createCollectionPageSchema({
                  url: getCanonicalUrl(canonicalPath),
                  name: t('landingPages.title'),
                  description: t('landingPages.description'),
                  locale,
                  items: landingPages.map((page) => ({
                    url: getCanonicalUrl(`${localePrefix}/${page.slug}`),
                    name: decodeHtmlEntities(page.title),
                    description: decodeHtmlEntities(page.metaDescription || page.heroDescription),
                    itemType: 'WebPage',
                  })),
                });
                const breadcrumbSchema = buildBreadcrumbList([
                  { name: 'Sessionplan', path: getLocaleRoot(locale) },
                  { name: t('landingPages.heading') },
                ]);

                return (
                  <>
                    <DocumentMeta
                      title={t('landingPages.title')}
                      description={t('landingPages.description')}
                      canonicalPath={canonicalPath}
                      locale={locale}
                      alternates={alternates}
                      structuredData={[structuredData, getOrganizationSchema(), breadcrumbSchema]}
                    />
                    <LandingPagesGrid pages={landingPages} localePrefix={localePrefix} />
                  </>
                );
              }}
            </Await>
          </Suspense>

        </div>
        <div className="mx-6 md:mx-0">
          <PageFooter />
        </div>
      </div>
    </>
  );
};

export default LandingPages;
