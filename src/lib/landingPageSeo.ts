import type { SeoFaqSection, SeoSection } from '@/types/landingPage';

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
