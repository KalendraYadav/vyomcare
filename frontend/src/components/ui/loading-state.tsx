import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className,
  size = 'md',
}) => {
  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center text-neutral-500 gap-2.5',
        className,
      )}
    >
      <Loader2 className={cn('animate-spin text-primary', spinnerSizes[size])} />
      {message && <p className="text-xs font-medium text-neutral-500">{message}</p>}
    </div>
  );
};
