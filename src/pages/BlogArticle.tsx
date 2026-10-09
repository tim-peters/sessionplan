/**
 * BlogArticle — Blog post detail route (/blog/:slug and /en/blog/:slug).
 *
 * Role: Renders a single blog post with full HTML content, author, tags, and
 *       JSON-LD structured data. Content loaded via blogArticleLoader (locale-aware).
 *       Publishes alternate-language URLs so the Language Switcher can navigate correctly.
 */

import { useLoaderData, Link } from 'react-router-dom';
import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useArticleIntegration, articleAuthorMetadata, authorImage } from '@/integrations/site';
import { BlogPost } from '@/types/blog';
import type { BlogHub } from '@/lib/routeLoaders';
import { PageFooter } from '@/components/layout/PageFooter';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { Calendar, User } from 'lucide-react';
import { Badge } from '@/components/primitives/badge';
import { formatDate } from '@/lib/formatDate';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocaleRoot, getLocalizedPath } from '@/lib/localeUtils';
import { getAbsoluteImageUrl, getCanonicalUrl, getOrganizationSchema, ORGANIZATION_ID } from '@/lib/metaConfig';
import { buildBreadcrumbList } from '@/lib/breadcrumbStructuredData';
import { TemplateHeader } from '@/components/layout/TemplateHeader';

const BlogArticle = () => {
  const { t } = useTranslation('common');
  const post = useLoaderData() as BlogPost & { hub?: BlogHub };
  const { locale, publishAlternates } = useLocale();

  useLayoutEffect(() => {
    publishAlternates(post.alternates);
  }, [post.alternates, publishAlternates]);

  useArticleIntegration(post.slug);

  const canonicalPath = getLocalizedPath(locale, `/blog/${post.slug}`);
  const canonicalUrl = getCanonicalUrl(canonicalPath);
  const imageUrl = getAbsoluteImageUrl(post.ogImage || authorImage);

  const structuredData = post.structuredData || {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    headline: decodeHtmlEntities(post.title),
    description: decodeHtmlEntities(post.metaDescription || post.excerpt),
    image: imageUrl,
    datePublished: post.publishedDate,
    dateModified: post.lastModified || post.publishedDate,
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: locale,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.url,
      ...articleAuthorMetadata,
    },
  };

  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Sessionplan', path: getLocaleRoot(locale) },
    { name: t('blog.title'), path: getLocalizedPath(locale, '/blog') },
    { name: decodeHtmlEntities(post.title) },
  ]);

  const structuredDataArray = post.structuredData
    ? [structuredData, breadcrumbSchema]
    : [structuredData, getOrganizationSchema(), breadcrumbSchema];

  return (
    <>

      <DocumentMeta
        title={decodeHtmlEntities(post.metaTitle || post.title)}
        description={decodeHtmlEntities(post.metaDescription || post.excerpt)}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={post.alternates}
        ogType="article"
        ogImage={imageUrl}
        article={{
          publishedTime: post.publishedDate,
          modifiedTime: post.lastModified || post.publishedDate,
          author: post.author.name,
          tags: post.tags,
        }}
        structuredData={structuredDataArray}
      />
      <div className="min-h-screen bg-background">
        <article className="max-w-3xl mx-auto px-6 py-12">
          <TemplateHeader
            title={decodeHtmlEntities(post.title)}
            breadcrumbs={[
              { label: t('blog.title'), path: getLocalizedPath(locale, '/blog') },
              { label: decodeHtmlEntities(post.title) },
            ]}
          />

          <header className="mb-8">
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
              </div>
              {post.author && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {post.author.url ? (
                    <a href={post.author.url} className="hover:underline" target="_blank" rel="noopener noreferrer">
                      {post.author.name}
                    </a>
                  ) : (
                    <span>{post.author.name}</span>
                  )}
                </div>
              )}
            </div>

            {post.hub && (
              <div className="mb-3">
                <Link
                  to={getLocalizedPath(locale, `/blog/${post.hub.slug}`)}
                  className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  {t('blog.moreOnTopic', { hub: post.hub.shortLabel ?? post.hub.title })} →
                </Link>
              </div>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </header>

          <div
            className="prose prose-md prose-gray dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Author Box */}
          {post.author && (
            <div className="mt-12 mb-12 p-6 bg-muted/30 rounded-lg border border-border">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 hidden sm:block">
                  <img 
                    src={authorImage}
                    alt={post.author.name}
                    className="max-w-48 md:max-w-xs border-2 border-primary/20"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    {t('author.about')}
                  </div>
                  <h3 className="text-xl font-bold mb-3">
                    {post.author.url ? (
                      <a 
                        href={post.author.url} 
                        className="text-foreground hover:text-primary transition-colors"
                        target="_blank" 
                        rel="noopener noreferrer author"
                      >
                        {post.author.name}
                      </a>
                    ) : (
                      <span className="text-foreground">{post.author.name}</span>
                    )}
                  </h3>
                  <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>
                      {t('author.bio1')}
                    </p>
                    <p>
                      {t('author.bio2')}
                    </p>
                    {post.author.url && (
                      <p className="pt-2">
                        <a 
                          href={post.author.url}
                          className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('author.learnMore')}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </article>

        <div className="mx-6 md:mx-0">
          <PageFooter />
        </div>
      </div>
    </>
  );
};

export default BlogArticle;
