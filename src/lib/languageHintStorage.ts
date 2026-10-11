/**
 * languageHintStorage — Data-minimal persistence for the voluntary language hint.
 *
 * Role: Stores (a) per-direction dismissals of the language suggestion hint for
 *       30 days in localStorage and (b) an active language choice for the
 *       current session in sessionStorage. No IP addresses, no location data —
 *       only a direction string (e.g. "en->de") and a timestamp.
 *
 * Direction convention: "<browserBaseLanguage>-><pageLocale>". A visitor on a
 * German page whose browser prefers English has direction "en->de"; "Stay in
 * German" dismisses that direction. A visitor on an English page whose browser
 * prefers German has direction "de->en"; "Auf Englisch bleiben" dismisses that
 * one. Because only two locales exist, the direction is fully determined by the
 * page locale — storing the explicit direction keeps the semantics readable.
 */
import { Locale } from '@/lib/i18n';

const STORAGE_KEY = 'sp:lang-hint';
const SESSION_KEY = 'sp:lang-choice';

/** How long a "stay" decision suppresses the hint for the same direction. */
const DISMISSAL_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type Dismissals = Record<string, number>;

const readDismissals = (): Dismissals => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Dismissals;
  } catch {
    return {};
  }
};

/** True while a previous "stay" decision for this direction is still fresh. */
export const isLanguageHintDismissed = (direction: string): boolean => {
  try {
    const dismissedAt = readDismissals()[direction];
    if (typeof dismissedAt !== 'number') return false;
    return Date.now() - dismissedAt < DISMISSAL_TTL_MS;
  } catch {
    return false;
  }
};

/** Persists a "stay in this language" decision for the given direction. */
export const dismissLanguageHint = (direction: string): void => {
  try {
    const dismissals = readDismissals();
    // Drop expired entries so the stored object stays tiny.
    const now = Date.now();
    for (const [key, at] of Object.entries(dismissals)) {
      if (typeof at !== 'number' || now - at >= DISMISSAL_TTL_MS) {
        delete dismissals[key];
      }
    }
    dismissals[direction] = now;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissals));
  } catch {
    /* storage unavailable (e.g. privacy mode) — the hint simply re-shows */
  }
};

/**
 * Records an active language choice (language switcher or hint CTA) for the
 * running session. While set, the hint stays suppressed — the explicit choice
 * takes precedence over the browser language until the visitor changes the
 * language again (which simply overwrites the stored choice).
 */
export const setSessionLanguageChoice = (locale: Locale): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, locale);
  } catch {
    /* ignore */
  }
};

/** True once the visitor has actively chosen a language this session. */
export const hasSessionLanguageChoice = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return false;
  }
};
