import { describe, it, expect } from 'vitest';
import {
  getLocalePrefix,
  getLocalizedPath,
  getLocaleRoot,
  createSymmetricAlternates,
} from '@/lib/localeUtils';

describe('getLocalePrefix', () => {
  it('returns empty for de', () => {
    expect(getLocalePrefix('de')).toBe('');
  });
  it('returns /en for en', () => {
    expect(getLocalePrefix('en')).toBe('/en');
  });
});

describe('getLocalizedPath', () => {
  it('prefixes paths for en', () => {
    expect(getLocalizedPath('en', '/blog')).toBe('/en/blog');
  });
  it('returns the original path for de', () => {
    expect(getLocalizedPath('de', '/blog')).toBe('/blog');
  });
});

describe('getLocaleRoot', () => {
  it('returns / for de', () => {
    expect(getLocaleRoot('de')).toBe('/');
  });
  it('returns /en for en', () => {
    expect(getLocaleRoot('en')).toBe('/en');
  });
});

describe('createSymmetricAlternates', () => {
  it('creates de + en alternates for a path', () => {
    expect(createSymmetricAlternates('/blog')).toEqual({
      de: '/blog',
      en: '/en/blog',
    });
  });
});
