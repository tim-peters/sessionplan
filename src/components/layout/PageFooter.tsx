import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { cn } from '@/lib/utils';

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

  return (
    <div className={cn('max-w-4xl mx-auto px-6 pb-12 text-center border-t mt-8 pt-8', className)}>
      {leadingContent && (
        <span className="block sm:inline text-xs text-muted-foreground sm:mr-4 mb-2 sm:mb-0">{leadingContent}</span>
      )}
      <Link
        to={landingPagesPath}
        onClick={() => onBeforeNavigate?.(landingPagesPath)}
        className="text-sm text-muted-foreground hover:text-foreground mr-4"
      >
        {t('footer.mode')}
      </Link>
      <Link
        to={templatesPath}
        onClick={() => onBeforeNavigate?.(templatesPath)}
        className="text-sm text-muted-foreground hover:text-foreground mr-4"
      >
        {t('footer.templates')}
      </Link>
      <Link
        to={blogPath}
        onClick={() => onBeforeNavigate?.(blogPath)}
        className="text-sm text-muted-foreground hover:text-foreground mr-4"
      >
        {t('footer.blog')}
      </Link>
      {showLanguageSwitcher && (
        <>
          <span className="text-sm text-muted-foreground">|</span>
          <Link
            to={getTargetUrl('de')}
            className={cn('text-sm ml-4 mr-1', locale === 'de' ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            DE
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <Link
            to={getTargetUrl('en')}
            className={cn('text-sm ml-1', locale === 'en' ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            EN
          </Link>
        </>
      )}
    </div>
  );
};

