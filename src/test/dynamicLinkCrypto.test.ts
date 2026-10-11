import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDynamicSecret, decryptWorkshop, encryptWorkshop } from '@/lib/dynamicLinkCrypto';
import { makeWorkshop } from './test-helpers';

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

describe('dynamic link encryption', () => {
  it('uses a fresh IV and authenticates the ID, ciphertext, and visible title', async () => {
    const key = createDynamicSecret();
    const id = 'A'.repeat(22);
    const workshop = makeWorkshop();
    const first = await encryptWorkshop(workshop, id, key);
    const second = await encryptWorkshop(workshop, id, key);

    await expect(decryptWorkshop(first, id, key)).resolves.toEqual(workshop);
    expect(first.iv).not.toBe(second.iv);
    await expect(decryptWorkshop(first, 'B'.repeat(22), key)).rejects.toThrow();
    await expect(decryptWorkshop({ ...first, title: 'Changed on server' }, id, key)).rejects.toThrow();
    await expect(decryptWorkshop({ ...first, ciphertext: `${first.ciphertext[0] === 'A' ? 'B' : 'A'}${first.ciphertext.slice(1)}` }, id, key)).rejects.toThrow();
  });
});
