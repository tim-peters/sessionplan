import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github } from 'lucide-react';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { cn } from '@/lib/utils';
import { ThemeToggleIcon } from '@/modules/sidebar/atoms/ThemeToggle';

const GITHUB_REPO_URL = 'https://github.com/tim-peters/sessionplan';
const GITHUB_REPO_LABEL = 'tim-peters/sessionplan';

interface PageFooterProps {
  /** Optional content (e.g. "Saved to browser") rendered before the links. */
  leadingContent?: ReactNode;
  /** Called with the target path before any link navigation. */
  onBeforeNavigate?: (path: string) => void;
  /** Show the DE / EN language switcher. Default: true. */
  showLanguageSwitcher?: boolean;
  /** Override or extend the outer wrapper's Tailwind classes. */
  className?: string;
}

const footerLinkClass =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';

export const PageFooter = ({
  leadingContent,
  onBeforeNavigate,
  showLanguageSwitcher = true,
  className,
}: PageFooterProps = {}) => {
  const { t } = useTranslation('common');
  const { locale, getTargetUrl } = useLanguageSwitcher();

  const landingPagesPath = locale === 'en' ? '/en/landing-pages' : '/landing-pages';
  const templatesPath = locale === 'en' ? '/en/templates' : '/templates';
  const blogPath = locale === 'en' ? '/en/blog' : '/blog';
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'mt-8 -mx-6 sm:mx-0 border-t bg-muted/30 text-left print:hidden',
        className,
      )}
    >
      <div className="mx-auto max-w-5xl px-6 py-10">
        <nav
          className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3"
          aria-label="Footer"
        >
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('footer.explore')}
            </h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  to={landingPagesPath}
                  onClick={() => onBeforeNavigate?.(landingPagesPath)}
                  className={footerLinkClass}
                >
                  {t('footer.mode')}
                </Link>
              </li>
              <li>
                <Link
                  to={templatesPath}
                  onClick={() => onBeforeNavigate?.(templatesPath)}
                  className={footerLinkClass}
                >
                  {t('footer.templates')}
                </Link>
              </li>
              <li>
                <Link
                  to={blogPath}
                  onClick={() => onBeforeNavigate?.(blogPath)}
                  className={footerLinkClass}
                >
                  {t('footer.blog')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('footer.legal')}
            </h2>
            <ul className="mt-3 space-y-2">
              <li>
                <span className={footerLinkClass}>{t('footer.author')}</span>
              </li>
            </ul>
          </div>
          <div className="col-span-2 sm:col-span-1 flex flex-wrap justify-between gap-2 sm:gap-6 sm:-mt-2">
            <div className="flex items-center gap-1">
              <Link to={getTargetUrl('de')} className={cn('rounded-md px-2.5 py-1 text-sm transition-colors', locale === 'de' ? 'bg-primary font-semibold text-background -ml-1' : 'text-muted-foreground hover:bg-muted hover:text-foreground -ml-2')} aria-current={locale === 'de' ? 'true' : undefined}>DE</Link>
              <Link to={getTargetUrl('en')} className={cn('rounded-md px-2.5 py-1 text-sm transition-colors', locale === 'en' ? 'bg-primary font-semibold text-background mr-2' : 'text-muted-foreground hover:bg-muted hover:text-foreground')} aria-current={locale === 'en' ? 'true' : undefined}>EN</Link>
              |
              <ThemeToggleIcon className="ml-1" />
            </div>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex shrink-0 items-center gap-3 rounded-xl bg-muted px-4 py-3 mt-2 -ml-2 sm:-ml-4 sm:mt-2 sm:shadow-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex sm:h-9 sm:w-9 items-center justify-center sm:rounded-lg sm:bg-black/5 sm:dark:bg-black/15 text-foreground">
                <Github className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-left">
                <span className="block text-sm font-medium text-foreground">
                  {t('footer.openSource')}
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground group-hover:text-foreground/80">
                  {GITHUB_REPO_LABEL}
                </span>
              </span>
            </a>
          </div>
        </nav>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/80 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Sessionplan</p>
          <p>{leadingContent ? leadingContent : t('footer.freeOpenSource')}</p>
        </div>
      </div>
    </footer>
  );
};
