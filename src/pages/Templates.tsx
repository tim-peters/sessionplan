/**
 * Templates — Template index route (/templates and /en/templates).
 *
 * Role: Lists all template landing pages; entry point to the template gallery.
 *       Content loaded via templatesIndexLoader from public/data/templates/index.json (locale-aware).
 */
import { Link, useLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TemplateHub, TemplateSummary } from '@/lib/routeLoaders';
import { PageFooter } from '@/components/layout/PageFooter';
import { TemplateHeader } from '@/components/layout/TemplateHeader';
import { HubFilter } from '@/components/atoms/HubFilter';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { Button } from '@/components/primitives/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocaleRoot, getLocalizedPath, createSymmetricAlternates } from '@/lib/localeUtils';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { getCanonicalUrl, getOrganizationSchema } from '@/lib/metaConfig';
import { createCollectionPageSchema } from '@/lib/collectionStructuredData';
import { buildBreadcrumbList } from '@/lib/breadcrumbStructuredData';

const Templates = () => {
  const { t } = useTranslation('common');
  const { templates, hubs } = useLoaderData() as { templates: TemplateSummary[]; hubs: TemplateHub[] };
  const { locale } = useLocale();

  const canonicalPath = getLocalizedPath(locale, '/templates');
  const templatesAlternates = createSymmetricAlternates('/templates');
  const structuredData = createCollectionPageSchema({
    url: getCanonicalUrl(canonicalPath),
    name: t('templates.title'),
    description: t('templates.description'),
    locale,
    items: (templates ?? []).map((template) => ({
      url: getCanonicalUrl(getLocalizedPath(locale, `/templates/${template.slug}`)),
      name: decodeHtmlEntities(template.title),
      description: decodeHtmlEntities(template.excerpt),
      itemType: 'CreativeWork',
    })),
  });
  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Sessionplan', path: getLocaleRoot(locale) },
    { name: t('templates.title') },
  ]);

  return (
    <>
      <DocumentMeta
        title={t('templates.title')}
        description={t('templates.description')}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={templatesAlternates}
        structuredData={[structuredData, getOrganizationSchema(), breadcrumbSchema]}
      />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TemplateHeader
            title={t('templates.title')}
            subtitle={t('templates.subtitle')}
            breadcrumbs={[{ label: t('templates.title') }]}
          />

          <HubFilter
            hubs={hubs}
            basePath="/templates"
            allLabel={t('templates.allTemplates')}
            filterLabel={t('templates.filterLabel')}
          />

          {!templates || templates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('templates.noTemplates')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {templates.map((template) => (
                <Card key={template.slug}>
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
              ))}
            </div>
          )}

        </div>
        <div className="mx-6 md:mx-0">
          <PageFooter />
        </div>
      </div>
    </>
  );
};

export default Templates;
