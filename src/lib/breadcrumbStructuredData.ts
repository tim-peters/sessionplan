import { getCanonicalUrl } from './metaConfig';

export interface BreadcrumbEntry {
  /** Visible label, matching the visual breadcrumb (TemplateHeader). */
  name: string;
  /** Relative path. Omit for the current page (no link, matches BreadcrumbPage). */
  path?: string;
}

/** Builds BreadcrumbList JSON-LD matching the visual breadcrumb rendered by TemplateHeader. */
export const buildBreadcrumbList = (items: BreadcrumbEntry[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    ...(item.path ? { item: getCanonicalUrl(item.path) } : {}),
  })),
});
