import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
        secondary: 'bg-white text-neutral-700 border border-border hover:bg-neutral-50 shadow-sm',
        danger: 'bg-status-danger text-white hover:bg-red-700 shadow-sm',
        ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        outline: 'border border-primary text-primary hover:bg-primary-subtle',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 py-2',
        lg: 'h-11 px-6 text-base',
        touch: 'h-12 px-6 text-base font-semibold', // Minimum 48px touch target on mobile (design.md §6.4 & §12)
        fab: 'h-14 w-14 rounded-full p-0 shadow-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
