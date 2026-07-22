/**
 * LocaleContext — Provides the active locale and cross-page alternate URLs.
 *
 * Role: Derives the current locale purely from the URL pathname (URL is the
 *       single source of truth; no localStorage persistence). Also acts as a
 *       message bus so content pages can publish their alternate-language URLs,
 *       which the Language Switcher then consumes.
 *
 * Usage:
 *   const { locale } = useLocale();                        // current locale
 *   const { publishAlternates } = useLocale();             // set alternates from a page
 *   const { alternates } = useLocale();                    // read alternates in switcher
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import i18next, { type Locale, getLocaleFromPathname } from '@/lib/i18n';

interface LocaleContextValue {
  /** The locale inferred from the current URL pathname */
  locale: Locale;
  /**
   * Alternate URLs for the current page keyed by locale.
   * Example: { de: '/workshop-ablauf-planen', en: '/en/workshop-planning' }
   * Published by content pages (LandingPage, BlogArticle).
   * Static pages (Blog, Templates) don't need to publish — they always exist
   * in both languages at predictable paths.
   */
  alternates: Partial<Record<Locale, string>>;
  /**
   * Called by content pages to register their alternate-language URLs.
   * Should be called once when the page content is available.
   */
  publishAlternates: (alts: Partial<Record<Locale, string>> | undefined) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const locale = getLocaleFromPathname(pathname);
  const [alternates, setAlternates] = useState<Partial<Record<Locale, string>>>({});

  // Reset alternates synchronously during render (before children render) so that
  // publishAlternates called in child useLayoutEffect always writes last.
  const prevPathnameRef = useRef(pathname);
  if (pathname !== prevPathnameRef.current) {
    prevPathnameRef.current = pathname;
    setAlternates({});
  }

  // Sync i18next language whenever the locale derived from the URL changes
  useEffect(() => {
    if (i18next.language !== locale) {
      i18next.changeLanguage(locale);
    }
  }, [locale]);

  const publishAlternates = useCallback(
    (alts: Partial<Record<Locale, string>> | undefined) => {
      setAlternates(alts ?? {});
    },
    []
  );

  return (
    <LocaleContext.Provider value={{ locale, alternates, publishAlternates }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextValue => {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider>');
  }
  return ctx;
};
