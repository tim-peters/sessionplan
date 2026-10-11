/**
 * TemplateCategory — Category hub page for templates (e.g. /templates/retrospektive).
 *
 * Role: Thin configuration + card renderer on top of `HubCollection`.
 *       The hub loader (`templateCategoryLoader`) is a thin wrapper around
 *       `createHubLoader('templates')` so we can drop in the same
 *       `{ items, hub, hubs }` shape with no extra mapping.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TemplateSummary } from '@/lib/routeLoaders';
import { HubCollection, type HubCollectionConfig } from '@/components/sections/HubCollection';
import { Button } from '@/components/primitives/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath } from '@/lib/localeUtils';
import { decodeHtmlEntities } from '@/lib/htmlEntities';

const TemplateCategory = () => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();

  const config: HubCollectionConfig<TemplateSummary> = {
    backPath: '/templates',
    backLabel: t('templates.backToTemplates'),
    filterAllLabel: t('templates.allTemplates'),
    filterLabel: t('templates.filterLabel'),
    emptyLabel: t('templates.noTemplates'),
    gridAriaLabel: t('templates.title'),
    breadcrumbs: [{ label: t('templates.title'), path: getLocalizedPath(locale, '/templates') }],
    toSchemaItem: (template) => ({
      url: getLocalizedPath(locale, `/templates/${template.slug}`),
      name: decodeHtmlEntities(template.title),
      description: decodeHtmlEntities(template.excerpt),
      itemType: 'CreativeWork',
    }),
  };

  return (
    <HubCollection
      config={config}
      renderCard={(template) => (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              <Link to={getLocalizedPath(locale, `/templates/${template.slug}`)} className="hover:underline">
                {decodeHtmlEntities(template.title)}
              </Link>
            </CardTitle>
            <CardDescription className="text-base line-clamp-3">
              {decodeHtmlEntities(template.excerpt)}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link to={getLocalizedPath(locale, `/templates/${template.slug}`)}>{t('templates.openTemplate')}</Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    />
  );
};

export default TemplateCategory;
