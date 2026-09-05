'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, facilitiesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { User, UserRole, UserStatus } from '@/types/models';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { formatDateTime } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  Shield,
  Phone,
  Mail,
  RefreshCw,
  Power,
} from 'lucide-react';

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const { user: currentUser, isHospitalAdmin } = useCurrentUser();

  // Search and filter states
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // Status toggle confirmation dialog state
  const [statusTarget, setStatusTarget] = React.useState<{
    user: User;
    newStatus: UserStatus;
  } | null>(null);

  // Fetch users with backend query params where applicable
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['users', roleFilter, statusFilter],
    queryFn: () => {
      const params: { role?: UserRole; status?: UserStatus } = {};
      if (roleFilter !== 'ALL') params.role = roleFilter as UserRole;
      if (statusFilter !== 'ALL') params.status = statusFilter as UserStatus;
      return usersApi.list(params);
    },
    staleTime: 30_000,
  });

  // Fetch facilities to display readable facility names
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-map'],
    queryFn: () => facilitiesApi.list(),
    staleTime: 120_000,
  });

  const facilityMap = React.useMemo(() => {
    const map = new Map<string, string>();
    facilities.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [facilities]);

  // Mutation to toggle active/deactivated status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      usersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hub-users'] });
      setStatusTarget(null);
    },
  });

  // Client-side search filtering (name, email, phone)
  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.phone && u.phone.toLowerCase().includes(term))
      );
    });
  }, [users, searchTerm]);

  // Role badge helper
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'GOVERNMENT_AUTHORITY':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'HOSPITAL_ADMIN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'HOSPITAL_STAFF':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'COLLECTION_STAFF':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'TRANSPORT_PERSONNEL':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'TREATMENT_FACILITY_STAFF':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN']}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                {isHospitalAdmin ? 'Hospital Personnel Management' : 'User Account Directory'}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {filteredUsers.length} Certified
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              {isHospitalAdmin
                ? 'Manage ward generator staff and authorized administrators for your hospital.'
                : 'Directory of all authenticated actors across hospitals, transport, CBWTFs, and government bodies.'}
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Provision User</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="card p-4 border-neutral-200 shadow-subtle space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone..."
                className="pl-9 text-xs"
              />
            </div>

            {/* Role Filter */}
            <div>
              <Select
                options={
                  isHospitalAdmin
                    ? [
                        { value: 'ALL', label: 'All Hospital Roles' },
                        { value: 'HOSPITAL_STAFF', label: 'Hospital Staff' },
                        { value: 'HOSPITAL_ADMIN', label: 'Hospital Admin' },
                      ]
                    : [
                        { value: 'ALL', label: 'All System Roles' },
                        { value: 'HOSPITAL_STAFF', label: 'Hospital Staff' },
                        { value: 'HOSPITAL_ADMIN', label: 'Hospital Admin' },
                        { value: 'COLLECTION_STAFF', label: 'Collection Staff' },
                        { value: 'TRANSPORT_PERSONNEL', label: 'Transport Personnel' },
                        { value: 'TREATMENT_FACILITY_STAFF', label: 'CBWTF Staff' },
                        { value: 'GOVERNMENT_AUTHORITY', label: 'Government' },
                        { value: 'SUPER_ADMIN', label: 'Super Admin' },
                      ]
                }
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div>
              <Select
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active Accounts' },
                  { value: 'DEACTIVATED', label: 'Deactivated Accounts' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* User Table / View */}
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : isError ? (
          <ErrorState
            title="Failed to Load Users"
            message={getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Users Found"
            description="No user accounts match the current filter or search criteria."
            actionLabel="Provision New User"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : (
          <div className="card overflow-hidden border-neutral-200 shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Facility</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const isDeactivated = u.status === 'DEACTIVATED';
                    const facilityName = u.facilityId
                      ? facilityMap.get(u.facilityId) || 'Assigned Facility'
                      : 'None (System)';

                    return (
                      <tr key={u.id} className="hover:bg-neutral-50/70 transition-colors">
                        {/* Name, Email, Phone */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-700 font-semibold flex items-center justify-center text-xs flex-shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900 truncate flex items-center gap-1.5">
                                {u.name}
                                {isSelf && (
                                  <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-1.5 py-0.2 rounded">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-neutral-500 truncate flex items-center gap-1">
                                <Mail className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                                {u.email}
                              </p>
                              {u.phone && (
                                <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5 text-neutral-400 flex-shrink-0" />
                                  {u.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadge(
                              u.role,
                            )}`}
                          >
                            <Shield className="w-3 h-3" />
                            {u.role.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Facility */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-neutral-700">
                            <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{facilityName}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {u.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                              <XCircle className="w-3 h-3 text-neutral-500" />
                              Deactivated
                            </span>
                          )}
                        </td>

                        {/* Last Login */}
                        <td className="py-3 px-4 text-neutral-500 text-[11px]">
                          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never logged in'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {isSelf ? (
                            <span className="text-[11px] text-neutral-400 italic">Current Session</span>
                          ) : (
                            <Button
                              variant={isDeactivated ? 'outline' : 'secondary'}
                              size="sm"
                              className="text-[11px] h-7 px-2.5 gap-1"
                              onClick={() =>
                                setStatusTarget({
                                  user: u,
                                  newStatus: isDeactivated ? 'ACTIVE' : 'DEACTIVATED',
                                })
                              }
                            >
                              <Power className="w-3 h-3" />
                              <span>{isDeactivated ? 'Activate' : 'Deactivate'}</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create User Dialog */}
        <CreateUserDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />

        {/* Status Confirmation Dialog */}
        {statusTarget && (
          <ConfirmDialog
            isOpen={true}
            onClose={() => setStatusTarget(null)}
            onConfirm={() =>
              updateStatusMutation.mutate({
                id: statusTarget.user.id,
                status: statusTarget.newStatus,
              })
            }
            title={`${statusTarget.newStatus === 'DEACTIVATED' ? 'Deactivate' : 'Activate'} User Account`}
            message={`Are you sure you want to ${
              statusTarget.newStatus === 'DEACTIVATED'
                ? 'deactivate access for'
                : 'restore active access for'
            } ${statusTarget.user.name} (${statusTarget.user.email})? ${
              statusTarget.newStatus === 'DEACTIVATED'
                ? 'The user will immediately be blocked from logging in.'
                : 'The user will regain login access.'
            }`}
            confirmLabel={statusTarget.newStatus === 'DEACTIVATED' ? 'Deactivate Account' : 'Activate Account'}
            isDestructive={statusTarget.newStatus === 'DEACTIVATED'}
            isLoading={updateStatusMutation.isPending}
          />
        )}
      </div>
    </RoleGuard>
  );
}
