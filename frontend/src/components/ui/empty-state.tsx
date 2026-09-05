import * as React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  actionHref?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
  actionHref,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 my-4',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3 shadow-xs">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      {description && (
        <p className="text-xs text-neutral-500 max-w-sm mt-1 mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && (
        <>
          {actionHref ? (
            <a href={actionHref}>
              <Button size="sm">{actionLabel}</Button>
            </a>
          ) : onAction ? (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
};
