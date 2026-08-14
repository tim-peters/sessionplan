/**
 * routeLoaders — React Router data loaders for all content routes.
 *
 * Role: Fetches static JSON from public/data/ before the route renders.
 *       Sanitises raw newlines in HTML content strings so JSON.parse() succeeds
 *       on human-readable multi-line JSON files. Returns data via defer() for
 *       Suspense boundaries. All content fetching goes through these loaders.
 *
 *       Locale-aware: derives the active locale from the request URL and maps
 *       it to the correct data directory (e.g. /data/blog/en/ vs /data/blog/).
 */
import { LoaderFunctionArgs, defer } from 'react-router-dom';
import { BlogPost, BlogIndex } from '../types/blog';
import { LandingPageContent } from '../types/landingPage';
import { getLocaleFromPathname, getContentDataPath, type Locale } from './i18n';

/**
 * Re-escapes raw newlines/carriage-returns inside JSON string literals so that
 * JSON.parse() can handle files where HTML content spans multiple physical
 * lines for human readability.
 */
function sanitizeJsonNewlines(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        result += c;
      } else if (c === '\\') {
        escaped = true;
        result += c;
      } else if (c === '"') {
        // A bare " inside a string is either the real end of the JSON string or
        // an unescaped quote inside HTML content (e.g. href="…"). Look ahead past
        // whitespace: if the next meaningful char is a JSON structural character
        // (, } ] :) or end-of-input, treat it as the real end; otherwise it's a
        // content quote and must be escaped so JSON.parse doesn't trip on it.
        let j = i + 1;
        while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n' || text[j] === '\r')) j++;
        const next = j < text.length ? text[j] : '';
        if (next === ',' || next === '}' || next === ']' || next === ':' || next === '') {
          inString = false;
          result += c;
        } else {
          result += '\\"'; // escape bare content quote
        }
      } else if (c === '\n') {
        result += '\\n';
      } else if (c === '\r') {
        result += '\\r';
      } else {
        result += c;
      }
    } else {
      if (c === '"') inString = true;
      result += c;
    }
  }
  return result;
}

