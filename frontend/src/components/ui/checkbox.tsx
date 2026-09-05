import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, checked, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'flex items-start gap-3 cursor-pointer select-none group',
          props.disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            id={checkboxId}
            ref={ref}
            type="checkbox"
            checked={checked}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'w-4 h-4 rounded border border-neutral-300 bg-white transition-all',
              'peer-checked:bg-primary peer-checked:border-primary',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-1',
              'group-hover:border-primary',
            )}
          >
            <Check
              className={cn(
                'w-3 h-3 text-white transition-opacity stroke-[3]',
                checked ? 'opacity-100' : 'opacity-0 peer-checked:opacity-100',
              )}
            />
          </div>
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className="text-sm font-medium text-neutral-800 leading-tight">
                {label}
              </span>
            )}
            {description && (
              <span className="text-xs text-neutral-500 mt-0.5">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
