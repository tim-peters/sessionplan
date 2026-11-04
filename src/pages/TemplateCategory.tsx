/**
 * TemplateCategory — Category hub page for templates (e.g. /templates/retrospektive).
 *
 * Role: Thin configuration + card renderer on top of `HubCollection`.
 *       The hub loader (`templateCategoryLoader`) is a thin wrapper around
 *       `createHubLoader('templates')` so we can drop in the same
 *       `{ items, hub, hubs }` shape with no extra mapping.
 */
import { useTranslation } from 'react-i18next';
import type { TemplateSummary } from '@/lib/routeLoaders';
import { HubCollection, type HubCollectionConfig } from '@/components/sections/HubCollection';
import { TemplateCard } from '@/components/sections/TemplateCard';
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
      renderCard={(template) => <TemplateCard template={template} />}
    />
  );
};

export default TemplateCategory;
