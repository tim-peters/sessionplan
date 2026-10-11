import { CSSProperties, PointerEvent, forwardRef } from 'react';
import { Bold, Italic, Link, type LucideIcon } from 'lucide-react';
import type { FormatKind } from '@/lib/textFormatting';
import { cn } from '@/lib/utils';

interface FormattingToolbarProps {
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  linkDisabled?: boolean;
  /** Formatting kinds active at the caret/selection. A button renders pressed
   *  (aria-pressed + primary tint) when its kind is in the array — for
   *  nested content like `*_hello_*` both bold and italic are pressed at
   *  once, and clicking either toggles that single layer off. */
  active?: FormatKind[];
  size?: 'xs' | 'sm';
  className?: string;
  style?: CSSProperties;
  /** Pass-through for hover-freeze tracking from the parent. */
  onPointerEnter?: (e: PointerEvent<HTMLDivElement>) => void;
  /** Pass-through for hover-freeze tracking from the parent. */
  onPointerLeave?: (e: PointerEvent<HTMLDivElement>) => void;
}

const ICON_SIZE: Record<NonNullable<FormattingToolbarProps['size']>, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
};

interface ToolEntry {
  kind: FormatKind;
  title: string;
  Icon: LucideIcon;
  /** True for the link button only — disabled when there's neither a selection
   *  to wrap with `[text](url)` nor an active link to toggle off. */
  useLinkDisabled: boolean;
}

// Module-local button table. Kept in source order (bold → italic → link) so
// the rendered DOM and accessibility tree are byte-identical to the previous
// hand-written buttons.
const TOOLS: ToolEntry[] = [
  {
    kind: 'bold',
    title: 'Fett (Strg/Cmd+B)',
    Icon: Bold,
    useLinkDisabled: false,
  },
  {
    kind: 'italic',
    title: 'Kursiv (Strg/Cmd+I)',
    Icon: Italic,
    useLinkDisabled: false,
  },
  {
    kind: 'link',
    title: 'Link einfügen (Strg/Cmd+K)',
    Icon: Link,
    useLinkDisabled: true,
  },
];

export const FormattingToolbar = forwardRef<HTMLDivElement, FormattingToolbarProps>(
  (
    {
      onBold,
      onItalic,
      onLink,
      linkDisabled = false,
      active = [],
      size = 'sm',
      className,
      style,
      onPointerEnter,
      onPointerLeave,
    },
    ref,
  ) => {
    const iconClass = ICON_SIZE[size];
    const buttonClass =
      'p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent';
    const activeButtonClass = cn(buttonClass, 'bg-primary/10 text-primary hover:text-primary');

    const isActive = (kind: FormatKind) => active.includes(kind);

    const actionByKind: Record<FormatKind, () => void> = {
      bold: onBold,
      italic: onItalic,
      link: onLink,
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-0.5', className)}
        style={style}
        // Prevent the mousedown/pointerdown default of moving focus onto the
        // toolbar — that would collapse the textarea's selection and hide the
        // toolbar mid-interaction. Pointerdown is the spec-preferred hook;
        // mousedown stays as a fallback for environments where pointer
        // events aren't fully wired (older browsers, some assistive tech).
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {TOOLS.map(({ kind, title, Icon, useLinkDisabled }) => {
          const buttonActive = isActive(kind);
          const disabled = useLinkDisabled && linkDisabled;
          return (
            <button
              key={kind}
              type="button"
              title={title}
              aria-pressed={buttonActive}
              onClick={(e) => {
                e.stopPropagation();
                actionByKind[kind]();
              }}
              disabled={disabled}
              className={buttonActive ? activeButtonClass : buttonClass}
            >
              <Icon className={iconClass} />
            </button>
          );
        })}
      </div>
    );
  },
);

FormattingToolbar.displayName = 'FormattingToolbar';
