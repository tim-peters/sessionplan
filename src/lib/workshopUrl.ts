/** @file workshopUrl — URL encoding/decoding for workshop data (LZ-string compressed hash). */
import { WorkshopData } from '@/types/workshop';
import LZString from 'lz-string';

/** LZ-string compression for URL encoding (v2 format). */
export const encodeWorkshopToUrl = (data: WorkshopData): string => {
  try {
    const json = JSON.stringify(data);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return 'v2:' + compressed;
  } catch (error) {
    console.error('Failed to encode workshop:', error);
    return '';
  }
};

export const decodeWorkshopFromUrl = (encoded: string): WorkshopData | null => {
  try {
    if (encoded.startsWith('v2:')) {
      const compressed = encoded.substring(3);
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) {
        throw new Error('Decompression failed');
      }
      return JSON.parse(json) as WorkshopData;
    }

    // Legacy format (base64 + URI encoding) - for backwards compatibility
    console.warn('Loading workshop from legacy URL format. Consider resharing with new format.');
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json) as WorkshopData;
  } catch (error) {
    console.error('Failed to decode workshop:', error);
    return null;
  }
};

export const getWorkshopFromHash = (): WorkshopData | null => {
  const hash = window.location.hash;
  if (hash.startsWith('#data=')) {
    const encoded = hash.substring(6);
    return decodeWorkshopFromUrl(encoded);
  }
  return null;
};

export const hasWorkshopItems = (data: WorkshopData | null | undefined): data is WorkshopData => {
  return !!data && Array.isArray(data.items) && data.items.length > 0;
};

export const setWorkshopToHash = (data: WorkshopData): void => {
  if (!hasWorkshopItems(data)) {
    window.history.replaceState(null, '', window.location.pathname);
    return;
  }

  const encoded = encodeWorkshopToUrl(data);
  if (encoded) {
    window.history.replaceState(null, '', `#data=${encoded}`);
  }
};

export const copyShareLink = async (data: WorkshopData): Promise<boolean> => {
  const encoded = encodeWorkshopToUrl(data);
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;

  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy link:', error);
    return false;
  }
};
