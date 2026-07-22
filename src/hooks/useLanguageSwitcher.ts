/**
 * useLanguageSwitcher — Computes the target URL when the user switches locale.
 *
 * Strategy:
 *   1. If the current page has an explicit alternate URL for the target locale
 *      (published by the page via `publishAlternates`), navigate there.
 *   2. For static index pages (/blog, /templates, /landing-pages) swap prefix.
 *   3. Otherwise fall back to the home page of the target locale (/ or /en).
 *
 * This hook does NOT redirect automatically — it returns the target URL so
 * the caller can render it as a <Link> (better for SEO / accessibility).
 */
import { useLocation } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { type Locale, LOCALE_PREFIX } from '@/lib/i18n';

/** Known static routes that exist symmetrically in both locales */
const STATIC_BILATERAL_PATHS: string[] = ['/blog', '/templates', '/landing-pages'];

export const useLanguageSwitcher = () => {
  const { locale, alternates } = useLocale();
  const { pathname } = useLocation();

  /**
   * Returns the URL to navigate to when switching to `targetLocale`.
   */
  const getTargetUrl = (targetLocale: Locale): string => {
    if (targetLocale === locale) return pathname;

    // 1. Explicit alternate provided by the current content page
    const explicit = alternates[targetLocale];
    if (explicit) return explicit;

    // 2. Static index pages known to exist in both languages
    for (const staticPath of STATIC_BILATERAL_PATHS) {
      const deVariant = staticPath;
      const enVariant = `${LOCALE_PREFIX.en}${staticPath}`;

      if (pathname === deVariant || pathname === enVariant) {
        return targetLocale === 'de' ? deVariant : enVariant;
      }
    }

    // 3. Fallback: home page of the target locale
    return targetLocale === 'de' ? '/' : LOCALE_PREFIX.en;
  };

  return { locale, getTargetUrl };
};
