import { Link, type LinkProps } from 'react-router-dom';
import { Card } from '@/components/primitives/card';
import { cn } from '@/lib/utils';

/** A navigational card has one target, including its non-interactive CTA. */
export const NavigationCard = ({ children, className, ...props }: LinkProps) => (
  <Link {...props} className={cn('navigation-card ui-focus group block h-full rounded-lg', className)}>
    <Card className="flex h-full flex-col transition-colors group-hover:border-primary group-focus-visible:border-primary group-active:bg-accent/40">
      {children}
    </Card>
  </Link>
);
