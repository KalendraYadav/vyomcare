'use client';

import * as React from 'react';
import { AlertType } from '@/types/models';
import { Clock, MapPinOff, NavigationOff, QrCode, AlertTriangle } from 'lucide-react';

interface AlertTypeBadgeProps {
  type: AlertType;
  size?: 'sm' | 'md';
}

export function AlertTypeBadge({ type, size = 'sm' }: AlertTypeBadgeProps) {
  const config = {
    DISPOSAL_DELAY: {
      label: 'SLA Disposal Delay',
      description: 'Exceeded statutory stage duration',
      icon: Clock,
      colorClass: 'text-amber-800 bg-amber-50/80 border-amber-200',
    },
    UNAUTHORIZED_LOCATION: {
      label: 'Unauthorized Location',
      description: 'Vehicle outside permitted boundary',
      icon: MapPinOff,
      colorClass: 'text-red-800 bg-red-50/80 border-red-200',
    },
    ROUTE_DEVIATION: {
      label: 'Corridor Deviation',
      description: 'Deviated from registered transit corridor',
      icon: NavigationOff,
      colorClass: 'text-rose-800 bg-rose-50/80 border-rose-200',
    },
    MISSING_SCAN: {
      label: 'Missing Handover Scan',
      description: 'Custody checkpoint not logged on time',
      icon: QrCode,
      colorClass: 'text-indigo-800 bg-indigo-50/80 border-indigo-200',
    },
  }[type] || {
    label: type.replace(/_/g, ' '),
    description: 'Compliance alert',
    icon: AlertTriangle,
    colorClass: 'text-neutral-800 bg-neutral-50 border-neutral-200',
  };

  const Icon = config.icon;

  return (
    <span
      title={config.description}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border ${
        config.colorClass
      } ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}
    >
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      <span>{config.label}</span>
    </span>
  );
}
