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
import type { Hub } from '../types/hub';
import { getLocaleFromPathname, getContentDataPath, type Locale } from './i18n';
import { filterPublishedBlogPosts } from './blog-publication';

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

/**
 * HTTP statuses that indicate a transient server-side problem worth retrying.
 * 404 and other 4xx are definitive (route/content does not exist) and are
 * never retried.
 */
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);
/** Number of retries after the initial attempt for transient failures. */
const MAX_FETCH_RETRIES = 2;
/** Base delay between retries in ms; retry N waits base * N. */
const FETCH_RETRY_DELAY_MS = 250;

/**
 * Error carrying the HTTP status (0 = network-level failure) so the retry
 * wrapper can distinguish transient failures from definitive ones. The
 * message stays human-readable for the ErrorBoundary.
 */
class HttpFetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpFetchError';
    this.status = status;
  }
}

function isTransientFetchError(error: unknown): boolean {
  return (
    error instanceof HttpFetchError &&
    (error.status === 0 || RETRYABLE_HTTP_STATUS.has(error.status))
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Single fetch + parse attempt. Throws:
 *  - `Response` (404) for definitively missing content,
 *  - `HttpFetchError` for network failures and non-404 HTTP errors,
 *  - plain `Error` for content-type / JSON parse problems (deterministic).
 */
async function fetchJsonOnce<T>(url: string, notFoundMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new HttpFetchError(
      `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
      0
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Response(notFoundMessage, { status: 404 });
    }

    throw new HttpFetchError(`Failed to load ${url}: HTTP ${response.status}`, response.status);
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
 * Fetches JSON with a small retry budget for transient failures (network
 * errors, 429/5xx). A momentary outage — e.g. a JSON file being swapped
 * during a deploy, or a brief server hiccup — self-heals instead of
 * rendering the ErrorBoundary's "Oops" page. 404s and deterministic errors
 * (wrong content type, invalid JSON) fail immediately.
 *
 * Exported so sibling loaders (e.g. `createHubLoader`) can share the same
 * retry semantics without going through `fetchJsonOnce` directly.
 */
export async function fetchJsonOrThrow<T>(url: string, notFoundMessage: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(FETCH_RETRY_DELAY_MS * attempt);
    }
    try {
      return await fetchJsonOnce<T>(url, notFoundMessage);
    } catch (error) {
      if (!isTransientFetchError(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
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

export async function blogArticleLoader({ params, request }: LoaderFunctionArgs): Promise<BlogPost & { hub?: BlogHub }> {
  const { slug } = params;
  const locale = getLocaleFromRequest(request);

  if (!slug) {
    throw new Response('Blog post slug is required', { status: 400 });
  }

  const base = getContentDataPath('blog', locale);
  // Post fetch must run first and propagate its 404 — the lastmodified lookup
  // below is best-effort and must never mask a missing post.
  const post = await fetchJsonOrThrow<BlogPost>(`${base}${slug}.json`, 'Blog post not found');

  // Best-effort freshness signal: prefer the git commit date from
  // public/data/lastmodified.json (built by scripts/generate-lastmodified.mjs)
  // over any manually-authored lastModified. Any failure here is logged and
  // swallowed so the page still renders.
  const lastmodifiedKey = `${base.replace(/^\/data\//, '')}${slug}.json`;
  let gitDate: string | undefined;
  try {
    const map = await fetchJsonOrThrow<Record<string, string>>(
      '/data/lastmodified.json',
      'Last-modified map not found'
    );
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      const candidate = (map as Record<string, unknown>)[lastmodifiedKey];
      if (typeof candidate === 'string' && candidate.length > 0) {
        gitDate = candidate;
      }
    }
  } catch (error) {
    console.warn('Failed to load /data/lastmodified.json', error);
  }

  const candidates = [gitDate, post.lastModified].filter(
    (d): d is string => typeof d === 'string' && d.length > 0
  );
  let merged: string | undefined;
  for (const candidate of candidates) {
    if (!merged || candidate > merged) {
      merged = candidate;
    }
  }

  // Always keep dateModified >= publishedDate so the JSON-LD stays valid.
  if (merged && post.publishedDate && merged < post.publishedDate) {
    merged = post.publishedDate;
  }

  const basePost: BlogPost = merged ? { ...post, lastModified: merged } : post;

  // Best-effort: locate the post's hub so the article can show a
  // "Mehr zum Thema" pill linking to the matching hub. A missing hubs
  // index, missing category on the post, or a stale slug all leave the
  // article without a hub rather than failing the page.
  try {
    const index = await fetchJsonOrThrow<{ posts: BlogIndexEntry[] }>(
      `${base}index.json`,
      'Blog index not found'
    );
    const entry = (index.posts ?? []).find((p) => p.slug === slug);
    if (entry?.category) {
      const hubsIndex = await fetchJsonOrThrow<{ hubs: BlogHub[] }>(
        `${base}hubs/index.json`,
        'Blog hubs index not found'
      );
      const hub = (hubsIndex.hubs ?? []).find((h) => h.slug === entry.category);
      if (hub) {
        return { ...basePost, hub };
      }
    }
  } catch (error) {
    console.warn('Failed to resolve blog hub for article:', error);
  }

  return basePost;
}

export async function blogIndexLoader({ request }: LoaderFunctionArgs): Promise<BlogIndex & { hubs: BlogHub[] }> {
  const locale = getLocaleFromRequest(request);
  const base = getContentDataPath('blog', locale);
  // Fetch index + hubs index in parallel; the hubs index is best-effort for
  // the filter chips so a missing hubs file never blanks the post grid.
  const [index, hubsResult] = await Promise.all([
    fetchJsonOrThrow<BlogIndex>(`${base}index.json`, 'Blog index not found'),
    fetchJsonOrThrow<{ hubs: BlogHub[] }>(`${base}hubs/index.json`, 'Blog hubs index not found').catch(() => ({ hubs: [] })),
  ]);

  return {
    ...index,
    posts: filterPublishedBlogPosts(index.posts),
    hubs: hubsResult.hubs ?? [],
  };
}

/**
 * Loader for blog category hub pages (e.g. /blog/workshop-methoden).
 *
 * Thin wrapper around `createHubLoader('blog')` so the registered routes in
 * App.tsx keep the same shape as the blog index loader. The category slug is
 * locale-specific (e.g. "workshop-methoden" for DE, "workshop-methods" for EN)
 * and is passed in by the route definition so static hub paths stay decoupled
 * from the generic `/blog/:slug` detail route.
 */
export interface BlogIndexEntry {
  slug: string;
  title: string;
  excerpt: string;
  publishedDate: string;
  tags?: string[];
  /** Locale-specific category slug, e.g. "workshop-methoden" / "workshop-methods". */
  category?: string;
}

export interface BlogHub {
  slug: string;
  title: string;
  shortLabel?: string;
  subtitle?: string;
  description: string;
  intro?: string;
  alternates?: Partial<Record<Locale, string>>;
}

export async function blogCategoryLoader(
  args: LoaderFunctionArgs,
  category: string
): Promise<{ items: BlogIndexEntry[]; hub: BlogHub; hubs: BlogHub[] }> {
  const { createHubLoader } = await import('./hubLoaders');
  // Return the loader data as-is — HubCollection reads `items`.
  return createHubLoader<BlogIndexEntry>('blog')(args, category);
}

// ==================== LANDING PAGE HUBS ====================

/** A landing-page hub member resolved by `createHubLoader('landing')`. */
export interface LandingPageHubMember {
  slug: string;
  title: string;
  metaDescription?: string;
  heroDescription?: string;
}

/**
 * Loader for landing-page hub pages (e.g. /landing-pages/workshops).
 *
 * Thin wrapper around `createHubLoader('landing')` so the registered routes in
 * App.tsx keep the same `{ items, hub, hubs }` shape as the blog index loader.
 * The hub slug is locale-specific (e.g. "workshops" for DE and EN) and is passed
 * in by the route definition so static hub paths stay decoupled from the
 * generic `/:slug` detail route.
 */
export async function landingPageHubLoader(
  args: LoaderFunctionArgs,
  hubSlug: string
): Promise<{ items: LandingPageHubMember[]; hub: Hub; hubs: Hub[] }> {
  const { createHubLoader } = await import('./hubLoaders');
  // Return the loader data as-is — HubCollection reads `items`.
  return createHubLoader<LandingPageHubMember>('landing')(args, hubSlug);
}

// ==================== TEMPLATES ====================

export interface TemplateSummary {
  slug: string;
  title: string;
  excerpt: string;
  /** Optional category slug (locale-specific, e.g. "retrospektive" / "retrospective"). */
  category?: string;
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

export async function templatesIndexLoader({ request }: LoaderFunctionArgs): Promise<{
  templates: TemplateSummary[];
  hubs: TemplateHub[];
}> {
  const locale = getLocaleFromRequest(request);
  const base = getContentDataPath('templates', locale);
  const [index, hubsIndex] = await Promise.all([
    fetchJsonOrThrow<{ templates: TemplateSummary[] }>(`${base}index.json`, 'Templates index not found'),
    fetchJsonOrThrow<TemplateHubsIndex>(`${base}hubs/index.json`, 'Template hubs index not found'),
  ]);
  return {
    templates: index.templates ?? [],
    hubs: hubsIndex.hubs ?? [],
  };
}

/** A template category hub (e.g. /templates/retrospektive). Content lives in public/data/templates/hubs/. */
export interface TemplateHub {
  slug: string;
  title: string;
  /** Short label for filter chips / navigation (e.g. "Retrospektiven"). */
  shortLabel?: string;
  subtitle?: string;
  description: string;
  intro?: string;
  /** Locale-specific counterpart paths, e.g. { en: '/en/templates/retrospective' }. */
  alternates?: Partial<Record<Locale, string>>;
}

/**
 * Loader for template category hub pages (e.g. /templates/retrospektive).
 *
 * Thin wrapper around `createHubLoader('templates')` so the registered
 * routes in App.tsx keep their current shape. The category slug is locale-
 * specific (e.g. "retrospektive" for DE, "retrospective" for EN) and is passed
 * in by the route definition so static hub paths stay decoupled from the
 * generic `/templates/:slug` detail route.
 */
export async function templateCategoryLoader(
  args: LoaderFunctionArgs,
  category: string
): Promise<{ items: TemplateSummary[]; hub: TemplateHub; hubs: TemplateHub[] }> {
  const { createHubLoader } = await import('./hubLoaders');
  const data = await createHubLoader<TemplateSummary>('templates')(args, category);
  // Return the loader data as-is — HubCollection reads `items`.
  return {
    items: data.items,
    hub: data.hub,
    hubs: data.hubs,
  };
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
  hubs: Hub[];
}

/**
 * Loader für Landing Pages Übersicht
 * Nutzt defer() für progressive loading:
 * - Index wird sofort geladen (blocking)
 * - Einzelne Pages werden parallel nachgeladen (non-blocking)
 * - Hubs-Index wird parallel zum Index geladen (best-effort, non-fatal)
 * Dies verhindert Race Conditions und lange Wartezeiten
 */
export async function landingPagesLoader({ request }: LoaderFunctionArgs) {
  const locale = getLocaleFromRequest(request);
  const base = getContentDataPath('landing', locale);

  // Index + Hubs-Index parallel laden (blocking). Der Hubs-Index ist
  // best-effort — fehlt er, fällt der HubFilter still aus.
  const [index, hubsIndex] = await Promise.all([
    fetchJsonOrThrow<LandingPagesIndex>(
      `${base}index.json`,
      'Landing pages index not found'
    ),
    fetchJsonOrThrow<{ hubs: Hub[] }>(
      `${base}hubs/index.json`,
      'Landing hubs index not found'
    ).catch(() => ({ hubs: [] })),
  ]);

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
    pages: pagesPromise,
    hubs: hubsIndex.hubs ?? [],
  });
}
