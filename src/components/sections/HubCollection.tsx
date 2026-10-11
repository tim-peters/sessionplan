/**
 * HubCollection — shared composition for hub pages (templates / blog / landing).
 *
 * Role: Provides the canonical hub-page layout — DocumentMeta with
 *       CollectionPage JSON-LD + BreadcrumbList, TemplateHeader, HubFilter,
 *       optional intro, card grid via a `renderCard` prop, empty state, and a
 *       "back to index" link. Pages configure the rendering of each card and
 *       which fields to display; this section owns the page-level composition
 *       and SEO wiring.
 *
 * Generalized from the old `TemplateCategory.tsx`. Now reused by templates,
 * blog, and landing hub pages (Phase 2/3).
 */
import { ReactNode, useLayoutEffect } from 'react';
import { Link, useLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Hub } from '@/types/hub';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { TemplateHeader } from '@/components/layout/TemplateHeader';
import { HubFilter } from '@/components/atoms/HubFilter';
import { PageFooter } from '@/components/layout/PageFooter';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocaleRoot, getLocalizedPath } from '@/lib/localeUtils';
import { getCanonicalUrl, getOrganizationSchema } from '@/lib/metaConfig';
import { createCollectionPageSchema, type CollectionSchemaItem } from '@/lib/collectionStructuredData';
import { buildBreadcrumbList } from '@/lib/breadcrumbStructuredData';

interface Breadcrumb {
  /** Visible label, must match the visual breadcrumb rendered by `TemplateHeader`. */
  label: string;
  /** Optional link target; omit for the current page (renders as `BreadcrumbPage`). */
  path?: string;
}

export interface HubCollectionConfig<TItem> {
  /**
   * Schema.org collection item descriptor built from a member.
   * Maps the page-specific item to the shape `createCollectionPageSchema` expects.
   */
  toSchemaItem: (item: TItem) => CollectionSchemaItem;
  /** Visual crumb chain rendered in the header (and JSON-LD breadcrumb). */
  breadcrumbs: Breadcrumb[];
  /** Locale-aware base path used for the "back to index" link and the HubFilter's "All" chip. */
  backPath: string;
  /** Translated label for the "back to index" link, e.g. "Alle Templates anzeigen →". */
  backLabel: string;
  /** Translated label for the HubFilter's "all" chip, e.g. "Alle". */
  filterAllLabel: string;
  /** Translated accessible name for the HubFilter nav, e.g. t('templates.filterLabel'). */
  filterLabel: string;
  /** Translated label shown when the hub has no items, e.g. "Noch keine Templates vorhanden.". */
  emptyLabel: string;
  /**
   * `aria-label` for the grid region. If omitted, defaults to a generic
   * locale-aware label so screen readers can announce the grid.
   */
  gridAriaLabel?: string;
}

export interface HubCollectionProps<TItem> {
  /** Hub page config — see `HubCollectionConfig`. */
  config: HubCollectionConfig<TItem>;
  /**
   * Renders a single card for a member item. The grid layout (3-column on
   * `lg`, 2-column on `md`, 1-column on mobile) is owned by this section.
   */
  renderCard: (item: TItem) => ReactNode;
  /** Override the default empty-state component. */
  renderEmpty?: () => ReactNode;
  /**
   * Optional hooks the page can use to publish data into context (e.g.
   * `useLocale().publishAlternates`). Called inside a layout effect so the
   * Language Switcher sees the alternates before any user-effect runs.
   */
  onAfterRender?: () => void;
}

export function HubCollection<TItem>({
  config,
  renderCard,
  renderEmpty,
  onAfterRender,
}: HubCollectionProps<TItem>) {
  const { t } = useTranslation('common');
  const { items, hub, hubs } = useLoaderData() as {
    items: TItem[];
    hub: Hub;
    hubs: Hub[];
  };
  const { locale, publishAlternates } = useLocale();

  // Publish the locale counterpart URL so the Language Switcher can navigate
  // between e.g. /templates/retrospektive and /en/templates/retrospective.
  // useLayoutEffect (not useEffect) ensures alternates are in context before
  // any useEffect runs — specifically before App.tsx signals prerender ready
  // via rAF.
  useLayoutEffect(() => {
    publishAlternates(hub.alternates);
    onAfterRender?.();
  }, [hub.alternates, publishAlternates, onAfterRender]);

  const canonicalPath = getLocalizedPath(locale, `${config.backPath}/${hub.slug}`);
  const alternates = hub.alternates ?? {};

  const structuredData = createCollectionPageSchema({
    url: getCanonicalUrl(canonicalPath),
    name: hub.title,
    description: hub.description,
    locale,
    items: (items ?? []).map(config.toSchemaItem),
  });

  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Sessionplan', path: getLocaleRoot(locale) },
    ...config.breadcrumbs.map((crumb) => ({
      name: crumb.label,
      ...(crumb.path ? { path: crumb.path } : {}),
    })),
    { name: hub.title },
  ]);

  const itemList = (items ?? []).map((item) => (
    <div key={(item as { slug?: string }).slug ?? Math.random()}>{renderCard(item)}</div>
  ));

  return (
    <>
      <DocumentMeta
        title={hub.title}
        description={hub.description}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={alternates}
        structuredData={[structuredData, getOrganizationSchema(), breadcrumbSchema]}
      />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TemplateHeader
            title={hub.title}
            subtitle={hub.subtitle}
            breadcrumbs={config.breadcrumbs}
          />

          <HubFilter
            hubs={hubs}
            activeSlug={hub.slug}
            basePath={config.backPath}
            allLabel={config.filterAllLabel}
            filterLabel={config.filterLabel}
          />

          {hub.intro && (
            <p className="mb-10 text-base text-muted-foreground max-w-3xl">
              {hub.intro}
            </p>
          )}

          {!items || items.length === 0 ? (
            renderEmpty ? (
              renderEmpty()
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{config.emptyLabel}</p>
              </div>
            )
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
              aria-label={config.gridAriaLabel ?? t('templates.title')}
            >
              {itemList}
            </div>
          )}

          <div className="mb-8">
            <Link
              to={getLocalizedPath(locale, config.backPath)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {config.backLabel}
            </Link>
          </div>

        </div>
        <div className="mx-6 md:mx-0">
          <PageFooter />
        </div>
      </div>
    </>
  );
}
