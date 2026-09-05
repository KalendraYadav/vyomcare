import * as React from 'react';
import { Scissors, AlertCircle, Activity, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WasteCategory } from '@/types/models';

export interface CategoryBadgeProps {
  category?: WasteCategory | { code?: string; name?: string; colorCode?: string } | null;
  code?: string;
  name?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  code: directCode,
  name: directName,
  className,
  size = 'md',
}) => {
  const code = (directCode || category?.code || '').toUpperCase();
  const name = directName || category?.name || code;

  // CPCB Statutory Palettes (design.md §11.4)
  let bg = '#EFF6FF';
  let text = '#2563EB';
  let border = '#BFDBFE';
  let Icon = Package;

  if (code.includes('SHARP') || code === 'RED') {
    bg = '#FEF2F2';
    text = '#DC2626';
    border = '#FECACA';
    Icon = Scissors;
  } else if (code.includes('INFECT') || code === 'YELLOW') {
    bg = '#FFFBEB';
    text = '#D97706';
    border = '#FDE68A';
    Icon = AlertCircle;
  } else if (code.includes('PATHO') || code === 'BLUE' || code === 'PURPLE') {
    bg = '#F5F3FF';
    text = '#7C3AED';
    border = '#DDD6FE';
    Icon = Activity;
  } else if (code.includes('GEN') || code === 'WHITE') {
    bg = '#EFF6FF';
    text = '#2563EB';
    border = '#BFDBFE';
    Icon = Package;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
    lg: 'text-sm px-3 py-1 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-md border select-none',
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundColor: category?.colorCode ? `${category.colorCode}15` : bg,
        color: category?.colorCode || text,
        borderColor: category?.colorCode ? `${category.colorCode}30` : border,
      }}
    >
      <Icon className={cn(iconSizes[size], 'flex-shrink-0')} />
      <span>{name}</span>
    </span>
  );
};
