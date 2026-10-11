/**
 * BlogCategory — Category hub page for blog posts (e.g. /blog/workshop-methoden).
 *
 * Role: Thin configuration + card renderer on top of `HubCollection`. The hub
 *       loader (`blogCategoryLoader`) is a thin wrapper around
 *       `createHubLoader('blog')` so we get the same `{ items, hub, hubs }`
 *       shape; this page maps `items` to the `posts` field HubCollection iterates.
 *
 *       Blog cards mirror the style of `Blog.tsx` (date pill, title, excerpt,
 *       "Read article" CTA). Ordering is newest-first because `build_blog_index`
 *       already sorts the blog index by `publishedDate` DESC, and
 *       `resolveBlogItems` iterates that index in order.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import type { BlogIndexEntry, BlogHub } from '@/lib/routeLoaders';
import { HubCollection, type HubCollectionConfig } from '@/components/sections/HubCollection';
import { Button } from '@/components/primitives/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath } from '@/lib/localeUtils';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { formatDate } from '@/lib/formatDate';

const BlogCategory = () => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();

  const config: HubCollectionConfig<BlogIndexEntry> = {
    backPath: '/blog',
    backLabel: t('blog.backToBlog'),
    filterAllLabel: t('blog.allPosts'),
    filterLabel: t('blog.filterLabel'),
    emptyLabel: t('blog.noPosts'),
    gridAriaLabel: t('blog.title'),
    breadcrumbs: [{ label: t('blog.title'), path: getLocalizedPath(locale, '/blog') }],
    toSchemaItem: (post) => ({
      url: getLocalizedPath(locale, `/blog/${post.slug}`),
      name: decodeHtmlEntities(post.title),
      description: decodeHtmlEntities(post.excerpt),
      datePublished: post.publishedDate,
      itemType: 'BlogPosting',
    }),
  };

  return (
    <HubCollection<BlogIndexEntry>
      config={config}
      renderCard={(post) => (
        <Card className="group hover:border-primary hover:shadow-lg transition-all h-full">
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
      )}
    />
  );
};

export type { BlogHub };

export default BlogCategory;
