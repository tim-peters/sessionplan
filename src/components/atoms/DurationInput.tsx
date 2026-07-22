import { Input } from '@/components/primitives/input';
import { cn } from '@/lib/utils';
import { ComponentProps } from 'react';

type DurationInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

/**
 * Numeric input for block durations with spinner-removal styles baked in.
 */
export const DurationInput = ({ className, ...props }: DurationInputProps) => (
  <Input
    type="number"
    className={cn(
      'px-1 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]',
      className,
    )}
    {...props}
  />
);
