/**
 * structuredData — Helpers for hardening JSON-LD output before rendering.
 *
 * Role: Pages pass schema.org objects/arrays to <DocumentMeta>. Third-party
 *       scripts (and some browser extensions) call `.toLowerCase()` on
 *       `@context` and crash when it's missing or non-string. We normalize
 *       the structured data on the way out so this never crashes the route.
 */
const SCHEMA_ORG_CONTEXT = 'https://schema.org';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Normalize a structured-data payload for safe JSON-LD rendering.
 *
 * - Returns `[]` for undefined/null/non-object input.
 * - Coerces the input into an array.
 * - Drops non-object entries (strings/numbers/null are invalid top-level
 *   JSON-LD nodes — emit nothing rather than crash).
 * - Ensures every plain object has a string `@context` (defaults to
 *   schema.org when missing or non-string). When `@context` is wrong-typed
 *   it is overwritten, never left in place, so downstream parsers don't
 *   choke on `.toLowerCase()` of an object.
 */
export const normalizeStructuredData = (
  input: unknown,
): Record<string, unknown>[] => {
  if (input === undefined || input === null) return [];

  const list = Array.isArray(input) ? input : [input];
  const result: Record<string, unknown>[] = [];

  for (const entry of list) {
    if (!isPlainObject(entry)) continue;
    if (typeof entry['@context'] !== 'string') {
      const { '@context': _ignored, ...rest } = entry;
      result.push({ '@context': SCHEMA_ORG_CONTEXT, ...rest });
    } else {
      result.push(entry);
    }
  }

  return result;
};

/**
 * Collapse normalized JSON-LD entries into a SINGLE top-level object.
 *
 * Safari (and Safari-extension content scripts) crash with
 * `undefined is not an object (evaluating 'r["@context"].toLowerCase')`
 * when a JSON-LD script contains a top-level JSON *array* — even though
 * arrays are valid JSON-LD. The recommended portable form (JSON-LD spec,
 * Google docs) is one object with an `@graph` property. Returns:
 * - `null` for an empty list,
 * - the single object itself when there is exactly one entry,
 * - otherwise `{ '@context': schema.org, '@graph': entries }`.
 */
export const toJsonLdPayload = (
  entries: Record<string, unknown>[],
): Record<string, unknown> | null => {
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0];
  return { '@context': SCHEMA_ORG_CONTEXT, '@graph': entries };
};