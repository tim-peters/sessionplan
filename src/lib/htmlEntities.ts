/**
 * htmlEntities — Decodes HTML entities in plain-text content fields.
 *
 * Role: Titles, excerpts and meta descriptions are stored as HTML-encoded
 *       strings (e.g. "f&uuml;r", "D&amp;D") in the static content JSON. When
 *       rendered as React text nodes they would show up literally. This helper
 *       decodes the common named entities plus numeric (decimal/hex) forms so
 *       that these fields render as human-readable text. It intentionally
 *       returns a plain string (not dangerouslySetInnerHTML) so the output is
 *       always safely escaped by React.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  shy: '\u00AD',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bdquo: '\u201E',
  auml: '\u00E4',
  Auml: '\u00C4',
  ouml: '\u00F6',
  Ouml: '\u00D6',
  uuml: '\u00FC',
  Uuml: '\u00DC',
  szlig: '\u00DF',
  aacute: '\u00E1',
  Aacute: '\u00C1',
  eacute: '\u00E9',
  Eacute: '\u00C9',
  egrave: '\u00E8',
  Egrave: '\u00C8',
  euro: '\u20AC',
  cent: '\u00A2',
  pound: '\u00A3',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  rarr: '\u2192',
  larr: '\u2190',
  uarr: '\u2191',
  darr: '\u2193',
  middot: '\u00B7',
  deg: '\u00B0',
  plusmn: '\u00B1',
  times: '\u00D7',
  divide: '\u00F7',
};

/**
 * Decodes named and numeric HTML entities in a string.
 * Unknown named entities are left untouched. Returns a plain text string.
 */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return input ?? '';

  return input.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}