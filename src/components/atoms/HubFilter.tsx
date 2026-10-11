/**
 * HubFilter — generic category filter bar for hub pages.
 *
 * Role: Renders a row of pill links — an "All" chip plus one chip per hub.
 *       The active hub (or the parent index, when omitted) is highlighted.
 *       Pure navigation; no business logic.
 *
 * Generalized from TemplateHubFilter — now accepts `basePath` and `allLabel`
 * as props so the same component can drive the templates gallery, the
 * blog hub index, and any future landing-page hub page.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Hub } from '@/types/hub';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath } from '@/lib/localeUtils';
import { cn } from '@/lib/utils';

interface HubFilterProps {
  hubs: Hub[];
  /** Slug of the currently active hub; omit when on the parent index page. */
  activeSlug?: string;
  /**
   * Locale-aware base path for chip links, e.g. "/templates" or "/blog".
   * The chip URL becomes `${basePath}/${hub.slug}` for each hub.
   */
  basePath: string;
  /** Translated label for the "all" chip (passed in by the page so the filter stays translation-free). */
  allLabel: string;
  /** Translated accessible name for the filter nav (e.g. t('blog.filterLabel')). */
  filterLabel: string;
}

export const HubFilter = ({ hubs, activeSlug, basePath, allLabel, filterLabel }: HubFilterProps) => {
  const { locale } = useLocale();

  const chipClass = (isActive: boolean) =>
    cn(
      'inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
    );

  return (
    <nav aria-label={filterLabel} className="mb-10 flex flex-wrap items-center gap-2">
      <Link to={getLocalizedPath(locale, basePath)} className={chipClass(!activeSlug)}>
        {allLabel}
      </Link>
      {(hubs ?? []).map((hub) => (
        <Link
          key={hub.slug}
          to={getLocalizedPath(locale, `${basePath}/${hub.slug}`)}
          className={chipClass(activeSlug === hub.slug)}
        >
          {hub.shortLabel ?? hub.title}
        </Link>
      ))}
    </nav>
  );
};
