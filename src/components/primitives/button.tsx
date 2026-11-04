import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const layout = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium";

const buttonVariants = cva(
  "ui-button ui-focus transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='h-']):not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: `${layout} bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active`,
        destructive: `${layout} bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-active`,
        outline: `${layout} border border-input bg-background hover:bg-accent active:bg-accent-active hover:text-accent-foreground`,
        secondary: `${layout} bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent-active`,
        ghost: `${layout} hover:bg-accent active:bg-accent-active hover:text-accent-foreground`,
        link: `${layout} text-primary-text underline underline-offset-4 hover:decoration-2 active:text-foreground`,
        // Unstyled layout for compact, composed controls (drag handles,
        // editable previews, sidebar rows). They share focus and states.
        plain: "hover:bg-accent active:bg-accent-active",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        compact: "h-7 px-2 text-xs",
        none: "min-h-6 min-w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
