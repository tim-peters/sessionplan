import { describe, it, expect } from 'vitest';
import {
  getLocaleFromPathname,
  getContentDataPath,
  LOCALES,
  LOCALE_PREFIX,
  LOCALE_LANG_TAG,
  LOCALE_OG,
} from '@/lib/i18n';

describe('i18n constants', () => {
  it('exposes both supported locales', () => {
    expect(LOCALES).toEqual(['de', 'en']);
  });

  it('maps DE to no prefix and EN to /en', () => {
    expect(LOCALE_PREFIX.de).toBe('');
    expect(LOCALE_PREFIX.en).toBe('/en');
  });

  it('has matching language tags and OG locales for every locale', () => {
    for (const l of LOCALES) {
      expect(LOCALE_LANG_TAG[l]).toBeTruthy();
      expect(LOCALE_OG[l]).toBeTruthy();
    }
  });
});

describe('getLocaleFromPathname', () => {
  it('returns de for /', () => {
    expect(getLocaleFromPathname('/')).toBe('de');
  });

  it('returns de for arbitrary DE paths', () => {
    expect(getLocaleFromPathname('/blog')).toBe('de');
    expect(getLocaleFromPathname('/blog/some-slug')).toBe('de');
  });

  it('returns en for /en', () => {
    expect(getLocaleFromPathname('/en')).toBe('en');
  });

  it('returns en for any /en/... subpath', () => {
    expect(getLocaleFromPathname('/en/blog')).toBe('en');
    expect(getLocaleFromPathname('/en/landing-pages/foo')).toBe('en');
  });
});

describe('getContentDataPath', () => {
  it('uses the non-prefixed base path for de', () => {
    expect(getContentDataPath('blog', 'de')).toBe('/data/blog/');
    expect(getContentDataPath('landing', 'de')).toBe('/data/landing/');
    expect(getContentDataPath('templates', 'de')).toBe('/data/templates/');
  });

  it('inserts /en/ segment before the file name for en', () => {
    expect(getContentDataPath('blog', 'en')).toBe('/data/blog/en/');
    expect(getContentDataPath('landing', 'en')).toBe('/data/landing/en/');
    expect(getContentDataPath('templates', 'en')).toBe('/data/templates/en/');
  });
});
