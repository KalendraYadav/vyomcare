'use client';

import * as React from 'react';
import { AlertSeverity } from '@/types/models';
import { AlertOctagon, AlertTriangle, AlertCircle } from 'lucide-react';

interface ViolationSeverityBadgeProps {
  severity: AlertSeverity;
  size?: 'sm' | 'md';
}

export function ViolationSeverityBadge({ severity, size = 'sm' }: ViolationSeverityBadgeProps) {
  const config = {
    HIGH: {
      label: 'HIGH SEVERITY',
      bgClass: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400',
      icon: AlertOctagon,
    },
    MEDIUM: {
      label: 'MEDIUM SEVERITY',
      bgClass: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400',
      icon: AlertTriangle,
    },
    LOW: {
      label: 'LOW SEVERITY',
      bgClass: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400',
      icon: AlertCircle,
    },
  }[severity] || {
    label: severity,
    bgClass: 'bg-neutral-50 border-neutral-200 text-neutral-700',
    icon: AlertCircle,
  };

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-md border ${
        config.bgClass
      } ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
}
