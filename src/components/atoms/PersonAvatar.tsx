import { getInitials } from '@/lib/people';
import { cn } from '@/lib/utils';

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
    'rounded-full flex items-center justify-center font-medium text-white shrink-0',
    SIZE_CLASSES[size],
  );

  const styleProps = { backgroundColor: color };

  if (onClick) {
    return (
      <button
        onClick={onClick}
        title={title ?? name}
        className={cn(
          baseClasses,
          'transition-all',
          selected
            ? 'ring-2 ring-offset-1 ring-primary scale-110 mx-1'
            : dimmed
              ? 'opacity-40 hover:opacity-70'
              : 'hover:opacity-80',
          className,
        )}
        style={styleProps}
      >
        {getInitials(name)}
      </button>
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
