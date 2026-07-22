import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface TemplateHeaderProps {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle: string;
  className?: string;
}

/**
 * Shared page header — back link, title, subtitle.
 * Used by Blog, Templates, LandingPages.
 */
export const TemplateHeader = ({ backTo, backLabel, title, subtitle, className }: TemplateHeaderProps) => (
  <div className="mb-12">
    <Link to={backTo} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
      {backLabel}
    </Link>
    <h1 className="text-4xl font-bold mb-4">{title}</h1>
    <p className={cn('text-lg text-muted-foreground', className)}>
      {subtitle}
    </p>
  </div>
);
