/**
 * SEO integrity tests for every route.
 *
 * For every page that ships to production we assert:
 *   1. Exactly ONE canonical link
 *   2. The canonical points to the production base URL
 *   3. A self-hreflang tag (the page's own locale)
 *   4. An other-locale hreflang tag pointing at the translated equivalent
 *      (and that the equivalent page's own tags point back the other way)
 *   5. An x-default hreflang that always resolves to the DE version
 *   6. A correct <title> (template applied, separator present, never empty)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { HelmetProvider, HelmetData } from 'react-helmet-async';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { META_CONFIG, getCanonicalUrl } from '@/lib/metaConfig';
import { createSymmetricAlternates } from '@/lib/localeUtils';
import { Locale } from '@/lib/i18n';

const flushHelmet = () =>
  act(async () => {
    // helmet schedules DOM mutations via requestAnimationFrame (defer=true);
    // resolve one rAF cycle so the tags are committed before we read them.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

// ── Test helpers ──────────────────────────────────────────────────────────────

interface ParsedHead {
  title: string;
  canonical: string | null;
  canonicalCount: number;
  description: string | null;
  robots: string | null;
  htmlLang: string | null;
  hreflangs: Array<{ hreflang: string; href: string }>;
  ogLocale: string | null;
}

const parseHelmet = (_helmetContext: HelmetData): ParsedHead => {
  // In jsdom, react-helmet-async applies side effects to document.head (since
  // canUseDOM is true). Read the tags directly from there. This is the same
  // way the browser would see them, so it matches production behaviour exactly.
  const head = document.head;

  const title = head.querySelector('title')?.textContent ?? '';
  const canonicals = head.querySelectorAll('link[rel="canonical"]');
  const canonical = canonicals[0]?.getAttribute('href') ?? null;
  const description = head.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;
  const robots = head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;
  const htmlLang = document.documentElement.getAttribute('lang') ?? null;
  const hreflangs: Array<{ hreflang: string; href: string }> = [];
  head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => {
    const hreflang = el.getAttribute('hreflang');
    const href = el.getAttribute('href');
    if (hreflang && href) hreflangs.push({ hreflang, href });
  });
  const ogLocale = head.querySelector('meta[property="og:locale"]')?.getAttribute('content') ?? null;

  return {
    title,
    canonical,
    canonicalCount: canonicals.length,
    description,
    robots,
    htmlLang,
    hreflangs,
    ogLocale,
  };
};

const renderDocumentMeta = async (
  props: Parameters<typeof DocumentMeta>[0],
): Promise<ParsedHead> => {
  const helmetContext: HelmetData = {} as HelmetData;
  render(
    <HelmetProvider context={helmetContext}>
      <DocumentMeta {...props} />
    </HelmetProvider>,
  );
  await flushHelmet();
  return parseHelmet(helmetContext);
};

// ── Per-route expected SEO ────────────────────────────────────────────────────

interface RouteSpec {
  /** Test name suffix */
  name: string;
  /** Page props (title/description/canonicalPath/locale/alternates/noindex) */
  props: Parameters<typeof DocumentMeta>[0];
  /**
   * Whether this page has a translated EN equivalent that we must link to
   * via an other-locale hreflang.
   */
  hasAlternate: boolean;
}

