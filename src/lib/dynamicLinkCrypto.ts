import type { WorkshopData } from '@/types/workshop';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const createDynamicSecret = (byteLength = 32): string => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

export const getDynamicSecretsFromHash = (): { encryptionKey: string | null; writeCapability: string | null } => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return { encryptionKey: params.get('k'), writeCapability: params.get('w') };
};

export const hashWriteCapability = async (capability: string): Promise<string> =>
  toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', fromBase64Url(capability))));

const importKey = (key: string) => crypto.subtle.importKey('raw', fromBase64Url(key), 'AES-GCM', false, ['encrypt', 'decrypt']);
const additionalData = (id: string) => encoder.encode(`sessionplan:encrypted-v1:${id}`);

export interface EncryptedWorkshopEnvelope {
  format: 'encrypted-v1';
  title: string;
  ciphertext: string;
  iv: string;
}

export const encryptWorkshop = async (
  data: WorkshopData,
  id: string,
  encryptionKey: string,
): Promise<EncryptedWorkshopEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Repeating the visible title inside the authenticated payload lets clients
  // detect server-side title manipulation when decrypting.
  const plaintext = encoder.encode(JSON.stringify({ ...data, workshop: { ...data.workshop, title: data.workshop.title } }));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(id) },
    await importKey(encryptionKey),
    plaintext,
  );
  return { format: 'encrypted-v1', title: data.workshop.title, ciphertext: toBase64Url(new Uint8Array(ciphertext)), iv: toBase64Url(iv) };
};

export const decryptWorkshop = async (
  envelope: EncryptedWorkshopEnvelope,
  id: string,
  encryptionKey: string,
): Promise<WorkshopData> => {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(envelope.iv), additionalData: additionalData(id) },
    await importKey(encryptionKey),
    fromBase64Url(envelope.ciphertext),
  );
  const data = JSON.parse(decoder.decode(plaintext)) as WorkshopData;
  if (data.workshop.title !== envelope.title) throw new Error('Encrypted session title does not match authenticated content.');
  return data;
};
