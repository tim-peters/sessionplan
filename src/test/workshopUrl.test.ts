import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeWorkshopToUrl,
  decodeWorkshopFromUrl,
  getWorkshopFromHash,
  setWorkshopToHash,
  hasWorkshopItems,
  copyShareLink,
} from '@/lib/workshopUrl';
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

describe('hasWorkshopItems', () => {
  it('returns false for null / undefined', () => {
    expect(hasWorkshopItems(null)).toBe(false);
    expect(hasWorkshopItems(undefined)).toBe(false);
  });
  it('returns false when items is empty', () => {
    expect(hasWorkshopItems(makeWorkshop())).toBe(false);
  });
  it('returns true when items is non-empty', () => {
    expect(
      hasWorkshopItems(
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
    expect(hasWorkshopItems({ ...makeWorkshop(), items: undefined as never })).toBe(false);
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
