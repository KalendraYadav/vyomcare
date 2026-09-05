import * as React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  subtitle?: string;
  className?: string;
  onClick?: () => void;
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  subtitle,
  className,
  onClick,
  accentColor,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-all',
        onClick && 'cursor-pointer hover:border-primary/50 hover:shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </p>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-primary bg-primary-subtle"
            style={accentColor ? { color: accentColor, backgroundColor: `${accentColor}15` } : undefined}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-neutral-900">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center text-xs font-semibold',
              trend.isPositive ? 'text-status-success' : 'text-status-danger',
            )}
          >
            {trend.isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            <span>{trend.value}</span>
          </span>
        )}
      </div>

      {(subtitle || trend?.label) && (
        <p className="text-xs text-neutral-500 mt-1">
          {subtitle || trend?.label}
        </p>
      )}
    </div>
  );
};
