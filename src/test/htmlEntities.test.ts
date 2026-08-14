import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '@/lib/htmlEntities';

describe('decodeHtmlEntities', () => {
  it('decodes named German umlauts', () => {
    expect(decodeHtmlEntities('f&uuml;r')).toBe('für');
    expect(decodeHtmlEntities('&auml;&ouml;&uuml;&szlig;')).toBe('äöüß');
    expect(decodeHtmlEntities('&Auml;&Ouml;&Uuml;')).toBe('ÄÖÜ');
  });

  it('decodes common HTML entities', () => {
    expect(decodeHtmlEntities('D&amp;D')).toBe('D&D');
    expect(decodeHtmlEntities('Tim &amp; Co. &amp; Co.')).toBe('Tim & Co. & Co.');
    expect(decodeHtmlEntities('&bdquo;Zitat&ldquo;')).toBe('„Zitat“');
    expect(decodeHtmlEntities('&ndash;')).toBe('–');
    expect(decodeHtmlEntities('&rarr;')).toBe('→');
    expect(decodeHtmlEntities('&euro;')).toBe('€');
  });

  it('decodes numeric entities (decimal and hex)', () => {
    expect(decodeHtmlEntities('&#252;')).toBe('ü');
    expect(decodeHtmlEntities('&#xFC;')).toBe('ü');
    expect(decodeHtmlEntities('&#xfc;')).toBe('ü');
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeHtmlEntities('&notarealentity;')).toBe('&notarealentity;');
  });

  it('handles nullish and empty input', () => {
    expect(decodeHtmlEntities('')).toBe('');
    expect(decodeHtmlEntities(null)).toBe('');
    expect(decodeHtmlEntities(undefined)).toBe('');
  });

  it('handles mixed plain text and entities', () => {
    expect(decodeHtmlEntities('Der Timetable-Planer f&uuml;r alles')).toBe('Der Timetable-Planer für alles');
  });
});
