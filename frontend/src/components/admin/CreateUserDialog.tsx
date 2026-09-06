'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, facilitiesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { UserRole } from '@/types/models';
import { UserPlus, AlertCircle } from 'lucide-react';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  role: z.enum([
    'HOSPITAL_ADMIN',
    'HOSPITAL_STAFF',
    'COLLECTION_STAFF',
    'TRANSPORT_PERSONNEL',
    'TREATMENT_FACILITY_STAFF',
    'GOVERNMENT_AUTHORITY',
    'SUPER_ADMIN',
  ] as const),
  facilityId: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long'),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { user, isHospitalAdmin } = useCurrentUser();
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Fetch facilities for Super Admin to link user to facility
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-selection'],
    queryFn: () => facilitiesApi.list(),
    enabled: isOpen && !isHospitalAdmin,
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: isHospitalAdmin ? 'HOSPITAL_STAFF' : 'HOSPITAL_STAFF',
      facilityId: isHospitalAdmin ? (user?.facilityId || undefined) : undefined,
      password: '',
    },
  });

  const selectedRole = watch('role');

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setServerError(null);
      reset({
        name: '',
        email: '',
        phone: '',
        role: isHospitalAdmin ? 'HOSPITAL_STAFF' : 'HOSPITAL_STAFF',
        facilityId: isHospitalAdmin ? (user?.facilityId || undefined) : undefined,
        password: '',
      });
    }
  }, [isOpen, isHospitalAdmin, user?.facilityId, reset]);

  const createMutation = useMutation({
    mutationFn: (data: CreateUserFormData) => {
      return usersApi.create({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        role: data.role,
        phone: data.phone ? data.phone.trim() : undefined,
        password: data.password.trim(),
        facilityId: isHospitalAdmin ? user?.facilityId || undefined : (data.facilityId || undefined),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hub-users'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setServerError(getErrorMessage(err));
    },
  });

  const onSubmit = (data: CreateUserFormData) => {
    setServerError(null);
    createMutation.mutate(data);
  };

  // Roles available based on actor
  const roleOptions: { value: UserRole; label: string }[] = isHospitalAdmin
    ? [
        { value: 'HOSPITAL_STAFF', label: 'Hospital Staff (Ward / Generator)' },
        { value: 'HOSPITAL_ADMIN', label: 'Hospital Admin' },
      ]
    : [
        { value: 'HOSPITAL_STAFF', label: 'Hospital Staff (Ward / Generator)' },
        { value: 'HOSPITAL_ADMIN', label: 'Hospital Administrator' },
        { value: 'COLLECTION_STAFF', label: 'Collection Staff' },
        { value: 'TRANSPORT_PERSONNEL', label: 'Transport / Driver' },
        { value: 'TREATMENT_FACILITY_STAFF', label: 'CBWTF Facility Staff' },
        { value: 'GOVERNMENT_AUTHORITY', label: 'Government / Regulatory Authority' },
        { value: 'SUPER_ADMIN', label: 'Super Admin (System Operator)' },
      ];

  const facilityNeedsLinking =
    ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'TREATMENT_FACILITY_STAFF'].includes(selectedRole);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Provision New User Account"
      description="Create a certified user profile with authenticated role permissions."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
        {serverError && (
          <div className="p-3 bg-status-danger-bg border border-status-danger/20 rounded-lg flex items-center gap-2 text-xs text-status-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Full Name <span className="text-status-danger">*</span>
          </label>
          <Input
            {...register('name')}
            placeholder="e.g. Dr. Ramesh Gupta"
            aria-invalid={!!errors.name}
            className={errors.name ? 'border-status-danger' : ''}
          />
          {errors.name && (
            <p className="text-[11px] text-status-danger mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Official Email Address <span className="text-status-danger">*</span>
          </label>
          <Input
            {...register('email')}
            type="email"
            placeholder="e.g. ramesh.gupta@hospital.in"
            aria-invalid={!!errors.email}
            className={errors.email ? 'border-status-danger' : ''}
          />
          {errors.email && (
            <p className="text-[11px] text-status-danger mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Contact Phone Number (Optional)
          </label>
          <Input
            {...register('phone')}
            type="tel"
            placeholder="e.g. +91 98765 43210"
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Assigned System Role <span className="text-status-danger">*</span>
          </label>
          <Select
            options={roleOptions}
            value={watch('role')}
            onChange={(e) => setValue('role', e.target.value as UserRole)}
          />
          {errors.role && (
            <p className="text-[11px] text-status-danger mt-1">{errors.role.message}</p>
          )}
        </div>

        {/* Facility Assignment (For Super Admin if role requires facility) */}
        {!isHospitalAdmin && (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Affiliated Facility {facilityNeedsLinking ? '(Recommended for this role)' : '(Optional)'}
            </label>
            <Select
              options={[
                { value: '', label: 'None / Central Authority' },
                ...facilities.map((f) => ({
                  value: f.id,
                  label: `${f.name} (${f.type === 'HOSPITAL' ? 'Hospital' : 'CBWTF'} - ${f.registrationNumber})`,
                })),
              ]}
              value={watch('facilityId') || ''}
              onChange={(e) => setValue('facilityId', e.target.value || undefined)}
            />
          </div>
        )}

        {/* Password (Required) */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Initial Temporary Password <span className="text-status-danger">*</span>
          </label>
          <Input
            {...register('password')}
            type="password"
            placeholder="Min. 8 characters (e.g. SecurePass#2026)"
            aria-invalid={!!errors.password}
            className={errors.password ? 'border-status-danger' : ''}
          />
          {errors.password && (
            <p className="text-[11px] text-status-danger mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={createMutation.isPending}
            className="gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Account</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
