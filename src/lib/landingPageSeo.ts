import type { SeoFaqSection, SeoSection, SiteStats } from '@/types/landingPage';

export const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export const deriveFaqPageSchema = (
  sections: SeoSection[] | undefined,
): Record<string, unknown> | undefined => {
  if (!sections?.length) return undefined;
  const faq = sections.find((s): s is SeoFaqSection => s.type === 'faq');
  if (!faq || !faq.items?.length) return undefined;

  return {
    '@type': 'FAQPage',
    mainEntity: faq.items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripHtml(answer),
      },
    })),
  };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFaqPage = (node: Record<string, unknown>): boolean =>
  node['@type'] === 'FAQPage';

/**
 * Walk a base JSON-LD node and return:
 *  - the flat list of graph nodes (handles single object, @graph wrapper, or array)
 *  - whether the base was a @graph wrapper (so we can preserve its sibling keys like @context)
 *  - the @context string if present
 */
const flattenGraph = (
  base: Record<string, unknown> | undefined,
): { nodes: Record<string, unknown>[]; wrapper: Record<string, unknown> | null; context: string | null } => {
  if (!base) return { nodes: [], wrapper: null, context: null };

  const context = typeof base['@context'] === 'string' ? (base['@context'] as string) : null;

  if (Array.isArray(base['@graph'])) {
    const nodes = (base['@graph'] as unknown[]).filter(isObject);
    return { nodes, wrapper: base, context };
  }

  return { nodes: [base], wrapper: null, context };
};

export const mergeStructuredData = (
  base: Record<string, unknown> | undefined,
  derived: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!derived) return base;

  const { nodes, wrapper, context } = flattenGraph(base);
  const filtered = nodes.filter((node) => !isFaqPage(node));
  filtered.push(derived);

  if (wrapper) {
    return { ...wrapper, '@graph': filtered };
  }
  if (filtered.length === 1 && !context) return filtered[0];
  return { '@context': context ?? 'https://schema.org', '@graph': filtered };
};

/**
 * Append site-level nodes (Organization, WebSite) to a page's JSON-LD graph.
 * Nodes whose @id already exists in the graph are skipped; the appended
 * nodes' own @context is dropped because the graph wrapper carries it.
 */
export const appendGraphNodes = (
  base: Record<string, unknown> | undefined,
  extra: Record<string, unknown>[],
): Record<string, unknown> | undefined => {
  const { nodes, wrapper, context } = flattenGraph(base);
  const knownIds = new Set(nodes.map((node) => node['@id']).filter(Boolean));
  const additions = extra
    .filter((node) => !node['@id'] || !knownIds.has(node['@id']))
    .map(({ '@context': _context, ...node }) => node);
  if (!additions.length) return base;

  const merged = [...nodes, ...additions];
  if (wrapper) return { ...wrapper, '@graph': merged };
  return { '@context': context ?? 'https://schema.org', '@graph': merged };
};

const isApplicationNode = (node: Record<string, unknown>): boolean =>
  node['@type'] === 'WebApplication' || node['@type'] === 'SoftwareApplication';

const patchApplicationNodes = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const { nodes, wrapper } = flattenGraph(base);
  if (!nodes.some(isApplicationNode)) return base;

  const updated = nodes.map((node) => (isApplicationNode(node) ? { ...node, ...patch } : node));

  // Without a @graph wrapper, flattenGraph yields the base node itself.
  return wrapper ? { ...wrapper, '@graph': updated } : updated[0];
};

/**
 * Attach the site-wide rating to every WebApplication/SoftwareApplication node.
 * The rating must stay identical to the visible hero badge, so it is injected
 * here from site stats instead of being hardcoded per landing page JSON.
 */
export const withAggregateRating = (
  base: Record<string, unknown> | undefined,
  rating: SiteStats['rating'],
): Record<string, unknown> | undefined => {
  if (!base || !rating) return base;

  return patchApplicationNodes(base, {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: rating.value,
      ratingCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    },
  });
};

/**
 * Attach the official product profiles to every WebApplication/SoftwareApplication
 * node. They are site-wide, so they are injected here instead of being repeated
 * in every landing page JSON.
 */
export const withApplicationSameAs = (
  base: Record<string, unknown> | undefined,
  sameAs: string[],
): Record<string, unknown> | undefined => {
  if (!base || !sameAs.length) return base;

  return patchApplicationNodes(base, { sameAs });
};
