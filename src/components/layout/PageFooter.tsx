import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { LanguageSwitcher } from '@/components/atoms/LanguageSwitcher';
import { ThemeToggleIcon } from '@/modules/sidebar/atoms/ThemeToggle';
import { cn } from '@/lib/utils';

export interface PageFooterProps {
  leadingContent?: ReactNode;
  onBeforeNavigate?: (path: string) => void;
  showLanguageSwitcher?: boolean;
  className?: string;
}
export function PageFooter({ leadingContent, onBeforeNavigate, showLanguageSwitcher = true, className }: PageFooterProps = {}) {
  const { t } = useTranslation('common');
  const { locale, getTargetUrl } = useLanguageSwitcher();
  const prefix = locale === 'en' ? '/en' : '';
  return (
    <footer className={cn('mt-8 border-t px-6 py-8 text-sm text-muted-foreground print:hidden', className)}>
      <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
        {['landing-pages', 'templates', 'blog'].map((route, index) => (
          <Link key={route} to={`${prefix}/${route}`} onClick={() => onBeforeNavigate?.(`${prefix}/${route}`)}>
            {t(['footer.mode', 'footer.templates', 'footer.blog'][index])}
          </Link>
        ))}
        {showLanguageSwitcher && <LanguageSwitcher locale={locale} getTargetUrl={getTargetUrl} variant="footer" />}
        <ThemeToggleIcon />
      </nav>
      <p className="mt-4">{leadingContent ?? t('footer.freeOpenSource')}</p>
    </footer>
  );
}
