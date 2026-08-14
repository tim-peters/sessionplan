/**
 * BlogArticle — Blog post detail route (/blog/:slug and /en/blog/:slug).
 *
 * Role: Renders a single blog post with full HTML content, author, tags, and
 *       JSON-LD structured data. Content loaded via blogArticleLoader (locale-aware).
 *       Publishes alternate-language URLs so the Language Switcher can navigate correctly.
 */

import { Link, useLoaderData } from 'react-router-dom';
import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BlogPost } from '@/types/blog';
import { PageFooter } from '@/components/layout/PageFooter';
import { DocumentMeta } from '@/hooks/useDocumentMeta';
import { Calendar, User } from 'lucide-react';
import { Badge } from '@/components/primitives/badge';
import { formatDate } from '@/lib/formatDate';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath } from '@/lib/localeUtils';
import { getCanonicalUrl } from '@/lib/metaConfig';

const BlogArticle = () => {
  const { t } = useTranslation('common');
  const post = useLoaderData() as BlogPost;
  const { locale, publishAlternates } = useLocale();

  useLayoutEffect(() => {
    publishAlternates(post.alternates);
  }, [post.alternates, publishAlternates]);

  const canonicalPath = getLocalizedPath(locale, `/blog/${post.slug}`);
  const canonicalUrl = getCanonicalUrl(canonicalPath);

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
    datePublished: post.publishedDate,
    dateModified: post.lastModified || post.publishedDate,
    publisher: {
      '@type': 'Organization',
      name: 'Sessionplan',
      url: 'https://sessionplan.de',
    },
    inLanguage: locale,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.url,
      jobTitle: 'Facilitator & Design Agency Director',
      description: 'Sessionplan helps facilitators structure workshops, meetings, trainings and events with a clear visual agenda.',
    },
  };

  return (
    <>

      <DocumentMeta
        title={decodeHtmlEntities(post.metaTitle || post.title)}
        description={decodeHtmlEntities(post.metaDescription || post.excerpt)}
        canonicalPath={canonicalPath}
        locale={locale}
        alternates={post.alternates}
        ogType="article"
        ogImage={post.ogImage || '/assets/author-tim-j-peters.png'}
        article={{
          publishedTime: post.publishedDate,
          modifiedTime: post.lastModified || post.publishedDate,
          author: post.author.name,
          tags: post.tags,
        }}
        structuredData={structuredData}
      />
      <div className="min-h-screen bg-background">
        <article className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-8">
            <Link to={getLocalizedPath(locale, '/blog')} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
              {t('nav.backToBlog')}
            </Link>
          </div>

          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{decodeHtmlEntities(post.title)}</h1>
            
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
                    src="/assets/author-tim-j-peters.png"
                    alt="Sessionplan"
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

          <footer className="mt-12 pt-8 border-t">
            <Link to={getLocalizedPath(locale, '/blog')} className="text-sm text-muted-foreground hover:text-foreground">
              {t('nav.backToBlog')}
            </Link>
          </footer>
        </article>

        <div className="mx-6 sm:mx-0">
          <PageFooter />
        </div>
      </div>
    </>
  );
};

export default BlogArticle;
