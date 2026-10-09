/**
 * metaConfig — Central SEO constants and meta tag helpers.
 *
 * Role: Defines the canonical base URL (always https://sessionplan.de),
 *       site name, title template, default description, and OG defaults.
 *       All SEO configuration is sourced from here; do not hardcode URLs elsewhere.
 * Used by: DocumentMeta (useDocumentMeta.tsx)
 */

import { siteAuthor } from '@/integrations/site';
import { type Locale, LOCALES, LOCALE_OG, LOCALE_PREFIX } from './i18n';

const PRODUCTION_BASE_URL = 'https://sessionplan.de';

// Canonical URLs should always target the production domain
const getBaseUrl = (): string => {
  return PRODUCTION_BASE_URL;
};

export const META_CONFIG = {
  baseUrl: getBaseUrl(),
  siteName: 'Sessionplan',
  titleTemplate: '%s – Sessionplan',
  defaultTitle: 'Workshop Agenda – Session Ablauf Planer',
  defaultDescription: 'Kostenloser Ablauf Planer für Trainer, Coaches und Moderatoren. Erstelle professionelle Workshop-Agendas per Drag & Drop – ohne Registrierung, ohne Cloud, ohne Kosten.',
  defaultOgImage: '/assets/preview.png',
  author: siteAuthor,
  organization: {
    name: 'Sessionplan',
    url: PRODUCTION_BASE_URL
  },
} as const;

export interface HreflangLink {
  hreflang: string;
  href: string;
}

/**
 * Builds the hreflang + x-default link list for a page.
 *
 * @param locale     - Active locale of the current page
 * @param canonicalPath - Canonical path of the current page (e.g. '/blog')
 * @param alternates - Optional map of locale → path for other language versions
 *
 * Rules:
 *  - The current page's own entry is always included.
 *  - x-default points to the EN version if a paired EN alternate exists,
 *    otherwise to the DE version (the page itself for DE-only pages).
 *    English is the language-agnostic fallback; for DE-only pages
 *    x-default ends up pointing to the page's own DE URL, which is the
 *    correct signal for users without a language preference.
 *  - Only locales with a known path (canonical or explicit alternate) are included.
 */
export function buildHreflangLinks(
  locale: Locale,
  canonicalPath: string,
  alternates?: Partial<Record<Locale, string>>
): HreflangLink[] {
  const links: HreflangLink[] = [];

  // Build a map: locale → absolute URL
  const urlMap: Partial<Record<Locale, string>> = {};

  // Current page's own URL
  urlMap[locale] = getCanonicalUrl(canonicalPath);

  // Explicit alternates provided by content
  if (alternates) {
    for (const loc of LOCALES) {
      if (alternates[loc]) {
        urlMap[loc] = getCanonicalUrl(alternates[loc]!);
      }
    }
  }

  // Emit one <link rel="alternate"> per locale we have a URL for
  for (const loc of LOCALES) {
    if (urlMap[loc]) {
      links.push({ hreflang: loc, href: urlMap[loc]! });
    }
  }

  // x-default: EN if a paired EN alternate exists, otherwise DE.
  // For DE-only pages this resolves to the page's own DE URL, which is
  // the correct signal per Google's hreflang spec.
  const enUrl = urlMap['en'];
  const deUrl = urlMap['de'];
  const defaultLoc = enUrl ?? deUrl;
  if (defaultLoc) {
    links.push({ hreflang: 'x-default', href: defaultLoc });
  }

  return links;
}

/**
 * Returns the og:locale string for a given locale (e.g. 'de_DE').
 */
export function getOgLocale(locale: Locale): string {
  return LOCALE_OG[locale];
}

/**
 * Returns og:locale:alternate values — all locales except the current one.
 */
export function getOgLocaleAlternates(locale: Locale): string[] {
  return LOCALES.filter((l) => l !== locale).map((l) => LOCALE_OG[l]);
}

/**
 * Options for document meta tags
 */
export interface MetaOptions {
  /** Page title (will be formatted with titleTemplate) */
  title?: string;

  /** Meta description */
  description?: string;

  /** Canonical URL path (relative, will be prefixed with baseUrl) */
  canonicalPath?: string;

  /** Active locale — controls html lang, og:locale, and hreflang links */
  locale?: Locale;

  /** Alternate URLs for other language versions keyed by locale */
  alternates?: Partial<Record<Locale, string>>;

  /** Open Graph image URL (absolute or relative) */
  ogImage?: string;

  /** Open Graph type (default: 'website') */
  ogType?: 'website' | 'article' | 'profile';

  /** Additional Open Graph properties for articles */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    tags?: string[];
  };

  /** Twitter card type (default: 'summary_large_image') */
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';

  /** Robots directive (default: 'index,follow') */
  robots?: string;

  /** Whether to noindex this page */
  noindex?: boolean;

  /** JSON-LD structured data (will be stringified) */
  structuredData?: object | object[];

  /** Additional meta tags */
  additionalMeta?: Array<{
    name?: string;
    property?: string;
    content: string;
  }>;
}

// Re-export for convenience
export { LOCALE_PREFIX };

/**
 * Generate full canonical URL from path
 */
export const getCanonicalUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${META_CONFIG.baseUrl}${cleanPath}`;
};

/**
 * Format title with template
 */
export const formatTitle = (title?: string): string => {
  if (!title) {
    return META_CONFIG.defaultTitle;
  }

  // If title already contains separator, return as is
  if (title.includes('–') || title.includes('|')) {
    return title;
  }

  return META_CONFIG.titleTemplate.replace('%s', title);
};

/**
 * Canonical @id values for the site's Organization and WebSite entities.
 * Reference these via `{ '@id': ORGANIZATION_ID }` instead of inlining a
 * fresh Organization object on every page — the full node (with logo) only
 * needs to be included once per page's own JSON-LD graph via
 * getOrganizationSchema().
 */
export const ORGANIZATION_ID = `${PRODUCTION_BASE_URL}/#organization`;
export const WEBSITE_ID = `${PRODUCTION_BASE_URL}/#website`;

/** The canonical Organization node — include once in a page's structuredData array. */
export const getOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: META_CONFIG.organization.name,
  url: META_CONFIG.organization.url,
  logo: {
    '@type': 'ImageObject',
    url: getCanonicalUrl('/pwa/icon-512.png'),
  },
});

/**
 * Generate absolute image URL
 */
export const getAbsoluteImageUrl = (imageUrl?: string): string => {
  if (!imageUrl) {
    // Return empty string if no image provided and no default configured
    return META_CONFIG.defaultOgImage ? getCanonicalUrl(META_CONFIG.defaultOgImage) : '';
  }

  // Already absolute
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // Make relative URL absolute
  return getCanonicalUrl(imageUrl);
};
