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
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LandingPageHubMember } from '@/lib/routeLoaders';
import { HubCollection, type HubCollectionConfig } from '@/components/sections/HubCollection';
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
        <Link
          to={getLocalizedPath(locale, `/${page.slug}`)}
          className="group block p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all bg-card h-full"
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
      )}
    />
  );
};

export default LandingPageHub;