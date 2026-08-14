/**
 * LandingPage — Dynamic landing page route (/:slug and /en/:slug).
 *
 * Role: Hero copy and SEO content with its own slug on the empty state.
 *       Also template mode: renders the workshop planner pre-filled with
 *       content from the landing page JSON (prefillData).
 *       Publishes alternate-language URLs so the Language Switcher can navigate correctly.
 */
import { useMemo } from 'react';
import { useLayoutEffect } from 'react';
import { useLoaderData, useLocation, useNavigate } from 'react-router-dom';
import { WorkshopPlanner } from '@/components/states/WorkshopPlanner';
import { EmptyStateHero, EmptyStateSEO } from '@/components/states/EmptyState';
import { LandingPageContent } from '@/types/landingPage';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { useLocale } from '@/contexts/LocaleContext';
import { deriveFaqPageSchema, mergeStructuredData } from '@/lib/landingPageSeo';
import { LOCALE_PREFIX } from '@/lib/metaConfig';

const LandingPage = () => {
  const content = useLoaderData() as LandingPageContent;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { locale, publishAlternates } = useLocale();

  // Publish alternate URLs from content JSON so Language Switcher can use them.
  // useLayoutEffect (not useEffect) ensures alternates are in context before any
  // useEffect runs — specifically before App.tsx signals prerender ready via rAF.
  useLayoutEffect(() => {
    publishAlternates(content.alternates);
  }, [content.alternates, publishAlternates]);

  const structuredData = useMemo(
    () =>
      mergeStructuredData(
        content.structuredData,
        deriveFaqPageSchema(
          content.emptyStateFallback?.seoContent?.sections ?? content.seoContent?.sections,
        ),
      ),
    [content.structuredData, content.emptyStateFallback, content.seoContent],
  );

  return (
    <>
      <DocumentMeta
        title={content.metaTitle || content.title}
        description={content.metaDescription}
        canonicalPath={pathname}
        locale={locale}
        alternates={content.alternates}
        ogImage={content.ogImage}
        structuredData={structuredData}
      />
      <WorkshopPlanner
        key={pathname}
        prefillData={content.prefillData}
        onReset={() => {
          if (content.type === 'template' && content.fallbackSlug && content.fallbackSlug !== content.slug) {
            navigate(`${LOCALE_PREFIX[locale]}/${content.fallbackSlug}`);
          }
        }}
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

export default LandingPage;
