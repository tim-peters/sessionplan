import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeWorkshopToUrl,
  decodeWorkshopFromUrl,
  getWorkshopFromHash,
  setWorkshopToHash,
  copyShareLink,
} from '@/lib/workshopUrl';
import { hasAnyItems } from '@/lib/workshop-days';
import { makeWorkshop, installClipboardMock, setHash } from './test-helpers';

describe('encodeWorkshopToUrl / decodeWorkshopFromUrl roundtrip', () => {
  it('encodes and decodes a workshop losslessly', () => {
    const data = makeWorkshop({
      items: [
        {
          id: 'b1',
          type: 'block',
          blockTypeId: 'input',
          title: 'Welcome',
          duration: 10,
          notes: '*hello* world',
          material: '',
        },
        {
          id: 'g1',
          type: 'group',
          blockTypeId: null,
          title: 'Group A',
          duration: 25,
          notes: '',
          material: '',
          durationLocked: false,
          children: [
            {
              id: 'b2',
              type: 'block',
              blockTypeId: null,
              title: 'Nested',
              duration: 25,
              notes: '',
              material: '',
            },
          ],
        },
      ],
    });
    const encoded = encodeWorkshopToUrl(data);
    expect(encoded.startsWith('v2:')).toBe(true);

    const decoded = decodeWorkshopFromUrl(encoded);
    expect(decoded).toEqual(data);
  });

  it('decodes a legacy base64 URL-encoded string', () => {
    const data = makeWorkshop({ items: [] });
    const json = JSON.stringify(data);
    const legacy = btoa(encodeURIComponent(json));
    // Strip any trailing = padding since the legacy branch uses raw atob + decodeURIComponent.
    const decoded = decodeWorkshopFromUrl(legacy);
    expect(decoded).toEqual(data);
  });

  it('returns null when the encoded value is corrupt', () => {
    expect(decodeWorkshopFromUrl('v2:!!not-base64-encoded-payload!!')).toBeNull();
  });

  it.each([
    ['days of the wrong type', { days: 'xy' }],
    ['empty day entries', { days: [null, null] }],
    ['days without an ID', { days: [{}, {}] }],
    ['duplicate day IDs', { days: [{ id: 'a' }, { id: 'a' }] }],
    ['day items of the wrong type', { days: [{ id: 'a' }, { id: 'b', items: 'x' }] }],
    ['an empty item in a later day', { days: [{ id: 'a' }, { id: 'b', items: [null] }] }],
    ['an empty nested item', { days: [{ id: 'a' }, { id: 'b', items: [{ id: 'c', children: [null] }] }] }],
    ['an empty item in the first day', { items: [null] }],
  ])('refuses a plan with %s', (_name, overrides) => {
    const encoded = encodeWorkshopToUrl({ ...makeWorkshop({ items: [] }), ...overrides } as never);
    expect(decodeWorkshopFromUrl(encoded)).toBeNull();
  });

  it('keeps a plan whose optional fields are missing or empty', () => {
    const data = { ...makeWorkshop({ items: [] }), days: [{ id: 'a' }, { id: 'b', items: null }] };
    expect(decodeWorkshopFromUrl(encodeWorkshopToUrl(data as never))).toEqual(data);
  });

  it('returns an empty string when encoding fails', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = encodeWorkshopToUrl(circular as never);
    expect(result).toBe('');
  });
});

describe('getWorkshopFromHash / setWorkshopToHash', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('returns null when the hash is empty', () => {
    expect(getWorkshopFromHash()).toBeNull();
  });

  it('returns null when the hash is not a #data= hash', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#something-else`);
    expect(getWorkshopFromHash()).toBeNull();
  });

  it('decodes a #data=v2:... hash', () => {
    const data = makeWorkshop();
    const encoded = encodeWorkshopToUrl(data);
    window.history.replaceState(null, '', `${window.location.pathname}#data=${encoded}`);
    expect(getWorkshopFromHash()).toEqual(data);
  });

  it('writes the hash when items are present', () => {
    const data = makeWorkshop({
      items: [
        {
          id: 'x',
          type: 'block',
          blockTypeId: null,
          title: 'X',
          duration: 5,
          notes: '',
          material: '',
        },
      ],
    });
    setWorkshopToHash(data);
    expect(window.location.hash).toMatch(/^#data=v2:/);
  });

  it('clears the hash when the workshop has no items', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#data=v2:leftover`);
    setWorkshopToHash(makeWorkshop());
    expect(window.location.hash).toBe('');
  });
});

describe('hasAnyItems', () => {
  it('returns false for null / undefined', () => {
    expect(hasAnyItems(null)).toBe(false);
    expect(hasAnyItems(undefined)).toBe(false);
  });
  it('returns false when items is empty', () => {
    expect(hasAnyItems(makeWorkshop())).toBe(false);
  });
  it('returns true when items is non-empty', () => {
    expect(
      hasAnyItems(
        makeWorkshop({
          items: [
            {
              id: 'x',
              type: 'block',
              blockTypeId: null,
              title: 'X',
              duration: 1,
              notes: '',
              material: '',
            },
          ],
        }),
      ),
    ).toBe(true);
  });
  it('returns false when items is not an array', () => {
    expect(hasAnyItems({ ...makeWorkshop(), items: undefined as never })).toBe(false);
  });
});

describe('copyShareLink', () => {
  it('writes the share URL to the clipboard and returns true', async () => {
    const writeText = installClipboardMock();
    const data = makeWorkshop();
    const ok = await copyShareLink(data);
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0][0] as string;
    expect(url).toMatch(/#data=v2:/);
  });

  it('returns false when the clipboard write rejects', async () => {
    installClipboardMock(async () => {
      throw new Error('clipboard blocked');
    });
    const ok = await copyShareLink(makeWorkshop());
    expect(ok).toBe(false);
  });
});
