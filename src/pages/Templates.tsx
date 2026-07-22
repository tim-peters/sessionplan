/**
 * Templates — Template index route (/templates and /en/templates).
 *
 * Role: Lists all template landing pages; entry point to the template gallery.
 *       Content loaded via templatesIndexLoader from public/data/templates/index.json (locale-aware).
 */
import { Link, useLoaderData } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TemplateSummary } from '@/lib/routeLoaders';
import { PageFooter } from '@/components/layout/PageFooter';
import { TemplateHeader } from '@/components/sections/TemplateHeader';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { Button } from '@/components/primitives/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath, getLocaleRoot, createSymmetricAlternates } from '@/lib/localeUtils';

const Templates = () => {
  const { t } = useTranslation('common');
  const { templates } = useLoaderData() as { templates: TemplateSummary[] };
  const { locale } = useLocale();

  const canonicalPath = getLocalizedPath(locale, '/templates');
  const templatesAlternates = createSymmetricAlternates('/templates');

  return (
    <>
      <DocumentMeta
        title={t('templates.title')}
        description={t('templates.description')}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={templatesAlternates}
      />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TemplateHeader
            backTo={getLocaleRoot(locale)}
            backLabel={t('nav.backToPlanner')}
            title={t('templates.title')}
            subtitle={t('templates.subtitle')}
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
                        {template.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-base line-clamp-3">
                      {template.excerpt}
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

          <PageFooter />
        </div>
      </div>
    </>
  );
};

export default Templates;

