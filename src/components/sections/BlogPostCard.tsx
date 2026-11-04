import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { NavigationCard } from '@/components/atoms/NavigationCard';
import { buttonVariants } from '@/components/primitives/button';
import { CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/primitives/card';
import { useLocale } from '@/contexts/LocaleContext';
import { formatDate } from '@/lib/formatDate';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { getLocalizedPath } from '@/lib/localeUtils';
import type { BlogIndexEntry } from '@/lib/routeLoaders';

export const BlogPostCard = ({ post }: { post: BlogIndexEntry }) => {
  const { t } = useTranslation('common');
  const { locale } = useLocale();

  return (
    <NavigationCard to={getLocalizedPath(locale, `/blog/${post.slug}`)} aria-label={decodeHtmlEntities(post.title)}>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Calendar className="h-4 w-4" />
          <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
        </div>
        <CardTitle className="text-xl group-hover:text-primary-text group-focus-visible:text-primary-text transition-colors">
          {decodeHtmlEntities(post.title)}
        </CardTitle>
        <CardDescription className="text-sm line-clamp-3">
          {decodeHtmlEntities(post.excerpt)}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto">
        <span className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
          {t('blog.readArticle')}
        </span>
      </CardFooter>
    </NavigationCard>
  );
};
