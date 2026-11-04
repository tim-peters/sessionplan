import { useTranslation } from 'react-i18next';
import { NavigationCard } from '@/components/atoms/NavigationCard';
import { buttonVariants } from '@/components/primitives/button';
import { CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { useLocale } from '@/contexts/LocaleContext';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { getLocalizedPath } from '@/lib/localeUtils';
import type { TemplateSummary } from '@/lib/routeLoaders';

export const TemplateCard = ({ template }: { template: TemplateSummary }) => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();

  return (
    <NavigationCard to={getLocalizedPath(locale, `/templates/${template.slug}`)} aria-label={decodeHtmlEntities(template.title)}>
      <CardHeader>
        <CardTitle className="text-xl group-hover:text-primary-text group-focus-visible:text-primary-text transition-colors">
          {decodeHtmlEntities(template.title)}
        </CardTitle>
        <CardDescription className="text-base line-clamp-3">
          {decodeHtmlEntities(template.excerpt)}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto">
        <span className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
          {t('templates.openTemplate')}
        </span>
      </CardFooter>
    </NavigationCard>
  );
};
