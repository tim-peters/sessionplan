import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** A single keyboard key, drawn as a small keycap. */
export const Kbd = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-5 items-center justify-center whitespace-nowrap rounded border bg-muted px-1.5 font-sans text-xs font-medium leading-none text-foreground',
      className,
    )}
    {...props}
  />
);
