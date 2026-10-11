import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { setSessionLanguageChoice } from '@/lib/languageHintStorage';

type LanguageSwitcherVariant = 'sidebar' | 'header' | 'footer' | 'collapsed';

interface LanguageSwitcherProps {
  locale: Locale;
  getTargetUrl: (target: Locale) => string;
  variant?: LanguageSwitcherVariant;
}

const variantStyles: Record<
  Exclude<LanguageSwitcherVariant, 'collapsed'>,
  { container: string; option: string; active: string; inactive: string }
> = {
  sidebar: {
    container: 'flex items-center gap-1 px-3 border-l shrink-0',
    option: 'px-2 py-0.5 rounded text-xs font-medium transition-colors',
    active: 'bg-primary text-primary-foreground',
    inactive: 'hover:bg-muted',
  },
  header: {
    container: 'flex items-center gap-1 pl-3',
    option: 'rounded px-2 py-0.5 text-xs font-medium transition-colors',
    active: 'bg-primary text-primary-foreground',
    inactive: 'hover:bg-muted',
  },
  footer: {
    container: 'flex items-center gap-1',
    option: 'rounded px-2 py-0.5 text-xs transition-colors',
    active: 'bg-primary font-semibold text-background',
    inactive: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  },
};

/** Shared DE/EN navigation used by the sidebar, content headers and footer. */
export const LanguageSwitcher = ({
  locale,
  getTargetUrl,
  variant = 'header',
}: LanguageSwitcherProps) => {
  const { t } = useTranslation('common');

  if (variant === 'collapsed') {
    const targetLocale = locale === 'de' ? 'en' : 'de';
    return (
      <Link
        to={getTargetUrl(targetLocale)}
        onClick={() => setSessionLanguageChoice(targetLocale)}
        className="icon-button text-xs font-semibold"
        title={locale === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
      >
        {locale.toUpperCase()}
      </Link>
    );
  }

  const styles = variantStyles[variant];

  return (
    <div className={styles.container} aria-label={t('footer.language')}>
      {(['de', 'en'] as Locale[]).map((targetLocale) => (
        <Link
          key={targetLocale}
          to={getTargetUrl(targetLocale)}
          onClick={() => setSessionLanguageChoice(targetLocale)}
          className={cn(
            styles.option,
            locale === targetLocale
              ? styles.active
              : styles.inactive,
          )}
          aria-current={locale === targetLocale ? 'true' : undefined}
        >
          {targetLocale.toUpperCase()}
        </Link>
      ))}
    </div>
  );
};
