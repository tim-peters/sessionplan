/**
 * i18n — Initialises i18next with HTTP backend for lazy-loading translations.
 *
 * Role: Defines the Locale type, configures i18next with the HTTP backend so
 *       each language bundle is only fetched when needed (no DE strings in EN
 *       bundle and vice versa). The `common` namespace covers all shared UI
 *       strings (nav, footer, blog, templates, settings).
 *
 * Translation files live in public/locales/{lng}/common.json so they are
 * served as static assets and cached by the browser.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

export type Locale = 'de' | 'en';

export const LOCALES: Locale[] = ['de', 'en'];

/** Maps locale to BCP-47 language tag used in <html lang> and hreflang */
export const LOCALE_LANG_TAG: Record<Locale, string> = {
  de: 'de',
  en: 'en',
};

/** Maps locale to Open Graph locale string */
export const LOCALE_OG: Record<Locale, string> = {
  de: 'de_DE',
  en: 'en_US',
};

/** URL prefix for each locale. DE has no prefix (root). */
export const LOCALE_PREFIX: Record<Locale, string> = {
  de: '',
  en: '/en',
};

/**
 * Derives the locale from a URL pathname.
 * /en → 'en'  |  /en/anything → 'en'  |  everything else → 'de'
 */
export function getLocaleFromPathname(pathname: string): Locale {
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    return 'en';
  }
  return 'de';
}

/**
 * Returns the content-data directory prefix for a given locale and content type.
 * DE paths: /data/blog/  — EN paths: /data/blog/en/
 */
export function getContentDataPath(
  type: 'landing' | 'blog' | 'templates',
  locale: Locale
): string {
  const base = `/data/${type}/`;
  return locale === 'en' ? `${base}en/` : base;
}

i18next
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: 'de',
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common'],
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Prevents Suspense waterfall; pages handle loading state
    },
  });

export default i18next;
