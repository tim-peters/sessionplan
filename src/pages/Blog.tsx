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
import { TemplateHeader } from '@/components/sections/TemplateHeader';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { Button } from '@/components/primitives/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath, getLocaleRoot, createSymmetricAlternates } from '@/lib/localeUtils';

const Blog = () => {
  const { t } = useTranslation('common');
  const blogIndex = useLoaderData() as BlogIndex;
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

  return (
    <>
      <DocumentMeta
        title={t('blog.title')}
        description={t('blog.description')}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={blogAlternates}
      />
      <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <TemplateHeader
          backTo={getLocaleRoot(locale)}
          backLabel={t('nav.backToPlanner')}
          title={t('blog.title')}
          subtitle={t('blog.subtitle')}
          className="max-w-2xl"
        />

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
                          {post.title}
                        </Link>
                      </CardTitle>
                      <CardDescription className="text-sm line-clamp-3">
                        {post.excerpt}
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
        <PageFooter />
      </div>
    </>
  );
};

export default Blog;