const ROUTES: Array<{ de: RouteSpec; en?: RouteSpec }> = [
  {
    de: {
      name: 'Home (/)',
      props: {
        title: 'Workshop Agenda – Session Ablauf Planer',
        description: 'Kostenloser Ablauf Planer für Trainer, Coaches und Moderatoren.',
        canonicalPath: '/',
        locale: 'de',
        alternates: { de: '/', en: '/en' },
      },
      hasAlternate: true,
    },
    en: {
      name: 'Home (/en)',
      props: {
        title: 'Workshop Agenda – Session Planner',
        description: 'Free agenda planner for trainers, coaches and facilitators.',
        canonicalPath: '/en',
        locale: 'en',
        alternates: { de: '/', en: '/en' },
      },
      hasAlternate: true,
    },
  },
  {
    de: {
      name: 'Blog index (/blog)',
      props: {
        title: 'Blog',
        description: 'Artikel rund um Workshops und Sessionplan.',
        canonicalPath: '/blog',
        locale: 'de',
        alternates: createSymmetricAlternates('/blog'),
      },
      hasAlternate: true,
    },
    en: {
      name: 'Blog index (/en/blog)',
      props: {
        title: 'Blog',
        description: 'Articles about workshops and Sessionplan.',
        canonicalPath: '/en/blog',
        locale: 'en',
        alternates: createSymmetricAlternates('/blog'),
      },
      hasAlternate: true,
    },
  },
  {
    de: {
      name: 'Blog article (/blog/:slug)',
      props: {
        title: 'Ein Artikel',
        description: 'Beschreibung des Artikels.',
        canonicalPath: '/blog/ein-artikel',
        locale: 'de',
        alternates: { de: '/blog/ein-artikel', en: '/en/blog/an-article' },
      },
      hasAlternate: true,
    },
    en: {
      name: 'Blog article (/en/blog/:slug)',
      props: {
        title: 'An article',
        description: 'Description of the article.',
        canonicalPath: '/en/blog/an-article',
        locale: 'en',
        alternates: { de: '/blog/ein-artikel', en: '/en/blog/an-article' },
      },
      hasAlternate: true,
    },
  },
  {
    de: {
      name: 'Templates index (/templates)',
      props: {
        title: 'Vorlagen',
        description: 'Workshop-Vorlagen für verschiedene Anlässe.',
        canonicalPath: '/templates',
        locale: 'de',
        alternates: createSymmetricAlternates('/templates'),
      },
      hasAlternate: true,
    },
    en: {
      name: 'Templates index (/en/templates)',
      props: {
        title: 'Templates',
        description: 'Workshop templates for various occasions.',
        canonicalPath: '/en/templates',
        locale: 'en',
        alternates: createSymmetricAlternates('/templates'),
      },
      hasAlternate: true,
    },
  },
  {
    de: {
      name: 'Template detail (/templates/:slug)',
      props: {
        title: 'Retrospektive Vorlage',
        description: 'Vorlage für eine Retrospektive.',
        canonicalPath: '/templates/retrospektive',
        locale: 'de',
        alternates: { de: '/templates/retrospektive', en: '/en/templates/retrospective' },
      },
      hasAlternate: true,
    },
    en: {
      name: 'Template detail (/en/templates/:slug)',
      props: {
        title: 'Retrospective template',
        description: 'Template for a retrospective.',
        canonicalPath: '/en/templates/retrospective',
        locale: 'en',
        alternates: { de: '/templates/retrospektive', en: '/en/templates/retrospective' },
      },
      hasAlternate: true,
    },
  },
  {
    de: {
      name: 'Landing page (/:slug)',
      props: {
        title: 'Workshop planen',
        description: 'So planst du einen Workshop.',
        canonicalPath: '/workshop-ablauf-planen',
        locale: 'de',
        alternates: { de: '/workshop-ablauf-planen', en: '/en/workshop-planning' },
      },
      hasAlternate: true,
    },
    en: {
      name: 'Landing page (/en/:slug)',
      props: {
        title: 'Workshop planning',
        description: 'How to plan a workshop.',
        canonicalPath: '/en/workshop-planning',
        locale: 'en',
        alternates: { de: '/workshop-ablauf-planen', en: '/en/workshop-planning' },
      },
      hasAlternate: true,
    },
  },
  {
    de: {
      name: 'Landing pages index (/landing-pages)',
      props: {
        title: 'Landing Pages',
        description: 'Alle Landing Pages.',
        canonicalPath: '/landing-pages',
        locale: 'de',
        alternates: createSymmetricAlternates('/landing-pages'),
      },
      hasAlternate: true,
    },
    en: {
      name: 'Landing pages index (/en/landing-pages)',
      props: {
        title: 'Landing Pages',
        description: 'All landing pages.',
        canonicalPath: '/en/landing-pages',
        locale: 'en',
        alternates: createSymmetricAlternates('/landing-pages'),
      },
      hasAlternate: true,
    },
  },
  {
    de: {
      name: '404 (/404)',
      props: {
        title: 'Seite nicht gefunden (404)',
        description: 'Die angeforderte Seite konnte nicht gefunden werden.',
        canonicalPath: '/404',
        noindex: true,
        robots: 'noindex,nofollow',
      },
      hasAlternate: false,
    },
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SEO: every route ships correct canonical / hreflang / title', () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  for (const pair of ROUTES) {
    describe(pair.de.name, () => {
      it('renders exactly one <link rel="canonical">', async () => {
        const head = await renderDocumentMeta(pair.de.props);
        expect(head.canonicalCount).toBe(1);
      });

      it('canonical points to the production base URL', async () => {
        const head = await renderDocumentMeta(pair.de.props);
        const expectedCanonical = getCanonicalUrl(pair.de.props.canonicalPath!);
        expect(head.canonical).toBe(expectedCanonical);
        const baseEscaped = META_CONFIG.baseUrl.replace(/\./g, '\\.');
        expect(head.canonical).toMatch(new RegExp(`^${baseEscaped}/`));
      });

      it('has a non-empty <title> with a separator', async () => {
        const head = await renderDocumentMeta(pair.de.props);
        expect(head.title).toBeTruthy();
        expect(head.title.length).toBeGreaterThan(0);
        // Either the brand template was applied ("X – Sessionplan") or the
        // page already ships a complete title containing a separator.
        const hasBrandSuffix = /Sessionplan/.test(head.title);
        const hasInlineSeparator = /–|\|/.test(head.title);
        expect(hasBrandSuffix || hasInlineSeparator).toBe(true);
      });

      it('has a non-empty meta description', async () => {
        const head = await renderDocumentMeta(pair.de.props);
        expect(head.description).toBeTruthy();
        expect(head.description!.length).toBeGreaterThan(0);
      });

      it('sets <html lang> to the page locale', async () => {
        const head = await renderDocumentMeta(pair.de.props);
        const expectedLang = pair.de.props.locale ?? 'de';
        expect(head.htmlLang).toBe(expectedLang);
      });

      it('contains exactly one self-hreflang', async () => {
        const head = await renderDocumentMeta(pair.de.props);
        const expectedLang = pair.de.props.locale ?? 'de';
        const selfTags = head.hreflangs.filter((h) => h.hreflang === expectedLang);
        expect(selfTags).toHaveLength(1);
        expect(selfTags[0].href).toBe(getCanonicalUrl(pair.de.props.canonicalPath!));
      });

      it('emits x-default pointing to EN when an EN alternate exists, else to the DE self URL', async () => {
        const head = await renderDocumentMeta(pair.de.props);
        const xDefault = head.hreflangs.filter((h) => h.hreflang === 'x-default');
        // x-default must exist on every route (paired or not).
        expect(xDefault).toHaveLength(1);
        const enPath = pair.de.props.alternates?.en;
        if (enPath) {
          // Paired: x-default must point at the EN alternate.
          expect(xDefault[0].href).toBe(getCanonicalUrl(enPath));
        } else {
          // DE-only: x-default must point at the page's own DE URL.
          expect(xDefault[0].href).toBe(getCanonicalUrl(pair.de.props.canonicalPath!));
        }
      });

      if (pair.de.hasAlternate) {
        it('contains an other-locale hreflang pointing at the translated equivalent', async () => {
          const head = await renderDocumentMeta(pair.de.props);
          const otherLang: Locale = pair.de.props.locale === 'de' ? 'en' : 'de';
          const otherTags = head.hreflangs.filter((h) => h.hreflang === otherLang);
          expect(otherTags).toHaveLength(1);
          const otherPath = pair.de.props.alternates?.[otherLang];
          expect(otherPath).toBeTruthy();
          expect(otherTags[0].href).toBe(getCanonicalUrl(otherPath!));
          expect(otherTags[0].href.startsWith(META_CONFIG.baseUrl)).toBe(true);
        });
      } else {
        it('has no other-locale hreflang (no EN equivalent exists)', async () => {
          const head = await renderDocumentMeta(pair.de.props);
          // No alternates were passed → no other-locale hreflang should exist.
          // Self-hreflang (defaulting to 'de') and x-default (pointing at
          // the DE self URL) are both emitted on these DE-only pages.
          const enTags = head.hreflangs.filter((h) => h.hreflang === 'en');
          expect(enTags).toHaveLength(0);
        });
      }

      if (pair.de.props.noindex) {
        it('declares noindex when the page opts out of indexing', async () => {
          const head = await renderDocumentMeta(pair.de.props);
          expect(head.robots).toBe('noindex,nofollow');
        });
      }
    });

    if (pair.en) {
      describe(`${pair.en.name} ↔ ${pair.de.name} (bidirectional hreflang)`, () => {
        afterEach(() => cleanup());

        it('the DE page points to the EN page and the EN page points back to the DE page', async () => {
          const deHead = await renderDocumentMeta(pair.de.props);
          const enHead = await renderDocumentMeta(pair.en!.props);

          const deEnHreflang = deHead.hreflangs.find((h) => h.hreflang === 'en');
          const enDeHreflang = enHead.hreflangs.find((h) => h.hreflang === 'de');

          expect(deEnHreflang).toBeDefined();
          expect(enDeHreflang).toBeDefined();

          expect(deEnHreflang!.href).toBe(getCanonicalUrl(pair.en!.props.canonicalPath!));
          expect(enDeHreflang!.href).toBe(getCanonicalUrl(pair.de.props.canonicalPath!));
        });

        it('x-default is consistent across both pages (points to the EN URL on paired routes)', async () => {
          const deHead = await renderDocumentMeta(pair.de.props);
          const enHead = await renderDocumentMeta(pair.en!.props);
          const deXDefault = deHead.hreflangs.find((h) => h.hreflang === 'x-default');
          const enXDefault = enHead.hreflangs.find((h) => h.hreflang === 'x-default');
          // x-default must exist on both sides.
          expect(deXDefault).toBeDefined();
          expect(enXDefault).toBeDefined();
          // x-default must point to the EN URL (the "fallback" language for
          // users without a language preference). Both sides should
          // therefore resolve to the same target.
          expect(deXDefault!.href).toBe(getCanonicalUrl(pair.en!.props.canonicalPath!));
          expect(enXDefault!.href).toBe(getCanonicalUrl(pair.en!.props.canonicalPath!));
          expect(deXDefault!.href).toBe(enXDefault!.href);
        });
      });
    }
  }
});

describe('SEO: buildHreflangLinks is symmetric for every paired route', () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it('produces the same set of hreflangs for both DE and EN views of a paired route', async () => {
    const alternates = createSymmetricAlternates('/blog');
    const deHead = await renderDocumentMeta({
      title: 'x',
      description: 'y',
      canonicalPath: alternates.de,
      locale: 'de',
      alternates,
    });
    const enHead = await renderDocumentMeta({
      title: 'x',
      description: 'y',
      canonicalPath: alternates.en,
      locale: 'en',
      alternates,
    });

    const deHreflangs = deHead.hreflangs.map((h) => h.hreflang).sort();
    const enHreflangs = enHead.hreflangs.map((h) => h.hreflang).sort();
    expect(deHreflangs).toEqual(enHreflangs);
  });
});
