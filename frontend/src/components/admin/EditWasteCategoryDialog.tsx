'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, getErrorMessage } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WasteCategory } from '@/types/models';
import { Edit, AlertCircle } from 'lucide-react';

const editCategorySchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  colorCode: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex code (e.g. #DC2626)'),
});

type EditCategoryFormData = z.infer<typeof editCategorySchema>;

const PRESET_COLORS = [
  { label: 'Red', color: '#DC2626' },
  { label: 'Yellow', color: '#D97706' },
  { label: 'Blue', color: '#2563EB' },
  { label: 'Purple', color: '#7C3AED' },
  { label: 'Teal', color: '#0D9488' },
  { label: 'Dark Grey', color: '#4B5563' },
];

interface EditWasteCategoryDialogProps {
  category: WasteCategory | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditWasteCategoryDialog: React.FC<EditWasteCategoryDialogProps> = ({
  category,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditCategoryFormData>({
    resolver: zodResolver(editCategorySchema),
    defaultValues: {
      name: '',
      description: '',
      colorCode: '#DC2626',
    },
  });

  const currentColor = watch('colorCode');

  React.useEffect(() => {
    if (category && isOpen) {
      setServerError(null);
      reset({
        name: category.name,
        description: category.description || '',
        colorCode: category.colorCode,
      });
    }
  }, [category, isOpen, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditCategoryFormData) => {
      if (!category) throw new Error('No category selected');
      return categoriesApi.update(category.id, {
        name: data.name.trim(),
        description: data.description ? data.description.trim() : undefined,
        colorCode: data.colorCode.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hub-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-catalog'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setServerError(getErrorMessage(err));
    },
  });

  const onSubmit = (data: EditCategoryFormData) => {
    setServerError(null);
    updateMutation.mutate(data);
  };

  if (!category) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Category: ${category.name}`}
      description={`Update display name, description, and visual color code for code ${category.code}.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
        {serverError && (
          <div className="p-3 bg-status-danger-bg border border-status-danger/20 rounded-lg flex items-center gap-2 text-xs text-status-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Code (Read-Only) */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Category Code (Immutable)
          </label>
          <Input value={category.code} disabled className="bg-neutral-100 font-mono font-semibold" />
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Category Name <span className="text-status-danger">*</span>
          </label>
          <Input
            {...register('name')}
            className={errors.name ? 'border-status-danger' : ''}
          />
          {errors.name && (
            <p className="text-[11px] text-status-danger mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Description & Waste Types
          </label>
          <Input {...register('description')} />
        </div>

        {/* Color Code Picker */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Color Identifier <span className="text-status-danger">*</span>
          </label>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="color"
              value={currentColor || '#DC2626'}
              onChange={(e) => setValue('colorCode', e.target.value)}
              className="w-8 h-8 rounded border border-neutral-300 cursor-pointer p-0"
            />
            <Input
              {...register('colorCode')}
              className={`font-mono uppercase text-xs w-32 ${errors.colorCode ? 'border-status-danger' : ''}`}
            />
            <div
              className="px-2.5 py-1 rounded text-xs font-semibold text-white flex-1 text-center"
              style={{ backgroundColor: currentColor || '#DC2626' }}
            >
              Preview Color
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.color}
                type="button"
                onClick={() => setValue('colorCode', preset.color)}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-200 text-[11px] hover:border-neutral-400 transition-colors"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: preset.color }}
                />
                <span className="text-neutral-700">{preset.label}</span>
              </button>
            ))}
          </div>
          {errors.colorCode && (
            <p className="text-[11px] text-status-danger mt-1">{errors.colorCode.message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            className="gap-1.5"
          >
            <Edit className="w-4 h-4" />
            <span>Save Changes</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
