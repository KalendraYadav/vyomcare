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
import { Select } from '@/components/ui/select';
import { FacilityType } from '@/types/models';
import { Building2, AlertCircle, Check } from 'lucide-react';
import { CategoryBadge } from '@/components/shared/CategoryBadge';

const registerFacilitySchema = z.object({
  name: z.string().min(3, 'Facility name must be at least 3 characters'),
  type: z.enum(['HOSPITAL', 'TREATMENT_FACILITY'] as const),
  registrationNumber: z.string().min(3, 'Registration number is required (e.g. HOSP-MUM-003)'),
  address: z.string().min(5, 'Physical address is required'),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
  geofenceRadiusM: z.number().min(50).max(10000, 'Geofence radius must be 50-10,000 meters'),
  authorizedCategoryIds: z.array(z.string()),
});

type RegisterFacilityFormData = z.infer<typeof registerFacilitySchema>;

interface RegisterFacilityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RegisterFacilityDialog: React.FC<RegisterFacilityDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Fetch active categories for CBWTF authorization selection
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
  } = useForm<RegisterFacilityFormData>({
    resolver: zodResolver(registerFacilitySchema),
    defaultValues: {
      name: '',
      type: 'HOSPITAL',
      registrationNumber: '',
      address: '',
      latitude: 19.076,
      longitude: 72.8777,
      geofenceRadiusM: 500,
      authorizedCategoryIds: [],
    },
  });

  const selectedType = watch('type');
  const selectedCategories = watch('authorizedCategoryIds') || [];

  React.useEffect(() => {
    if (isOpen) {
      setServerError(null);
      reset({
        name: '',
        type: 'HOSPITAL',
        registrationNumber: '',
        address: '',
        latitude: 19.076,
        longitude: 72.8777,
        geofenceRadiusM: 500,
        authorizedCategoryIds: [],
      });
    }
  }, [isOpen, reset]);

  const registerMutation = useMutation({
    mutationFn: (data: RegisterFacilityFormData) => {
      return facilitiesApi.register({
        name: data.name.trim(),
        type: data.type,
        registrationNumber: data.registrationNumber.trim().toUpperCase(),
        address: data.address.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        geofenceRadiusM: data.geofenceRadiusM,
        authorizedCategoryIds: data.type === 'TREATMENT_FACILITY' ? data.authorizedCategoryIds : [],
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

  const onSubmit = (data: RegisterFacilityFormData) => {
    setServerError(null);
    registerMutation.mutate(data);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Register Facility"
      description="Register a hospital or Common Bio-medical Waste Treatment Facility (CBWTF)."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
        {serverError && (
          <div className="p-3 bg-status-danger-bg border border-status-danger/20 rounded-lg flex items-center gap-2 text-xs text-status-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Facility Name & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Facility Name <span className="text-status-danger">*</span>
            </label>
            <Input
              {...register('name')}
              placeholder="e.g. Ruby Hall Memorial Hospital"
              aria-invalid={!!errors.name}
              className={errors.name ? 'border-status-danger' : ''}
            />
            {errors.name && (
              <p className="text-[11px] text-status-danger mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Facility Type <span className="text-status-danger">*</span>
            </label>
            <Select
              options={[
                { value: 'HOSPITAL', label: 'Hospital (Generator)' },
                { value: 'TREATMENT_FACILITY', label: 'Treatment Facility (CBWTF)' },
              ]}
              value={watch('type')}
              onChange={(e) => setValue('type', e.target.value as FacilityType)}
            />
          </div>
        </div>

        {/* Registration Number & Geofence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              State Registration Number <span className="text-status-danger">*</span>
            </label>
            <Input
              {...register('registrationNumber')}
              placeholder="e.g. HOSP-MUM-005"
              className={errors.registrationNumber ? 'border-status-danger uppercase' : 'uppercase'}
            />
            {errors.registrationNumber && (
              <p className="text-[11px] text-status-danger mt-1">
                {errors.registrationNumber.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Geofence Radius (Meters) <span className="text-status-danger">*</span>
            </label>
            <Input
              {...register('geofenceRadiusM', { valueAsNumber: true })}
              type="number"
              placeholder="e.g. 500"
              className={errors.geofenceRadiusM ? 'border-status-danger' : ''}
            />
            {errors.geofenceRadiusM && (
              <p className="text-[11px] text-status-danger mt-1">
                {errors.geofenceRadiusM.message}
              </p>
            )}
          </div>
        </div>

        {/* Physical Address */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Physical Address <span className="text-status-danger">*</span>
          </label>
          <Input
            {...register('address')}
            placeholder="e.g. Plot 42, MIDC Industrial Area, Pune 411028"
            className={errors.address ? 'border-status-danger' : ''}
          />
          {errors.address && (
            <p className="text-[11px] text-status-danger mt-1">{errors.address.message}</p>
          )}
        </div>

        {/* GPS Coordinates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Latitude <span className="text-status-danger">*</span>
            </label>
            <Input
              {...register('latitude', { valueAsNumber: true })}
              type="number"
              step="any"
              placeholder="e.g. 18.5204"
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
              placeholder="e.g. 73.8567"
              className={errors.longitude ? 'border-status-danger' : ''}
            />
            {errors.longitude && (
              <p className="text-[11px] text-status-danger mt-1">{errors.longitude.message}</p>
            )}
          </div>
        </div>

        {/* Authorized Categories Selection for CBWTFs */}
        {selectedType === 'TREATMENT_FACILITY' && (
          <div className="pt-2 border-t border-neutral-100">
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
              Authorized Waste Categories (CBWTF Permit)
            </label>
            <p className="text-[11px] text-neutral-500 mb-2.5">
              Select which biomedical waste streams this facility is officially licensed to treat. Arrival verification will strictly reject unauthorized categories.
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

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
          Newly registered facilities are initially set to <strong>PENDING</strong> status. A Super Administrator must verify statutory licenses before issuing approval.
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={registerMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={registerMutation.isPending}
            className="gap-1.5"
          >
            <Building2 className="w-4 h-4" />
            <span>Submit Registration</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
