import * as React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { getErrorMessage } from '@/lib/api';

export interface ErrorStateProps {
  error?: unknown;
  message?: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  message,
  title = 'Failed to load data',
  onRetry,
  className,
}) => {
  const displayMessage = message || (error ? getErrorMessage(error) : 'An unexpected error occurred.');

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border border-status-danger/20 bg-status-danger-bg/50 my-4',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-status-danger-bg flex items-center justify-center text-status-danger mb-3 shadow-xs">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      <p className="text-xs text-neutral-600 max-w-sm mt-1 mb-4 leading-relaxed">
        {displayMessage}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="gap-1.5">
          <RotateCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </Button>
      )}
    </div>
  );
};
