/**
 * hubLoaders — generic content-hub loaders for templates / blog / landing hubs.
 *
 * Hub pages share a common shape:
 *   1. Load the locale-aware hubs index (`<contentType>/hubs/index.json`).
 *   2. Find the hub by slug (404 if missing — matches `templateCategoryLoader`'s
 *      error contract so a hub that doesn't exist routes through ErrorBoundary).
 *   3. Resolve members according to content-type-specific rules:
 *        - templates: filter the templates index by `category === hub.slug`
 *        - blog:      filter published blog posts, then by category
 *                      (category filter is tolerant of the field being absent,
 *                      ready for Phase 2 when blog index entries gain it)
 *        - landing:   fetch each member detail JSON in parallel based on
 *                      `hub.slugs` (ready for Phase 3)
 *
 * `createHubLoader(contentType)` returns a React Router loader compatible with
 * the existing route definitions: `(args, slug) => Promise<{ items, hub, hubs }>`.
 */
import { LoaderFunctionArgs } from 'react-router-dom';
import { fetchJsonOrThrow } from './routeLoaders';
import { getContentDataPath, getLocaleFromPathname, type Locale } from './i18n';
import { filterPublishedBlogPosts } from './blog-publication.js';
import type { Hub } from '@/types/hub';

/** Shape of `<contentType>/hubs/index.json`. */
interface HubsIndex {
  hubs: Hub[];
}

/** A blog index entry (subset of `BlogIndex.posts`). */
interface BlogIndexEntry {
  slug: string;
  title: string;
  excerpt: string;
  publishedDate: string;
  tags?: string[];
  /** Locale-specific category slug, e.g. "retrospektive" / "retrospective". */
  category?: string;
}

/** Blog index payload. */
interface BlogIndex {
  posts: BlogIndexEntry[];
}

/** Landing-page detail payload (minimal — only the loader-relevant fields). */
export interface LandingMember {
  slug: string;
  title: string;
  metaDescription?: string;
  heroDescription?: string;
}

/** Return shape of every `createHubLoader(contentType)` loader. */
export interface HubLoaderData<TItem> {
  /** Resolved hub members (templates, posts, or landing pages). */
  items: TItem[];
  /** The matched hub. */
  hub: Hub;
  /** The full hubs list (for filter chip rendering). */
  hubs: Hub[];
}

// ==================== Per-type item resolvers ====================

/**
 * Resolves the members for a template hub by filtering the templates index
 * down to entries whose `category` matches the hub slug.
 */
async function resolveTemplateItems(
  locale: Locale,
  hub: Hub
): Promise<HubLoaderData<unknown>['items']> {
  const base = getContentDataPath('templates', locale);
  const index = await fetchJsonOrThrow<{ templates: Array<{ category?: string }> }>(
    `${base}index.json`,
    'Templates index not found',
  );
  return (index.templates ?? []).filter((template) => template.category === hub.slug);
}

/**
 * Resolves the members for a blog hub by applying publication gating and
 * then filtering by category. The category filter is tolerant: blog index
 * entries that do not yet carry a `category` are excluded from category hubs,
 * which is the intended Phase 2 behaviour once categories land on blog posts.
 */
async function resolveBlogItems(
  locale: Locale,
  hub: Hub
): Promise<HubLoaderData<BlogIndexEntry>['items']> {
  const base = getContentDataPath('blog', locale);
  const index = await fetchJsonOrThrow<BlogIndex>(
    `${base}index.json`,
    'Blog index not found',
  );
  const published = filterPublishedBlogPosts(index.posts ?? []);
  return published.filter((post) => post.category === hub.slug);
}

/**
 * Resolves the members for a landing hub by fetching each member detail JSON
 * in parallel. Members that fail to load are logged and dropped so one broken
 * page does not blank the whole hub.
 */
async function resolveLandingItems(
  locale: Locale,
  hub: Hub
): Promise<HubLoaderData<LandingMember>['items']> {
  const slugs = hub.slugs ?? [];
  if (slugs.length === 0) return [];

  const base = getContentDataPath('landing', locale);
  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return await fetchJsonOrThrow<LandingMember>(
          `${base}${slug}.json`,
          `Landing page not found: ${slug}`,
        );
      } catch {
        console.warn(`Failed to load landing hub member: ${slug}`);
        return null;
      }
    }),
  );
  return results.filter((page): page is LandingMember => page !== null);
}

type ItemResolver = (
  locale: Locale,
  hub: Hub,
) => Promise<HubLoaderData<unknown>['items']>;

const RESOLVERS: Record<'templates' | 'blog' | 'landing', ItemResolver> = {
  templates: resolveTemplateItems,
  blog: resolveBlogItems,
  landing: resolveLandingItems,
};

// ==================== Factory ====================

/**
 * Builds a React Router loader for a hub page of the given content type.
 * The returned loader takes the hub slug as its second argument (matching the
 * existing `templateCategoryLoader(args, 'retrospektive')` shape).
 */
export function createHubLoader<TItem = unknown>(
  contentType: 'templates' | 'blog' | 'landing',
) {
  return async (
    args: LoaderFunctionArgs,
    hubSlug: string,
  ): Promise<HubLoaderData<TItem>> => {
    const { request } = args;
    const { pathname } = new URL(request.url);
    const locale: Locale = getLocaleFromPathname(pathname);
    const base = getContentDataPath(contentType, locale);

    const hubsIndex = await fetchJsonOrThrow<HubsIndex>(
      `${base}hubs/index.json`,
      `${contentType} hubs index not found`,
    );
    const hubs = hubsIndex.hubs ?? [];
    const hub = hubs.find((h) => h.slug === hubSlug);
    if (!hub) {
      throw new Response(`${contentType} hub not found: ${hubSlug}`, { status: 404 });
    }

    const items = (await RESOLVERS[contentType](locale, hub)) as TItem[];
    return { items, hub, hubs };
  };
}
