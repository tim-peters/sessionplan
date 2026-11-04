/**
 * LandingPageHub — Hub page for curated landing-page collections
 *                  (e.g. /landing-pages/workshops).
 *
 * Role: Thin configuration + card renderer on top of `HubCollection`. The hub
 *       loader (`landingPageHubLoader`) is a thin wrapper around
 *       `createHubLoader('landing')` so we get the same `{ items, hub, hubs }`
 *       shape; this page maps `items` to the `pages` field HubCollection
 *       iterates.
 *
 *       Cards mirror the style of `LandingPages.tsx` (Link-block with title,
 *       excerpt, "Learn more" CTA). The grid + SEO wiring is owned by
 *       `HubCollection`.
 */
import { useTranslation } from 'react-i18next';
import type { LandingPageHubMember } from '@/lib/routeLoaders';
import { HubCollection, type HubCollectionConfig } from '@/components/sections/HubCollection';
import { LandingPageCard } from '@/components/sections/LandingPageCard';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath } from '@/lib/localeUtils';
import { decodeHtmlEntities } from '@/lib/htmlEntities';

const LandingPageHub = () => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();

  const config: HubCollectionConfig<LandingPageHubMember> = {
    backPath: '/landing-pages',
    backLabel: t('landingPages.backToOverview'),
    filterAllLabel: t('landingPages.allPages'),
    filterLabel: t('landingPages.filterLabel'),
    emptyLabel: t('landingPages.title'),
    gridAriaLabel: t('landingPages.title'),
    breadcrumbs: [{ label: t('landingPages.heading'), path: getLocalizedPath(locale, '/landing-pages') }],
    toSchemaItem: (page) => ({
      url: getLocalizedPath(locale, `/${page.slug}`),
      name: decodeHtmlEntities(page.title),
      description: decodeHtmlEntities(page.metaDescription || page.heroDescription),
      itemType: 'WebPage',
    }),
  };

  return (
    <HubCollection<LandingPageHubMember>
      config={config}
      renderCard={(page) => (
        <LandingPageCard
          to={getLocalizedPath(locale, `/${page.slug}`)}
          title={page.title}
          description={page.metaDescription || page.heroDescription}
          className="h-full"
        />
      )}
    />
  );
};

export default LandingPageHub;