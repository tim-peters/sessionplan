/**
 * Blog — Blog index route (/blog and /en/blog).
 *
 * Role: Lists all blog posts sorted newest-first. Posts are loaded at route
 *       level via blogIndexLoader from public/data/blog/index.json (locale-aware).
 */
import { Link, useLoaderData } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BlogIndex } from '@/types/blog';
import { PageFooter } from '@/components/layout/PageFooter';
import { TemplateHeader } from '@/components/layout/TemplateHeader';
import { HubFilter } from '@/components/atoms/HubFilter';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { Button } from '@/components/primitives/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocaleRoot, getLocalizedPath, createSymmetricAlternates } from '@/lib/localeUtils';
import { getCanonicalUrl, getOrganizationSchema } from '@/lib/metaConfig';
import { createCollectionPageSchema } from '@/lib/collectionStructuredData';
import { buildBreadcrumbList } from '@/lib/breadcrumbStructuredData';
import type { BlogHub } from '@/lib/routeLoaders';

const Blog = () => {
  const { t } = useTranslation('common');
  const blogIndex = useLoaderData() as BlogIndex & { hubs: BlogHub[] };
  const { locale } = useLocale();

  // Sort by date, newest first
  const sortedPosts = useMemo(
    () => [...blogIndex.posts].sort(
      (a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
    ),
    [blogIndex.posts]
  );

  const canonicalPath = getLocalizedPath(locale, '/blog');
  const blogAlternates = createSymmetricAlternates('/blog');
  const structuredData = createCollectionPageSchema({
    url: getCanonicalUrl(canonicalPath),
    name: t('blog.title'),
    description: t('blog.description'),
    locale,
    items: sortedPosts.map((post) => ({
      url: getCanonicalUrl(getLocalizedPath(locale, `/blog/${post.slug}`)),
      name: decodeHtmlEntities(post.title),
      description: decodeHtmlEntities(post.excerpt),
      datePublished: post.publishedDate,
      itemType: 'BlogPosting',
    })),
  });
  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Sessionplan', path: getLocaleRoot(locale) },
    { name: t('blog.title') },
  ]);

  return (
    <>
      <DocumentMeta
        title={t('blog.title')}
        description={t('blog.description')}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={blogAlternates}
        structuredData={[structuredData, getOrganizationSchema(), breadcrumbSchema]}
      />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <TemplateHeader
          title={t('blog.title')}
          subtitle={t('blog.subtitle')}
          breadcrumbs={[{ label: t('blog.title') }]}
          className="max-w-2xl"
        />

        {blogIndex.hubs && blogIndex.hubs.length > 0 && (
          <HubFilter
            hubs={blogIndex.hubs}
            basePath="/blog"
            allLabel={t('blog.allPosts')}
            filterLabel={t('blog.filterLabel')}
          />
        )}

        {sortedPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('blog.noPosts')}</p>
          </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {sortedPosts.map((post) => (
                  <Card key={post.slug} className="group hover:border-primary hover:shadow-lg transition-all">
                    <CardHeader>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="h-4 w-4" />
                        <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
                      </div>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        <Link to={getLocalizedPath(locale, `/blog/${post.slug}`)} className="hover:underline">
                          {decodeHtmlEntities(post.title)}
                        </Link>
                      </CardTitle>
                      <CardDescription className="text-sm line-clamp-3">
                        {decodeHtmlEntities(post.excerpt)}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button asChild variant="outline" className="w-full">
                        <Link to={getLocalizedPath(locale, `/blog/${post.slug}`)}>{t('blog.readArticle')}</Link>
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

export default Blog;
