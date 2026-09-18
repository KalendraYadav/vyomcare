'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, batchesApi, getErrorMessage } from '@/lib/api';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PackagePlus,
  Scale,
  Building2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Printer,
} from 'lucide-react';
import Link from 'next/link';

const batchFormSchema = z.object({
  categoryId: z.string().min(1, 'Please select a biomedical waste category'),
  department: z.string().trim().min(2, 'Department / Ward name must be at least 2 characters'),
  quantity: z
    .number({ message: 'Please enter a valid numeric weight' })
    .min(0.01, 'Quantity must be greater than 0.01'),
  unit: z.enum(['KG', 'COUNT'] as const),
  photoUrl: z.string().trim().optional(),
});

type BatchFormData = z.infer<typeof batchFormSchema>;

const DEPARTMENT_PRESETS = [
  'ICU - Ward 3',
  'Surgery Suite A',
  'Pathology Lab',
  'Emergency Ward',
  'Maternity Ward',
  'Dialysis Unit',
];

export default function NewWasteBatchPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  // Auto-generate idempotency key once per form lifecycle
  const idempotencyKeyRef = React.useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `key-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );

  // Fetch verified active categories from backend
  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['waste-categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const activeCategories = categories.filter((c) => c.isActive !== false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      categoryId: '',
      department: '',
      quantity: undefined,
      unit: 'KG',
      photoUrl: '',
    },
  });

  const selectedCategoryId = watch('categoryId');
  const selectedUnit = watch('unit');

  // Mutation to create waste batch
  const createMutation = useMutation({
    mutationFn: (data: BatchFormData) =>
      batchesApi.create({
        categoryId: data.categoryId,
        department: data.department,
        quantity: data.quantity,
        unit: data.unit,
        photoUrl: data.photoUrl ? data.photoUrl : undefined,
        idempotencyKey: idempotencyKeyRef.current,
      }),
    onSuccess: (createdBatch) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'hospital'] });

      // Navigate directly to the QR Label Print page
      router.push(`/waste-batches/${createdBatch.id}/print-qr`);
    },
    onError: (err) => {
      setSubmissionError(getErrorMessage(err));
    },
  });

  const onSubmit = (data: BatchFormData) => {
    setSubmissionError(null);
    createMutation.mutate(data);
  };

  return (
    <RoleGuard allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN']}>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Header Breadcrumb & Title */}
        <div className="space-y-1">
          <Link
            href="/waste-batches"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Waste Batches</span>
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-subtle text-primary border border-primary/20 mb-1">
                <PackagePlus className="w-3.5 h-3.5" />
                <span>Hospital Waste Generation</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Register New Waste Batch
              </h1>
              <p className="text-xs text-neutral-500">
                Log hazardous clinical waste from wards and print adhesive CPCB-compliant QR barcode labels.
              </p>
            </div>
          </div>
        </div>

        {/* Submission Error Banner */}
        {submissionError && (
          <Alert
            variant="danger"
            title="Batch Creation Failed"
            onDismiss={() => setSubmissionError(null)}
          >
            {submissionError}
          </Alert>
        )}

        {/* Main Form Card */}
        <Card>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="text-base font-bold text-neutral-900">
                Waste Manifest Particulars
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Ensure bag is weighed accurately and categorized according to Biomedical Waste Management Rules, 2016.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Category Picker (CPCB 4 Statutory Streams) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="category-selector-group"
                    className="text-xs font-bold text-neutral-700 uppercase tracking-wider block"
                  >
                    Biomedical Waste Category <span className="text-red-500">*</span>
                  </label>
                  {isCategoriesLoading && (
                    <span className="text-xs text-neutral-400">Loading categories...</span>
                  )}
                </div>

                {isCategoriesLoading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                )}

                {isCategoriesError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{getErrorMessage(categoriesError)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => refetchCategories()}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </Button>
                  </div>
                )}

                {!isCategoriesLoading && !isCategoriesError && activeCategories.length === 0 && (
                  <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500">
                    No active waste categories configured. Contact your administrator.
                  </div>
                )}

                {!isCategoriesLoading && !isCategoriesError && activeCategories.length > 0 && (
                  <div
                    id="category-selector-group"
                    role="radiogroup"
                    aria-label="Biomedical Waste Category"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {activeCategories.map((cat) => {
                      const isSelected = selectedCategoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setValue('categoryId', cat.id, { shouldValidate: true })}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 relative ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/20 bg-primary-subtle/30 shadow-xs'
                              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0 border"
                            style={{ backgroundColor: cat.colorCode }}
                          />
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-neutral-900 truncate">
                                {cat.name}
                              </span>
                              <span className="font-mono text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {cat.code}
                              </span>
                            </div>
                            {cat.description && (
                              <p className="text-[11px] text-neutral-500 line-clamp-2">
                                {cat.description}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {errors.categoryId && (
                  <p className="text-xs text-red-600 font-medium">
                    {errors.categoryId.message}
                  </p>
                )}
              </div>

              {/* Department / Ward with Quick Preset Chips */}
              <div className="space-y-2">
                <label
                  htmlFor="department-input"
                  className="text-xs font-bold text-neutral-700 uppercase tracking-wider block"
                >
                  Ward / Department <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  <Input
                    id="department-input"
                    placeholder="e.g. ICU - Ward 3, Pathology Lab, Surgery Suite"
                    className="pl-9 text-xs"
                    {...register('department')}
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold text-neutral-400 self-center mr-1">
                    Quick suggestions:
                  </span>
                  {DEPARTMENT_PRESETS.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setValue('department', dept, { shouldValidate: true })}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 transition-colors font-medium"
                    >
                      {dept}
                    </button>
                  ))}
                </div>

                {errors.department && (
                  <p className="text-xs text-red-600 font-medium">
                    {errors.department.message}
                  </p>
                )}
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="quantity-input"
                    className="text-xs font-bold text-neutral-700 uppercase tracking-wider block"
                  >
                    Quantity / Weight <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Scale className="w-4 h-4 absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    <Input
                      id="quantity-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 14.50"
                      className="pl-9 text-xs font-mono font-bold"
                      {...register('quantity', { valueAsNumber: true })}
                    />
                  </div>
                  {errors.quantity && (
                    <p className="text-xs text-red-600 font-medium">
                      {errors.quantity.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
                    Measurement Unit <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 h-10">
                    <button
                      type="button"
                      onClick={() => setValue('unit', 'KG', { shouldValidate: true })}
                      className={`rounded-lg border text-xs font-bold flex items-center justify-center transition-all ${
                        selectedUnit === 'KG'
                          ? 'border-primary bg-primary text-white shadow-xs'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      KG (Kilograms)
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue('unit', 'COUNT', { shouldValidate: true })}
                      className={`rounded-lg border text-xs font-bold flex items-center justify-center transition-all ${
                        selectedUnit === 'COUNT'
                          ? 'border-primary bg-primary text-white shadow-xs'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      COUNT (Pieces/Bags)
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional Photo URL */}
              <div className="space-y-2 pt-1 border-t border-neutral-100">
                <label
                  htmlFor="photo-url-input"
                  className="text-xs font-bold text-neutral-700 uppercase tracking-wider block"
                >
                  Bag Photo URL <span className="text-neutral-400 font-normal lowercase">(optional proof)</span>
                </label>
                <div className="relative">
                  <ImageIcon className="w-4 h-4 absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                  <Input
                    id="photo-url-input"
                    placeholder="https://storage.biotrack.in/bags/photo-01.jpg"
                    className="pl-9 text-xs"
                    {...register('photoUrl')}
                  />
                </div>
                <p className="text-[11px] text-neutral-400">
                  Optional image showing bag color and sealed barcode tamper tag.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50/50 border-t border-neutral-100 p-4 rounded-b-xl">
              <span className="text-[11px] text-neutral-400">
                Submitting will generate batch manifest and proceed to QR label printer.
              </span>

              <Button
                type="submit"
                variant="primary"
                size="touch"
                disabled={isSubmitting || createMutation.isPending}
                isLoading={createMutation.isPending}
                className="w-full sm:w-auto font-bold gap-2 px-6 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Register & Print QR Sticker</span>
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </RoleGuard>
  );
}
