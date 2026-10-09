import { Link } from 'react-router-dom';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/primitives/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/primitives/breadcrumb';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from 'react-i18next';
import { getLocaleRoot } from '@/lib/localeUtils';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { LanguageSwitcher } from '@/components/atoms/LanguageSwitcher';

interface TemplateHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs: Array<{ label: string; path?: string }>;
  className?: string;
  showLanguageSwitcher?: boolean;
}

/**
 * Shared header for text pages — logo, breadcrumb, title and subtitle.
 */
export const TemplateHeader = ({
  title,
  subtitle,
  breadcrumbs,
  className,
  showLanguageSwitcher = true,
}: TemplateHeaderProps) => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const { getTargetUrl } = useLanguageSwitcher();
  const rootPath = getLocaleRoot(locale);

  return (
    <header className="mb-12">
      <div className="mb-8 flex items-center justify-between gap-4 border-b pb-4">
        <Link to={rootPath} className="inline-flex items-center gap-2 font-semibold hover:opacity-80">
          <img src="/pwa/favicon.svg" alt="Sessionplan Logo" className="h-7 w-7" aria-hidden="true" />
          <span>Sessionplan</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to={rootPath}>{t('nav.toTool')}</Link>
          </Button>
          {showLanguageSwitcher && (
            <LanguageSwitcher locale={locale} getTargetUrl={getTargetUrl} variant="header" />
          )}
        </div>
      </div>

      <Breadcrumb className="mb-5">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={rootPath}>Sessionplan</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbs.map((breadcrumb, index) => (
            <Fragment key={`${breadcrumb.label}-${index}`}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {breadcrumb.path ? (
                  <BreadcrumbLink asChild>
                    <Link to={breadcrumb.path}>{breadcrumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-4 text-4xl font-bold [overflow-wrap:anywhere] [hyphens:auto]">{title}</h1>
      {subtitle && <p className={cn('text-lg text-muted-foreground', className)}>{subtitle}</p>}
    </header>
  );
};
