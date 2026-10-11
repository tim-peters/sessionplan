import { describe, it, expect } from 'vitest';
import { normalizeStructuredData, toJsonLdPayload } from '@/lib/structuredData';

describe('normalizeStructuredData', () => {
  it('returns an empty array for undefined input', () => {
    expect(normalizeStructuredData(undefined)).toEqual([]);
  });

  it('returns an empty array for null input', () => {
    expect(normalizeStructuredData(null)).toEqual([]);
  });

  it('wraps a single object without @context in an array with schema.org context', () => {
    const result = normalizeStructuredData({ '@type': 'WebSite', name: 'X' });
    expect(result).toEqual([
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'X' },
    ]);
  });

  it('keeps an existing string @context untouched', () => {
    const input = { '@context': 'https://schema.org', '@type': 'Organization' };
    const result = normalizeStructuredData(input);
    expect(result).toEqual([input]);
    expect(result[0]['@context']).toBe('https://schema.org');
  });

  it('replaces a non-string @context with schema.org', () => {
    const result = normalizeStructuredData({
      '@context': { '@vocab': 'https://example.test' },
      '@type': 'Thing',
    });
    expect(result).toHaveLength(1);
    expect(typeof result[0]['@context']).toBe('string');
    expect(result[0]['@context']).toBe('https://schema.org');
    expect(result[0]['@type']).toBe('Thing');
  });

  it('processes every entry of an array', () => {
    const input = [
      { '@type': 'WebSite' },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList' },
      { '@context': 42, '@type': 'FAQPage' },
    ];
    const result = normalizeStructuredData(input);
    expect(result).toHaveLength(3);
    expect(result[0]['@context']).toBe('https://schema.org');
    expect(result[1]['@context']).toBe('https://schema.org');
    expect(result[2]['@context']).toBe('https://schema.org');
    expect(result.map((r) => r['@type'])).toEqual([
      'WebSite',
      'BreadcrumbList',
      'FAQPage',
    ]);
  });

  it('drops non-object entries instead of crashing', () => {
    const result = normalizeStructuredData([
      { '@type': 'WebSite' },
      'just a string',
      42,
      null,
      undefined,
      { '@type': 'FAQPage' },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r['@type'])).toEqual(['WebSite', 'FAQPage']);
  });

  it('does not mutate the input object', () => {
    const input = { '@type': 'WebSite', name: 'X' };
    const snapshot = JSON.stringify(input);
    normalizeStructuredData(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('toJsonLdPayload', () => {
  it('returns null for an empty list', () => {
    expect(toJsonLdPayload([])).toBeNull();
  });

  it('returns the single object itself (never a top-level array)', () => {
    const entry = { '@context': 'https://schema.org', '@type': 'WebSite' };
    expect(toJsonLdPayload([entry])).toBe(entry);
  });

  it('wraps multiple entries in a single @graph object (Safari-safe)', () => {
    const a = { '@context': 'https://schema.org', '@type': 'WebSite' };
    const b = { '@context': 'https://schema.org', '@type': 'Organization' };
    const payload = toJsonLdPayload([a, b]);
    expect(Array.isArray(payload)).toBe(false);
    expect(payload).toEqual({
      '@context': 'https://schema.org',
      '@graph': [a, b],
    });
  });
});