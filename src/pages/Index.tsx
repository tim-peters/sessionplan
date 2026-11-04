/**
 * Index — Home page route (/ and /en).
 *
 * Role: Renders the workshop planner without prefill data. Loader fetches the
 *       home page landing content (title, meta, hero copy) from public/data.
 *       SEO tags are set via DocumentMeta; workshop state initialises from
 *       URL hash or localStorage.
 */
import { useMemo } from 'react';
import { useLoaderData, useSearchParams } from 'react-router-dom';
import { WorkshopPlanner } from '@/components/states/WorkshopPlanner';
import { EmptyStateHero, EmptyStateSEO } from '@/components/states/EmptyState';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { LandingPageContent } from '@/types/landingPage';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocaleRoot } from '@/lib/localeUtils';
import { appendGraphNodes, deriveFaqPageSchema, mergeStructuredData, withAggregateRating, withApplicationSameAs } from '@/lib/landingPageSeo';
import { siteApplicationSameAs } from '@/integrations/site';
import { getOrganizationSchema, getWebSiteSchema } from '@/lib/metaConfig';

const Index = () => {
  const content = useLoaderData() as LandingPageContent;
  const { locale } = useLocale();
  const [searchParams] = useSearchParams();
  const isSharedSession = searchParams.has('id');

  // The home page always has a symmetric alternate in the other language
  const homeAlternates = {
    de: '/',
    en: '/en',
  };

  const structuredData = useMemo(
    () =>
      appendGraphNodes(
        withApplicationSameAs(
          withAggregateRating(
            mergeStructuredData(
              content.structuredData,
              deriveFaqPageSchema(
                content.emptyStateFallback?.seoContent?.sections ?? content.seoContent?.sections,
              ),
            ),
            content.siteStats?.rating,
          ),
          siteApplicationSameAs,
        ),
        [getOrganizationSchema(), getWebSiteSchema()],
      ),
    [content.structuredData, content.emptyStateFallback, content.seoContent, content.siteStats],
  );

  return (
    <>
      <DocumentMeta
        title={content.metaTitle || content.title}
        description={content.metaDescription}
        canonicalPath={getLocaleRoot(locale)}
        locale={locale}
        alternates={homeAlternates}
        ogImage={content.ogImage}
        structuredData={structuredData}
        noindex={isSharedSession}
      />
      <WorkshopPlanner
        prefillData={content.prefillData}
        renderEmptyState={({ onAddBlock, onReopenSession }) => (
          <>
            <EmptyStateHero
              onAddBlock={onAddBlock}
              landingPageContent={content}
              onReopenSession={onReopenSession}
            />
            <EmptyStateSEO onAddBlock={onAddBlock} landingPageContent={content} />
          </>
        )}
      />
    </>
  );
};

export default Index;