async function fetchJsonOrThrow<T>(url: string, notFoundMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Response(notFoundMessage, { status: 404 });
    }

    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON from ${url}, received ${contentType || 'unknown content type'}`);
  }

  try {
    const text = await response.text();
    return JSON.parse(sanitizeJsonNewlines(text)) as T;
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Route Loaders für React Router
 * Diese Funktionen laden Daten VOR dem Rendern der jeweiligen Route,
 * um sicherzugehen, dass keine halbfertigen Seiten angezeigt werden.
 */

/** Derives the Locale from the loader's Request URL */
function getLocaleFromRequest(request: Request): Locale {
  const { pathname } = new URL(request.url);
  return getLocaleFromPathname(pathname);
}

// ==================== BLOG ====================

export async function blogArticleLoader({ params, request }: LoaderFunctionArgs): Promise<BlogPost> {
  const { slug } = params;
  const locale = getLocaleFromRequest(request);

  if (!slug) {
    throw new Response('Blog post slug is required', { status: 400 });
  }

  const base = getContentDataPath('blog', locale);
  return fetchJsonOrThrow<BlogPost>(`${base}${slug}.json`, 'Blog post not found');
}

export async function blogIndexLoader({ request }: LoaderFunctionArgs): Promise<BlogIndex> {
  const locale = getLocaleFromRequest(request);
  const base = getContentDataPath('blog', locale);
  return fetchJsonOrThrow<BlogIndex>(`${base}index.json`, 'Blog index not found');
}

// ==================== TEMPLATES ====================

export interface TemplateSummary {
  slug: string;
  title: string;
  excerpt: string;
}

export async function templateArticleLoader({ params, request }: LoaderFunctionArgs): Promise<LandingPageContent> {
  const { slug } = params;
  const locale = getLocaleFromRequest(request);

  if (!slug) {
    throw new Response('Template slug is required', { status: 400 });
  }

  const base = getContentDataPath('templates', locale);
  const content = await fetchJsonOrThrow<LandingPageContent>(`${base}${slug}.json`, 'Template not found');

  // Templates can define an SEO fallback used when all prefilled content is removed.
  if (content.type === 'template' && content.fallbackSlug && content.fallbackSlug !== content.slug) {
    try {
      const fallbackBase = getContentDataPath('landing', locale);
      const fallback = await fetchJsonOrThrow<LandingPageContent>(
        `${fallbackBase}${content.fallbackSlug}.json`,
        `Fallback landing page not found: ${content.fallbackSlug}`
      );

      return {
        ...content,
        emptyStateFallback: fallback,
      };
    } catch {
      console.warn(`Failed to load fallback landing page: ${content.fallbackSlug}`);
    }
  }

  return content;
}

export async function templatesIndexLoader({ request }: LoaderFunctionArgs): Promise<{ templates: TemplateSummary[] }> {
  const locale = getLocaleFromRequest(request);
  const base = getContentDataPath('templates', locale);
  return fetchJsonOrThrow<{ templates: TemplateSummary[] }>(`${base}index.json`, 'Templates index not found');
}

export async function homePageLoader({ request }: LoaderFunctionArgs): Promise<LandingPageContent> {
  const locale = getLocaleFromRequest(request);
  const base = getContentDataPath('landing', locale);
  return fetchJsonOrThrow<LandingPageContent>(`${base}home.json`, 'Home page content not found');
}

// ==================== LANDING PAGES ====================

export async function landingPageLoader({ params, request }: LoaderFunctionArgs): Promise<LandingPageContent> {
  const { slug } = params;
  const locale = getLocaleFromRequest(request);

  if (!slug) {
    throw new Response('Landing page slug is required', { status: 400 });
  }

  const base = getContentDataPath('landing', locale);
  const content = await fetchJsonOrThrow<LandingPageContent>(`${base}${slug}.json`, 'Landing page not found');

  // Templates can define an SEO fallback used when all prefilled content is removed.
  if (content.type === 'template' && content.fallbackSlug && content.fallbackSlug !== content.slug) {
    try {
      const fallback = await fetchJsonOrThrow<LandingPageContent>(
        `${base}${content.fallbackSlug}.json`,
        `Fallback landing page not found: ${content.fallbackSlug}`
      );

      return {
        ...content,
        emptyStateFallback: fallback,
      };
    } catch {
      console.warn(`Failed to load fallback landing page: ${content.fallbackSlug}`);
    }
  }

  return content;
}

interface LandingPagesIndex {
  landingPages: string[];
}

interface LandingPagesLoaderData {
  index: LandingPagesIndex;
  pages: Promise<LandingPageContent[]>;
}

/**
 * Loader für Landing Pages Übersicht
 * Nutzt defer() für progressive loading:
 * - Index wird sofort geladen (blocking)
 * - Einzelne Pages werden parallel nachgeladen (non-blocking)
 * Dies verhindert Race Conditions und lange Wartezeiten
 */
export async function landingPagesLoader({ request }: LoaderFunctionArgs) {
  const locale = getLocaleFromRequest(request);
  const base = getContentDataPath('landing', locale);

  // Index sofort laden (blocking)
  const index: LandingPagesIndex = await fetchJsonOrThrow<LandingPagesIndex>(
    `${base}index.json`,
    'Landing pages index not found'
  );

  // Einzelne Pages parallel laden (non-blocking durch defer)
  const pagesPromise = Promise.all(
    index.landingPages.map(async (slug) => {
      try {
        return await fetchJsonOrThrow<LandingPageContent>(`${base}${slug}.json`, `Landing page not found: ${slug}`);
      } catch {
        console.warn(`Failed to load landing page: ${slug}`);
        return null;
      }
    })
  ).then(pages => pages.filter((page): page is LandingPageContent => page !== null));

  // Index sofort verfügbar, pages werden nachgeladen
  return defer({
    index,
    pages: pagesPromise
  });
}
