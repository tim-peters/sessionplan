/** @file sessionHistory — Type definitions for the local session history registry. */

/**
 * A single entry in the session history list stored under `sp:sessions`.
 * Local sessions store the full URL-encoded data; dynamic sessions store
 * the server key so we can navigate to `/?id=<serverKey>`.
 */
export interface SessionHistoryEntry {
  /** Unique identifier generated at session creation (generateId()). */
  id: string;
  /** Workshop title at last save. */
  title: string;
  /** Unix timestamp (ms) when the session was first created. */
  createdAt: number;
  /** Unix timestamp (ms) when the session data was last modified. */
  updatedAt: number;
  /** Unix timestamp (ms) when the session was last opened or modified. Used for 3-month expiry. */
  lastOpenedAt: number;
  /** Number of top-level workshop items at last save. */
  itemCount: number;
  /** Total duration of all top-level items in minutes at last save. */
  totalDuration: number;
  /** Session type. */
  type: 'local' | 'dynamic';
  /**
   * LZ-string encoded workshop data (return value of encodeWorkshopToUrl()),
   * without the leading `#data=`. Only present for `type === 'local'`.
   */
  urlHash?: string;
  /**
   * Legacy 12-char hex or encrypted 22-char Base64url server key.
   * Used to navigate to `/?id=<serverKey>`.
   */
  serverKey?: string;
  /** URL fragment containing the encryption key and optional write capability. */
  serverHash?: string;
  /** True when the server confirmed that the dynamic link no longer exists. */
  unavailable?: boolean;
}
