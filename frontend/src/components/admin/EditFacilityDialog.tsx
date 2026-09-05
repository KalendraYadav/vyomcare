'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi, categoriesApi, getErrorMessage } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Facility } from '@/types/models';
import { AlertCircle, Check, Edit } from 'lucide-react';
import { CategoryBadge } from '@/components/shared/CategoryBadge';

const editFacilitySchema = z.object({
  address: z.string().min(5, 'Physical address is required'),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
  geofenceRadiusM: z.number().min(50).max(10000, 'Geofence radius must be 50-10,000 meters'),
  authorizedCategoryIds: z.array(z.string()),
});

type EditFacilityFormData = z.infer<typeof editFacilitySchema>;

interface EditFacilityDialogProps {
  facility: Facility | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditFacilityDialog: React.FC<EditFacilityDialogProps> = ({
  facility,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['active-categories-selection'],
    queryFn: () => categoriesApi.list(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditFacilityFormData>({
    resolver: zodResolver(editFacilitySchema),
    defaultValues: {
      address: '',
      latitude: 0,
      longitude: 0,
      geofenceRadiusM: 500,
      authorizedCategoryIds: [],
    },
  });

  const selectedCategories = watch('authorizedCategoryIds') || [];

  React.useEffect(() => {
    if (facility && isOpen) {
      setServerError(null);
      // Ensure authorizedCategoryIds is an array
      let catIds: string[] = [];
      if (Array.isArray(facility.authorizedCategoryIds)) {
        catIds = facility.authorizedCategoryIds;
      } else if (typeof facility.authorizedCategoryIds === 'string') {
        try {
          catIds = JSON.parse(facility.authorizedCategoryIds);
        } catch {
          catIds = [];
        }
      }

      reset({
        address: facility.address || '',
        latitude: facility.latitude ?? 0,
        longitude: facility.longitude ?? 0,
        geofenceRadiusM: facility.geofenceRadiusM ?? 500,
        authorizedCategoryIds: catIds,
      });
    }
  }, [facility, isOpen, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditFacilityFormData) => {
      if (!facility) throw new Error('No facility selected');
      return facilitiesApi.update(facility.id, {
        address: data.address.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        geofenceRadiusM: data.geofenceRadiusM,
        authorizedCategoryIds: facility.type === 'TREATMENT_FACILITY' ? data.authorizedCategoryIds : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hub-facilities'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setServerError(getErrorMessage(err));
    },
  });

  const toggleCategory = (catId: string) => {
    const current = new Set(selectedCategories);
    if (current.has(catId)) {
      current.delete(catId);
    } else {
      current.add(catId);
    }
    setValue('authorizedCategoryIds', Array.from(current));
  };

  const onSubmit = (data: EditFacilityFormData) => {
    setServerError(null);
    updateMutation.mutate(data);
  };

  if (!facility) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Facility: ${facility.name}`}
      description={`Update geolocation perimeter and regulatory authorizations for ${facility.registrationNumber}.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
        {serverError && (
          <div className="p-3 bg-status-danger-bg border border-status-danger/20 rounded-lg flex items-center gap-2 text-xs text-status-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Physical Address */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Physical Address <span className="text-status-danger">*</span>
          </label>
          <Input
            {...register('address')}
            className={errors.address ? 'border-status-danger' : ''}
          />
          {errors.address && (
            <p className="text-[11px] text-status-danger mt-1">{errors.address.message}</p>
          )}
        </div>

        {/* Geofence Radius */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Geofence Radius (Meters) <span className="text-status-danger">*</span>
          </label>
          <Input
            {...register('geofenceRadiusM', { valueAsNumber: true })}
            type="number"
            className={errors.geofenceRadiusM ? 'border-status-danger' : ''}
          />
          {errors.geofenceRadiusM && (
            <p className="text-[11px] text-status-danger mt-1">
              {errors.geofenceRadiusM.message}
            </p>
          )}
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Latitude <span className="text-status-danger">*</span>
            </label>
            <Input
              {...register('latitude', { valueAsNumber: true })}
              type="number"
              step="any"
              className={errors.latitude ? 'border-status-danger' : ''}
            />
            {errors.latitude && (
              <p className="text-[11px] text-status-danger mt-1">{errors.latitude.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Longitude <span className="text-status-danger">*</span>
            </label>
            <Input
              {...register('longitude', { valueAsNumber: true })}
              type="number"
              step="any"
              className={errors.longitude ? 'border-status-danger' : ''}
            />
            {errors.longitude && (
              <p className="text-[11px] text-status-danger mt-1">{errors.longitude.message}</p>
            )}
          </div>
        </div>

        {/* Authorized Categories Selection for CBWTFs */}
        {facility.type === 'TREATMENT_FACILITY' && (
          <div className="pt-2 border-t border-neutral-100">
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
              Authorized Waste Categories (CBWTF Treatment Permit)
            </label>
            <p className="text-[11px] text-neutral-500 mb-2.5">
              Only batches with checked categories will pass gate verification at this CBWTF.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => {
                const isChecked = selectedCategories.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-primary bg-primary/5 text-neutral-900'
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center text-white ${
                        isChecked ? 'bg-primary border-primary' : 'border-neutral-300'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <CategoryBadge category={cat} size="sm" />
                    <span className="text-xs font-medium truncate">{cat.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
