import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { cn } from '@/lib/utils';

interface LandingPageCardProps {
  to: string;
  title: string;
  description: string;
  className?: string;
}

export const LandingPageCard = ({ to, title, description, className }: LandingPageCardProps) => {
  const { t } = useTranslation('common');

  return (
    <Link
      to={to}
      className={cn('group block p-6 border rounded-lg hover:border-primary hover:shadow-lg transition-all bg-card', className)}
    >
      <h2 className="text-xl font-semibold mb-2 group-hover:text-primary-text transition-colors">
        {decodeHtmlEntities(title)}
      </h2>
      <p className="text-muted-foreground text-sm line-clamp-3">
        {decodeHtmlEntities(description)}
      </p>
      <span className="inline-block mt-4 text-primary-text text-sm font-medium">
        {t('landingPages.learnMore')} →
      </span>
    </Link>
  );
};
