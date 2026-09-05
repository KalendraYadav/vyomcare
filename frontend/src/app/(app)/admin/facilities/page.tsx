'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi, categoriesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Facility, FacilityType, FacilityStatus, WasteCategory } from '@/types/models';
import { RegisterFacilityDialog } from '@/components/admin/RegisterFacilityDialog';
import { EditFacilityDialog } from '@/components/admin/EditFacilityDialog';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { formatDateShort } from '@/lib/utils';
import {
  Building2,
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  MapPin,
  RefreshCw,
  Edit,
  Radio,
} from 'lucide-react';

export default function FacilitiesManagementPage() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useCurrentUser();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  const [isRegisterOpen, setIsRegisterOpen] = React.useState(false);
  const [editingFacility, setEditingFacility] = React.useState<Facility | null>(null);

  // Approval / Suspension confirmation state
  const [actionTarget, setActionTarget] = React.useState<{
    facility: Facility;
    action: 'APPROVED' | 'SUSPENDED';
  } | null>(null);

  // Query facilities with backend filter params where supported
  const {
    data: facilities = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['facilities', typeFilter, statusFilter],
    queryFn: () => {
      const params: { type?: FacilityType; status?: FacilityStatus } = {};
      if (typeFilter !== 'ALL') params.type = typeFilter as FacilityType;
      if (statusFilter !== 'ALL') params.status = statusFilter as FacilityStatus;
      return facilitiesApi.list(params);
    },
    staleTime: 30_000,
  });

  // Query categories to display badges for authorized categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-catalog'],
    queryFn: () => categoriesApi.list(),
    staleTime: 120_000,
  });

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, WasteCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVED' | 'SUSPENDED' }) =>
      facilitiesApi.approve(id, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hub-facilities'] });
      setActionTarget(null);
    },
  });

  // Client search filter
  const filteredFacilities = React.useMemo(() => {
    return facilities.filter((f) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        f.name.toLowerCase().includes(term) ||
        f.registrationNumber.toLowerCase().includes(term) ||
        f.address.toLowerCase().includes(term)
      );
    });
  }, [facilities, searchTerm]);

  // Status badge helper
  const getStatusBadge = (status: FacilityStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Review
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <Ban className="w-3 h-3 text-rose-600" />
            Suspended
          </span>
        );
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'GOVERNMENT_AUTHORITY']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Licensed Facilities Directory
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {filteredFacilities.length} Facilities
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Authoritative registry of licensed healthcare facilities (Hospitals) and Common Bio-medical Waste Treatment Facilities (CBWTF).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            {isSuperAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRegisterOpen(true)}
                className="gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register Facility</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 border-neutral-200 shadow-subtle space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search facility name, registration, address..."
                className="pl-9 text-xs"
              />
            </div>

            <div>
              <Select
                options={[
                  { value: 'ALL', label: 'All Facility Types' },
                  { value: 'HOSPITAL', label: 'Hospitals (Generators)' },
                  { value: 'TREATMENT_FACILITY', label: 'Treatment Facilities (CBWTF)' },
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>

            <div>
              <Select
                options={[
                  { value: 'ALL', label: 'All Review Statuses' },
                  { value: 'APPROVED', label: 'Approved Only' },
                  { value: 'PENDING', label: 'Pending Review' },
                  { value: 'SUSPENDED', label: 'Suspended Only' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Facilities Table */}
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : isError ? (
          <ErrorState
            title="Failed to Load Facilities"
            message={getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        ) : filteredFacilities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No Facilities Found"
            description="No registered facilities match the selected filters."
            actionLabel={isSuperAdmin ? 'Register New Facility' : undefined}
            onAction={isSuperAdmin ? () => setIsRegisterOpen(true) : undefined}
          />
        ) : (
          <div className="card overflow-hidden border-neutral-200 shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Facility</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Geofence & Location</th>
                    <th className="py-3 px-4">Authorized Streams</th>
                    <th className="py-3 px-4">Registered</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredFacilities.map((f) => {
                    const isHospital = f.type === 'HOSPITAL';
                    // Parse authorizedCategoryIds safely
                    let catIds: string[] = [];
                    if (Array.isArray(f.authorizedCategoryIds)) {
                      catIds = f.authorizedCategoryIds;
                    } else if (typeof f.authorizedCategoryIds === 'string') {
                      try {
                        catIds = JSON.parse(f.authorizedCategoryIds);
                      } catch {
                        catIds = [];
                      }
                    }

                    return (
                      <tr key={f.id} className="hover:bg-neutral-50/70 transition-colors">
                        {/* Facility Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${
                                isHospital
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900 truncate">{f.name}</p>
                              <p className="text-[11px] font-mono text-neutral-500 font-medium tracking-wide">
                                {f.registrationNumber}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate max-w-xs flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                {f.address}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isHospital
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {isHospital ? 'Hospital' : 'CBWTF'}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">{getStatusBadge(f.status)}</td>

                        {/* Geofence & Location */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5 text-[11px]">
                            <div className="flex items-center gap-1 text-neutral-700 font-medium">
                              <Radio className="w-3 h-3 text-neutral-400" />
                              <span>{f.geofenceRadiusM ? `${f.geofenceRadiusM}m radius` : 'Default 500m'}</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 font-mono">
                              {f.latitude?.toFixed(4)}, {f.longitude?.toFixed(4)}
                            </p>
                          </div>
                        </td>

                        {/* Authorized Categories */}
                        <td className="py-3 px-4">
                          {isHospital ? (
                            <span className="text-[11px] text-neutral-400 italic">Generator (All Streams)</span>
                          ) : catIds.length === 0 ? (
                            <span className="text-[11px] text-rose-600 font-medium">No permits granted</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {catIds.slice(0, 3).map((catId) => {
                                const cat = categoryMap.get(catId);
                                return cat ? (
                                  <CategoryBadge key={catId} category={cat} size="sm" />
                                ) : null;
                              })}
                              {catIds.length > 3 && (
                                <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                                  +{catIds.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Registered Date */}
                        <td className="py-3 px-4 text-neutral-500 text-[11px]">
                          {formatDateShort(f.createdAt)}
                        </td>

                        {/* Actions (Super Admin Only) */}
                        {isSuperAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {f.status === 'PENDING' && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    className="text-[11px] h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() =>
                                      setActionTarget({ facility: f, action: 'APPROVED' })
                                    }
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-[11px] h-7 px-2 text-rose-700 hover:bg-rose-50"
                                    onClick={() =>
                                      setActionTarget({ facility: f, action: 'SUSPENDED' })
                                    }
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}

                              {f.status === 'APPROVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[11px] h-7 px-2 text-rose-700 hover:bg-rose-50 border-rose-200"
                                  onClick={() =>
                                    setActionTarget({ facility: f, action: 'SUSPENDED' })
                                  }
                                >
                                  Suspend
                                </Button>
                              )}

                              {f.status === 'SUSPENDED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[11px] h-7 px-2 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                  onClick={() =>
                                    setActionTarget({ facility: f, action: 'APPROVED' })
                                  }
                                >
                                  Reactivate
                                </Button>
                              )}

                              <Button
                                variant="secondary"
                                size="sm"
                                className="text-[11px] h-7 px-2"
                                onClick={() => setEditingFacility(f)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Register Dialog */}
        <RegisterFacilityDialog
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
        />

        {/* Edit Dialog */}
        <EditFacilityDialog
          facility={editingFacility}
          isOpen={!!editingFacility}
          onClose={() => setEditingFacility(null)}
        />

        {/* Approve / Suspend Confirmation Dialog */}
        {actionTarget && (
          <ConfirmDialog
            isOpen={true}
            onClose={() => setActionTarget(null)}
            onConfirm={() =>
              approveMutation.mutate({
                id: actionTarget.facility.id,
                action: actionTarget.action,
              })
            }
            title={`${actionTarget.action === 'APPROVED' ? 'Grant Approval for' : 'Suspend Operations of'} Facility`}
            message={`Are you sure you want to ${
              actionTarget.action === 'APPROVED' ? 'approve' : 'suspend'
            } ${actionTarget.facility.name} (${actionTarget.facility.registrationNumber})? ${
              actionTarget.action === 'APPROVED'
                ? 'The facility will immediately be authorized to handle biomedical waste workflows.'
                : 'Any new waste consignments and gate verifications for this facility will be suspended.'
            }`}
            confirmLabel={actionTarget.action === 'APPROVED' ? 'Approve Facility' : 'Suspend Facility'}
            isDestructive={actionTarget.action === 'SUSPENDED'}
            isLoading={approveMutation.isPending}
          />
        )}
      </div>
    </RoleGuard>
  );
}
