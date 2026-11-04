import { Button } from '@/components/primitives/button';
import { getInitials } from '@/lib/people';
import { cn } from '@/lib/utils';
import { getContrastingTextColor } from '@/lib/color-contrast';

interface PersonAvatarProps {
  name: string;
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  dimmed?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PersonAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export const PersonAvatar = ({
  name,
  color,
  size = 'sm',
  selected = false,
  dimmed = false,
  onClick,
  title,
  className,
}: PersonAvatarProps) => {
  const baseClasses = cn(
    'rounded-full flex items-center justify-center font-medium shrink-0',
    SIZE_CLASSES[size],
  );

  const styleProps = { backgroundColor: color, color: getContrastingTextColor(color) };

  if (onClick) {
    return (
      <Button variant="plain" size="none"
        onClick={onClick}
        title={title ?? name}
        aria-pressed={selected}
        className={cn(
          baseClasses,
          'transition-all',
          selected
            ? 'selection-outline'
            : dimmed
              ? 'outline outline-1 outline-dashed outline-muted-foreground hover:outline-2'
              : 'hover:outline hover:outline-2 hover:outline-muted-foreground',
          className,
        )}
        style={styleProps}
      >
        {getInitials(name)}
      </Button>
    );
  }

  return (
    <div
      title={title ?? name}
      className={cn(baseClasses, className)}
      style={styleProps}
    >
      {getInitials(name)}
    </div>
  );
};
