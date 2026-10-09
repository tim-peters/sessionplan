/**
 * useLanguageSwitcher — Computes the target URL when the user switches locale.
 *
 * Strategy:
 *   1. If the current page has an explicit alternate URL for the target locale
 *      (published by the page via `publishAlternates`), navigate there.
 *   2. For static bilingual pages swap between their locale-specific paths.
 *   3. Otherwise fall back to the home page of the target locale (/ or /en).
 *
 * This hook does NOT redirect automatically — it returns the target URL so
 * the caller can render it as a <Link> (better for SEO / accessibility).
 *
 * `getAlternateUrl` is the strict variant used by the LanguageHint: it returns
 * null when only the home-page fallback would apply, so the hint never points
 * anywhere but at a real translation of the current page.
 */
import { useLocation } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { type Locale, LOCALE_PREFIX } from '@/lib/i18n';

/** Known static routes that exist symmetrically in both locales */
const STATIC_BILATERAL_PATHS: Array<[string, string]> = [
  ['/', '/en'],
  ['/blog', '/en/blog'],
  ['/templates', '/en/templates'],
  ['/landing-pages', '/en/landing-pages'],
  ['/impressum', '/en/imprint'],
  ['/datenschutz', '/en/privacy'],
];

export const useLanguageSwitcher = () => {
  const { locale, alternates } = useLocale();
  const { pathname, search } = useLocation();

  // Dynamic sessions use the query string for the server-side session ID.
  const withCurrentSearch = (path: string): string => {
    if (!search) return path;
    return `${path}${path.includes('?') ? '&' : '?'}${search.slice(1)}`;
  };

  /**
   * Returns the URL of the real translation for `targetLocale`, or null when
   * no translated equivalent of the current page is known. Preserves the
   * query string (e.g. the dynamic-link session id) like `getTargetUrl`.
   */
  const getAlternateUrl = (targetLocale: Locale): string | null => {
    if (targetLocale === locale) return `${pathname}${search}`;

    // 1. Explicit alternate provided by the current content page
    const explicit = alternates[targetLocale];
    if (explicit) return withCurrentSearch(explicit);

    // 2. Static index pages known to exist in both languages
    for (const [deVariant, enVariant] of STATIC_BILATERAL_PATHS) {
      if (pathname === deVariant || pathname === enVariant) {
        return withCurrentSearch(targetLocale === 'de' ? deVariant : enVariant);
      }
    }

    // 3. No verified translation — callers must not guess (e.g. the language
    //    hint must never fall back to the home page of the other locale).
    return null;
  };

  /**
   * Returns the URL to navigate to when switching to `targetLocale`.
   */
  const getTargetUrl = (targetLocale: Locale): string => {
    return getAlternateUrl(targetLocale) ?? withCurrentSearch(targetLocale === 'de' ? '/' : LOCALE_PREFIX.en);
  };

  return { locale, getTargetUrl, getAlternateUrl };
};
