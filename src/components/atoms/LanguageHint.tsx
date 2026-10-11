/**
 * LanguageHint — Voluntary, dismissible suggestion to view the current page in
 * the other language.
 *
 * Role: Shown only when ALL of the following hold:
 *   a) the browser's primary language mismatches the page locale (DE page +
 *      non-German-preferring browser → EN suggestion, since EN is the
 *      international fallback; EN page + DE-preferring browser → DE
 *      suggestion; regional codes like en-US / de-AT count as en / de),
 *   b) a real translation of the current URL exists (published alternates or a
 *      known static bilingual pair — never the home-page fallback),
 *   c) the visitor has not dismissed the hint for this direction within the
 *      last 30 days, and
 *   d) the visitor has not actively chosen a language this session (an active
 *      choice always beats the browser language), and
 *   e) the current page carries no filled session (>= 1 block) — a locale
 *      switch must never risk losing session content.
 *
 * Presentation: a small toast-like bubble fixed to the bottom-right of the
 * viewport (bottom-left is occupied by the fixed planner sidebar, top corners
 * by header actions). It never redirects, never blocks the reading flow and
 * never opens a modal. Rendered once in RootLayout so it behaves uniformly on
 * every page. Suppressed during prerendering so it never lands in the
 * pre-rendered HTML.
 *
 * Texts live in the locale file of the PAGE language but are written in the
 * language the hint addresses (the browser's preference): the DE file holds
 * the English-facing strings, the EN file the German-facing ones. This is
 * intentional — the hint always speaks the visitor's preferred language.
 *
 * Accessibility: real <button>/<a> elements only, no focus stealing, labelled
 * close action, subtle fade/slide-in that is disabled for reduced motion.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { type Locale } from '@/lib/i18n';
import {
  dismissLanguageHint,
  hasSessionLanguageChoice,
  isLanguageHintDismissed,
  setSessionLanguageChoice,
} from '@/lib/languageHintStorage';
import { isPrerendering } from '@/lib/prerender';
import {
  getWorkshopFromHash,
  hasWorkshopItems,
} from '@/lib/workshopUrl';
import {
  getTempWorkshop,
  TEMP_WORKSHOP_CHANGED_EVENT,
} from '@/lib/workshopLocalStorage';
import { Button } from '@/components/primitives/button';
import { cn } from '@/lib/utils';

/**
 * Returns the suggested locale when the browser's primary language mismatches
 * the page locale, otherwise null. Reads navigator.languages with a fallback
 * to navigator.language; regional codes are reduced to their base language.
 *
 * The EN version is the international fallback: on a DE page, any visitor
 * whose primary language is not German is pointed to the English version.
 * On an EN page (already the international version), only German-preferring
 * visitors are pointed to the German version — suggesting German to e.g.
 * Spanish speakers would not be helpful.
 */
const getMismatchTarget = (locale: Locale): Locale | null => {
  if (typeof navigator === 'undefined') return null;
  const preferred: string[] =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : [];
  if (preferred.length === 0) return null;
  // Only the top-priority language counts: browsers almost always list a
  // secondary fallback (e.g. en-US behind de-DE), which must not trigger the
  // hint. The first entry reflects what the visitor actually prefers.
  const primary = (preferred[0] ?? '').toLowerCase();
  const prefers = (base: Locale) => primary.startsWith(base);
  if (locale === 'de' && !prefers('de')) return 'en';
  if (locale === 'en' && prefers('de')) return 'de';
  return null;
};

/**
 * True when the CURRENT page carries a filled session (>= 1 block) that a
 * locale switch could lose: either the session lives in the URL hash (the
 * hint's <Link> drops the hash) or it is the planner home page relying on the
 * temp save (which the hint's navigation would not mark for restore).
 */
const hasFilledSessionOnPage = (pathname: string): boolean => {
  if (typeof window === 'undefined') return false;
  if (hasWorkshopItems(getWorkshopFromHash())) return true;
  const isPlannerHome = pathname === '/' || pathname === '/en';
  return isPlannerHome && hasWorkshopItems(getTempWorkshop());
};

export const LanguageHint = () => {
  const { locale } = useLocale();
  const { getAlternateUrl } = useLanguageSwitcher();
  const { t, ready } = useTranslation('common');
  const { pathname } = useLocation();

  const target = getMismatchTarget(locale);
  const alternateUrl = target ? getAlternateUrl(target) : null;
  // Direction is labelled browser-language -> page-language (see storage module).
  const direction = target ? `${target}->${locale}` : null;

  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  // Bumped whenever the temp workshop changes so a hint that is already
  // visible hides itself as soon as session content appears (or reappears
  // when it is cleared again).
  const [tempWorkshopVersion, setTempWorkshopVersion] = useState(0);

  useEffect(() => {
    const onTempWorkshopChanged = () => setTempWorkshopVersion((v) => v + 1);
    window.addEventListener(TEMP_WORKSHOP_CHANGED_EVENT, onTempWorkshopChanged);
    return () => window.removeEventListener(TEMP_WORKSHOP_CHANGED_EVENT, onTempWorkshopChanged);
  }, []);

  // Decided in a passive effect so the bubble mounts only after the initial
  // page render — no flicker, no layout shift on first paint.
  useEffect(() => {
    const eligible =
      target !== null &&
      alternateUrl !== null &&
      direction !== null &&
      ready !== false && // page-locale i18n bundle not loaded yet → wait for it
      !isPrerendering() && // never bake the hint into prerendered HTML
      !hasSessionLanguageChoice() && // explicit choice beats browser language
      !isLanguageHintDismissed(direction) && // fresh "stay" decision for this direction
      !hasFilledSessionOnPage(pathname); // never risk losing filled session content
    setVisible(eligible);
  }, [target, alternateUrl, direction, ready, pathname, tempWorkshopVersion]);

  // Subtle slide-up + fade after mount; reduced-motion users get an instant
  // appearance (motion-reduce:transition-none below).
  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible || !target || !alternateUrl || !direction) return null;

  const handleDismiss = () => {
    dismissLanguageHint(direction);
    setVisible(false);
  };

  const handleAccept = () => {
    // Treat the CTA like an explicit switcher choice: it wins over the browser
    // language for the rest of the session.
    setSessionLanguageChoice(target);
  };

  return (
    <section
      role="region"
      aria-label={t('languageHint.regionLabel')}
      className={cn(
        'fixed z-40 rounded-lg border bg-card shadow-lg',
        // Mobile: nearly full width, lifted above the sticky add-buttons row.
        // sm+/lg: compact bubble above the feedback button in the free corner.
        'inset-x-3 bottom-20 lg:inset-x-auto lg:right-4 lg:top-20 lg:bottom-auto lg:w-96',
        'transition-[opacity,translate] duration-200 motion-reduce:transition-none',
        entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}
    >
      <div className="relative p-4">
        <Button
          size="icon"
          variant="ghost"
          aria-label={t('languageHint.close')}
          onClick={handleDismiss}
          className="absolute right-1.5 top-1.5 h-7 w-7 text-muted-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>

        <p className="mb-5 text-sm font-medium text-foreground">
          {t('languageHint.message')}
        </p>
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            {t('languageHint.secondary')}
          </Button>
          <Button asChild size="sm">
            <Link to={alternateUrl} onClick={handleAccept}>
              {t('languageHint.primary')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
