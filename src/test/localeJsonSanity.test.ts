import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_DEPTH = 10;

interface LocaleNode {
  [key: string]: unknown;
}

const walk = (
  node: unknown,
  visit: (path: string[], value: unknown) => void,
  path: string[] = [],
): void => {
  visit(path, node);
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(child, visit, [...path, String(i)]));
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as LocaleNode)) {
      walk(value, visit, [...path, key]);
    }
  }
};

const collectDepth = (node: unknown): number => {
  if (Array.isArray(node)) {
    if (node.length === 0) return 1;
    return 1 + Math.max(...node.map(collectDepth));
  }
  if (node !== null && typeof node === 'object') {
    const values = Object.values(node as LocaleNode);
    if (values.length === 0) return 1;
    return 1 + Math.max(...values.map(collectDepth));
  }
  return 1;
};

describe('locale JSON sanity (public/locales)', () => {
  const de = JSON.parse(
    readFileSync(join(process.cwd(), 'public/locales/de/common.json'), 'utf-8'),
  ) as unknown;
  const en = JSON.parse(
    readFileSync(join(process.cwd(), 'public/locales/en/common.json'), 'utf-8'),
  ) as unknown;

  it('both locale files parse as valid JSON', () => {
    expect(de).toBeTypeOf('object');
    expect(en).toBeTypeOf('object');
  });

  it('values are restricted to strings / objects / arrays (no functions, numbers, etc.)', () => {
    const offenders: string[] = [];
    for (const [locale, doc] of [
      ['de', de],
      ['en', en],
    ] as const) {
      walk(doc, (path, value) => {
        if (path.length === 0) return;
        if (value === null) return;
        const t = typeof value;
        if (t === 'string' || t === 'object') return;
        offenders.push(`${locale}: ${path.join('.')} (${t})`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it(`nesting depth is <= ${MAX_DEPTH} so i18next doesn't recurse itself into trouble`, () => {
    for (const [locale, doc] of [
      ['de', de],
      ['en', en],
    ] as const) {
      const depth = collectDepth(doc);
      expect(depth, `${locale} nesting depth ${depth}`).toBeLessThanOrEqual(MAX_DEPTH);
    }
  });

  it('no string value looks like a self-referential placeholder key', () => {
    // JSON files cannot have true cycles; this guards against placeholder
    // strings that re-include the parent key path (which i18next interprets
    // as a nested lookup and would otherwise blow up).
    const offenders: string[] = [];
    for (const [locale, doc] of [
      ['de', de],
      ['en', en],
    ] as const) {
      walk(doc, (path, value) => {
        if (typeof value !== 'string') return;
        if (path.length === 0) return;
        const key = path[path.length - 1];
        const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        if (re.test(value)) {
          offenders.push(`${locale}: ${path.join('.')} -> ${value}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});