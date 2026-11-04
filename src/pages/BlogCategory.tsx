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
import { useTranslation } from 'react-i18next';
import type { BlogIndexEntry } from '@/lib/routeLoaders';
import { HubCollection, type HubCollectionConfig } from '@/components/sections/HubCollection';
import { BlogPostCard } from '@/components/sections/BlogPostCard';
import { useLocale } from '@/contexts/LocaleContext';
import { getLocalizedPath } from '@/lib/localeUtils';
import { decodeHtmlEntities } from '@/lib/htmlEntities';

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
      renderCard={(post) => <BlogPostCard post={post} />}
    />
  );
};

export default BlogCategory;
