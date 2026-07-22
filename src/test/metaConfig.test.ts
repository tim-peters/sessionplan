import { describe, it, expect } from 'vitest';
import {
  buildHreflangLinks,
  getOgLocale,
  getOgLocaleAlternates,
  getCanonicalUrl,
  formatTitle,
  getAbsoluteImageUrl,
  META_CONFIG,
} from '@/lib/metaConfig';

describe('getCanonicalUrl', () => {
  it('prefixes relative paths with the production base URL', () => {
    expect(getCanonicalUrl('/blog')).toBe(`${META_CONFIG.baseUrl}/blog`);
  });
  it('adds a leading slash when missing', () => {
    expect(getCanonicalUrl('blog')).toBe(`${META_CONFIG.baseUrl}/blog`);
  });
});

describe('formatTitle', () => {
  it('uses the default title when no title is provided', () => {
    expect(formatTitle(undefined)).toBe(META_CONFIG.defaultTitle);
  });
  it('applies the title template when no separator is present', () => {
    expect(formatTitle('My Page')).toBe('My Page – Sessionplan');
  });
  it('leaves titles with a separator untouched', () => {
    expect(formatTitle('My Page – Site')).toBe('My Page – Site');
    expect(formatTitle('My Page | Site')).toBe('My Page | Site');
  });
});

describe('getAbsoluteImageUrl', () => {
  it('returns the configured default when nothing is provided', () => {
    expect(getAbsoluteImageUrl()).toBe(`${META_CONFIG.baseUrl}${META_CONFIG.defaultOgImage}`);
  });
  it('leaves absolute URLs untouched', () => {
    expect(getAbsoluteImageUrl('https://cdn.example.com/img.png')).toBe(
      'https://cdn.example.com/img.png',
    );
  });
  it('prefixes relative URLs with the base', () => {
    expect(getAbsoluteImageUrl('/assets/x.png')).toBe(
      `${META_CONFIG.baseUrl}/assets/x.png`,
    );
  });
});

describe('getOgLocale', () => {
  it('returns the OG locale string for the given locale', () => {
    expect(getOgLocale('de')).toBe('de_DE');
    expect(getOgLocale('en')).toBe('en_US');
  });
});

describe('getOgLocaleAlternates', () => {
  it('returns all locales except the current one', () => {
    expect(getOgLocaleAlternates('de')).toEqual(['en_US']);
    expect(getOgLocaleAlternates('en')).toEqual(['de_DE']);
  });
});

describe('buildHreflangLinks', () => {
  it('emits the current page, alternates, and x-default pointing to the EN URL on a paired non-root path', () => {
    const links = buildHreflangLinks('de', '/blog', { en: '/en/blog' });
    expect(links).toEqual([
      { hreflang: 'de', href: `${META_CONFIG.baseUrl}/blog` },
      { hreflang: 'en', href: `${META_CONFIG.baseUrl}/en/blog` },
      { hreflang: 'x-default', href: `${META_CONFIG.baseUrl}/en/blog` },
    ]);
  });

  it('omits en hreflang on DE-only paths and x-default points to the DE self URL', () => {
    const links = buildHreflangLinks('de', '/impressum');
    expect(links).toEqual([
      { hreflang: 'de', href: `${META_CONFIG.baseUrl}/impressum` },
      { hreflang: 'x-default', href: `${META_CONFIG.baseUrl}/impressum` },
    ]);
  });

  it('emits x-default on the root path, pointing at the EN URL (the home fallback)', () => {
    // Mirrors the actual Index.tsx homeAlternates: the DE home is at "/"
    // and the EN home is at "/en". x-default should point at the EN home
    // for users without a language preference.
    const links = buildHreflangLinks('de', '/', { de: '/', en: '/en' });
    const xDefault = links.find((l) => l.hreflang === 'x-default');
    expect(xDefault?.href).toBe(`${META_CONFIG.baseUrl}/en`);
  });

  it('emits x-default pointing to EN self URL when the current page is EN on a paired path', () => {
    const links = buildHreflangLinks('en', '/en/blog', { de: '/blog' });
    const xDefault = links.find((l) => l.hreflang === 'x-default');
    expect(xDefault?.href).toBe(`${META_CONFIG.baseUrl}/en/blog`);
  });

  it('x-default points to EN when an EN alternate exists on the current page, else to DE', () => {
    // Paired path → x-default points to the EN alternate.
    const paired = buildHreflangLinks('de', '/blog/gute-workshops', {
      en: '/en/blog/how-to-run-great-workshops',
    });
    expect(paired.find((l) => l.hreflang === 'x-default')?.href).toBe(
      `${META_CONFIG.baseUrl}/en/blog/how-to-run-great-workshops`,
    );

    // DE-only path → x-default points to the DE self URL.
    const deOnly = buildHreflangLinks('de', '/impressum');
    expect(deOnly.find((l) => l.hreflang === 'x-default')?.href).toBe(
      `${META_CONFIG.baseUrl}/impressum`,
    );
  });

  it('omits x-default entirely when neither DE nor EN URL is present', () => {
    // Defensive: shouldn't happen in practice (locale is always in urlMap),
    // but guards against future refactors that might leave a page without
    // any URL.
    const links = buildHreflangLinks('de', '/', {});
    const xDefault = links.find((l) => l.hreflang === 'x-default');
    expect(xDefault).toBeDefined();
    // / has the current page's DE URL → x-default should still point to it.
    expect(xDefault?.href).toBe(`${META_CONFIG.baseUrl}/`);
  });
});
