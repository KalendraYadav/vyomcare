import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border p-4 flex items-start gap-3 text-sm', {
  variants: {
    variant: {
      info: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]',
      success: 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]',
      warning: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
      danger: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  className,
  variant = 'info',
  title,
  children,
  onDismiss,
  ...props
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-status-success mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 flex-shrink-0 text-status-pending mt-0.5" />;
      case 'danger':
        return <AlertOctagon className="w-5 h-5 flex-shrink-0 text-status-danger mt-0.5" />;
      default:
        return <Info className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />;
    }
  };

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {getIcon()}
      <div className="flex-1">
        {title && <h5 className="font-semibold text-sm leading-none mb-1">{title}</h5>}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md hover:bg-black/5 transition-colors text-current opacity-70 hover:opacity-100"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
