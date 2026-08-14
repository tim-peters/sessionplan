import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveFaqPageSchema, mergeStructuredData, stripHtml } from '@/lib/landingPageSeo';
import type { LandingPageContent, SeoSection } from '@/types/landingPage';

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello <strong>world</strong>!</p>')).toBe('Hello world!');
  });
  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
  it('preserves text content from nested tags', () => {
    expect(stripHtml('<div><span>a</span> <span>b</span></div>')).toBe('a b');
  });
});

describe('deriveFaqPageSchema', () => {
  it('returns undefined when sections is undefined', () => {
    expect(deriveFaqPageSchema(undefined)).toBeUndefined();
  });

  it('returns undefined when sections is empty', () => {
    expect(deriveFaqPageSchema([])).toBeUndefined();
  });

  it('returns undefined when no FAQ section is present', () => {
    const sections: SeoSection[] = [
      { type: 'features', items: [{ title: 'X' }] },
      { type: 'prose', title: 'Hi', content: '<p>hi</p>' },
    ];
    expect(deriveFaqPageSchema(sections)).toBeUndefined();
  });

  it('returns undefined when FAQ section has no items', () => {
    const sections: SeoSection[] = [{ type: 'faq', title: 'FAQ', items: [] }];
    expect(deriveFaqPageSchema(sections)).toBeUndefined();
  });

  it('builds FAQPage from the first FAQ section', () => {
    const sections: SeoSection[] = [
      { type: 'features', items: [{ title: 'X' }] },
      {
        type: 'faq',
        title: 'FAQ',
        items: [
          { question: 'Q1?', answer: '<p>A1</p>' },
          { question: 'Q2?', answer: '<p>A2 with <a href="/x">link</a></p>' },
        ],
      },
    ];
    const schema = deriveFaqPageSchema(sections);
    expect(schema).toEqual({
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Q1?',
          acceptedAnswer: { '@type': 'Answer', text: 'A1' },
        },
        {
          '@type': 'Question',
          name: 'Q2?',
          acceptedAnswer: { '@type': 'Answer', text: 'A2 with link' },
        },
      ],
    });
  });
});

describe('mergeStructuredData', () => {
  it('returns base unchanged when derived is undefined', () => {
    const base = { '@type': 'WebApplication' };
    expect(mergeStructuredData(base, undefined)).toBe(base);
  });

  it('appends derived FAQPage to a @graph wrapper while preserving @context', () => {
    const base = {
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'WebApplication', name: 'X' }],
    };
    const derived = { '@type': 'FAQPage', mainEntity: [] };
    const merged = mergeStructuredData(base, derived);
    expect(merged).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebApplication', name: 'X' },
        { '@type': 'FAQPage', mainEntity: [] },
      ],
    });
  });

  it('replaces an existing FAQPage in @graph instead of duplicating', () => {
    const base = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebApplication' },
        { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'old' }] },
      ],
    };
    const derived = {
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'new', acceptedAnswer: { '@type': 'Answer', text: 'n' } }],
    };
    const merged = mergeStructuredData(base, derived);
    const graph = (merged as { '@graph': unknown[] })['@graph'];
    const faqNodes = (graph as Array<{ '@type': string }>).filter((n) => n['@type'] === 'FAQPage');
    expect(faqNodes).toHaveLength(1);
    expect(merged).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebApplication' },
        { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'new', acceptedAnswer: { '@type': 'Answer', text: 'n' } }] },
      ],
    });
  });

  it('wraps a single-object base in a @graph when adding derived', () => {
    const base = { '@type': 'WebApplication', name: 'X' };
    const derived = { '@type': 'FAQPage', mainEntity: [] };
    const merged = mergeStructuredData(base, derived);
    expect(merged).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebApplication', name: 'X' },
        { '@type': 'FAQPage', mainEntity: [] },
      ],
    });
  });

  it('preserves @context from a single-object base when wrapping in @graph', () => {
    const base = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'X' };
    const derived = { '@type': 'FAQPage', mainEntity: [] };
    const merged = mergeStructuredData(base, derived);
    expect(merged).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'X' },
        { '@type': 'FAQPage', mainEntity: [] },
      ],
    });
  });
});

describe('home.json migration — FAQPage auto-derivation', () => {
  const loadSanitized = (relPath: string): LandingPageContent => {
    const raw = readFileSync(join(process.cwd(), relPath), 'utf-8');
    let out = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (escape) {
        out += c;
        escape = false;
        continue;
      }
      if (c === '\\') {
        out += c;
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        out += c;
        continue;
      }
      if (inString && c === '\n') {
        out += '\\n';
        continue;
      }
      if (inString && c === '\r') {
        out += '\\r';
        continue;
      }
      out += c;
    }
    return JSON.parse(out);
  };

  it('derives a FAQPage from home.json that matches the original questions', () => {
    const content = loadSanitized('public/data/landing/home.json') as LandingPageContent;
    const faq = deriveFaqPageSchema(content.seoContent?.sections);
    expect(faq).toBeDefined();
    const mainEntity = (faq as { mainEntity: Array<{ name: string }> }).mainEntity;
    expect(mainEntity).toHaveLength(5);
    expect(mainEntity.map((q) => q.name)).toEqual([
      'Was kostet der Session Planer?',
      'Brauche ich einen Account oder Registrierung?',
      'Wie teile ich meine Workshop-Agenda mit anderen?',
      'Funktioniert sessionplan.de offline?',
      'Kann ich meine Daten sichern?',
    ]);
  });

  it('merged structuredData for home.json contains a single FAQPage', () => {
    const content = loadSanitized('public/data/landing/home.json') as LandingPageContent;
    const merged = mergeStructuredData(
      content.structuredData,
      deriveFaqPageSchema(content.seoContent?.sections),
    ) as { '@graph': Array<{ '@type': string }> };
    const faqs = merged['@graph'].filter((n) => n['@type'] === 'FAQPage');
    expect(faqs).toHaveLength(1);
  });

  it('derives a FAQPage from workshop-agenda-erstellen.json', () => {
    const content = loadSanitized('public/data/landing/workshop-agenda-erstellen.json') as LandingPageContent;
    const faq = deriveFaqPageSchema(content.seoContent?.sections);
    expect(faq).toBeDefined();
    const mainEntity = (faq as { mainEntity: Array<{ name: string }> }).mainEntity;
    expect(mainEntity.length).toBeGreaterThan(0);
  });

  it('derives a FAQPage from en/workshop-agenda.json', () => {
    const content = loadSanitized('public/data/landing/en/workshop-agenda.json') as LandingPageContent;
    const faq = deriveFaqPageSchema(content.seoContent?.sections);
    expect(faq).toBeDefined();
    const mainEntity = (faq as { mainEntity: Array<{ name: string }> }).mainEntity;
    expect(mainEntity.length).toBeGreaterThan(0);
  });

});
