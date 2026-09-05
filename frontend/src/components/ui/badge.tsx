import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle2, Clock, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border select-none',
  {
    variants: {
      variant: {
        success: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
        pending: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
        danger: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
        info: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
        neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px] leading-3',
        md: 'px-2.5 py-0.5 text-xs leading-4',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  withIcon?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size,
  withIcon = false,
  children,
  ...props
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />;
      case 'pending':
        return <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />;
      case 'danger':
        return <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />;
      case 'info':
        return <Info className="w-3 h-3 flex-shrink-0" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {withIcon && getIcon()}
      <span>{children}</span>
    </span>
  );
};
