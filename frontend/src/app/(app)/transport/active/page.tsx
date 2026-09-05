'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transportApi, batchesApi, facilitiesApi, usersApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { useSocket } from '@/hooks/useSocket';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Dialog } from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Truck,
  Building2,
  Navigation,
  Clock,
  Plus,
  RefreshCw,
  Eye,
  Radio,
  Map,
} from 'lucide-react';
import Link from 'next/link';
import { formatRelative } from '@/lib/utils';
import { CreateTransportAssignmentDto } from '@/types/api';

export default function ActiveTransportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isHospitalRole, isSuperAdmin, isCollectionStaff } = useCurrentUser();
  const { isConnected } = useSocket();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [dispatchForm, setDispatchForm] = React.useState<CreateTransportAssignmentDto>({
    wasteBatchId: '',
    vehicleId: '',
    driverUserId: '',
    expectedFacilityId: '',
  });
  const [dispatchError, setDispatchError] = React.useState<string | null>(null);

  // Active shipments query
  const {
    data: activeAssignments = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['transport', 'active'],
    queryFn: () => transportApi.getActive(),
    refetchInterval: 15_000,
  });

  // Queries for the Dispatch modal
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => transportApi.vehicles(),
    enabled: isDispatchModalOpen,
  });

  const { data: collectedBatches } = useQuery({
    queryKey: ['waste-batches', { status: 'COLLECTED' }],
    queryFn: () => batchesApi.list({ status: 'COLLECTED' }),
    enabled: isDispatchModalOpen,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['users', { role: 'TRANSPORT_PERSONNEL' }],
    queryFn: () => usersApi.list({ role: 'TRANSPORT_PERSONNEL' }),
    enabled: isDispatchModalOpen,
  });

  const { data: destinationFacilities = [] } = useQuery({
    queryKey: ['facilities', { type: 'TREATMENT_FACILITY' }],
    queryFn: () => facilitiesApi.list({ type: 'TREATMENT_FACILITY' }),
    enabled: isDispatchModalOpen,
  });

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: (dto: CreateTransportAssignmentDto) => transportApi.createAssignment(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      setIsDispatchModalOpen(false);
      setDispatchForm({
        wasteBatchId: '',
        vehicleId: '',
        driverUserId: '',
        expectedFacilityId: '',
      });
      setDispatchError(null);
    },
    onError: (err) => {
      setDispatchError(getErrorMessage(err));
    },
  });

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchForm.wasteBatchId || !dispatchForm.vehicleId || !dispatchForm.driverUserId || !dispatchForm.expectedFacilityId) {
      setDispatchError('Please fill in all required dispatch fields.');
      return;
    }
    setDispatchError(null);
    createAssignmentMutation.mutate(dispatchForm);
  };

  const filteredAssignments = React.useMemo(() => {
    if (!searchTerm.trim()) return activeAssignments;
    const q = searchTerm.toLowerCase();
    return activeAssignments.filter(
      (a) =>
        a.vehicle?.registrationNumber.toLowerCase().includes(q) ||
        a.driverUser?.name.toLowerCase().includes(q) ||
        a.expectedFacility?.name.toLowerCase().includes(q) ||
        (a.wasteBatch?.wasteId && a.wasteBatch.wasteId.toLowerCase().includes(q))
    );
  }, [activeAssignments, searchTerm]);

  const canDispatch = isHospitalRole || isSuperAdmin || isCollectionStaff;

  return (
    <RoleGuard
      allowedRoles={[
        'GOVERNMENT_AUTHORITY',
        'HOSPITAL_ADMIN',
        'TRANSPORT_PERSONNEL',
        'SUPER_ADMIN',
        'COLLECTION_STAFF',
      ]}
    >
      <div className="space-y-6 pb-12">
        {/* Header & Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Active Transport & Fleet Operations
              </h1>
              <div
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                }`}
              >
                <Radio className={`w-3 h-3 ${isConnected ? 'text-emerald-500 animate-pulse' : ''}`} />
                <span>{isConnected ? 'Real-time Radar' : 'Connecting...'}</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Live tracking of hazardous biomedical waste transit vehicles and automated GPS breadcrumbs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/government/map">
              <Button variant="secondary" size="sm" className="text-xs gap-1.5">
                <Map className="w-3.5 h-3.5 text-primary" />
                <span>Open GIS Radar Map</span>
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            {canDispatch && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsDispatchModalOpen(true)}
                className="text-xs gap-1.5 font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Dispatch Vehicle</span>
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Van Reg (e.g. MH-04), Driver Name, Waste ID, or Destination..."
            className="text-xs"
          />
        </div>

        {/* Active Transport Shipments Table */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-6 w-32 rounded-md" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 flex-1 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to Load Active Transport"
                message={getErrorMessage(error)}
                onRetry={() => refetch()}
              />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Truck}
                title="No Active Shipments in Transit"
                description={
                  searchTerm
                    ? 'No active transport shipments match your search query.'
                    : 'There are currently no hazardous waste transit runs in progress across the monitored region.'
                }
                actionLabel={canDispatch ? 'Dispatch First Shipment' : undefined}
                onAction={canDispatch ? () => setIsDispatchModalOpen(true) : undefined}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle & Driver</TableHead>
                    <TableHead>Manifest Waste Batch</TableHead>
                    <TableHead>Destination CBWTF</TableHead>
                    <TableHead>Latest GPS Telemetry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => {
                    const latestPing = assignment.gpsPings?.[0];
                    return (
                      <TableRow key={assignment.id} className="hover:bg-neutral-50/80 transition-colors">
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-mono text-xs font-bold text-neutral-900 block">
                              {assignment.vehicle?.registrationNumber || 'Unlinked Vehicle'}
                            </span>
                            <span className="text-[11px] text-neutral-500 font-medium">
                              Driver: {assignment.driverUser?.name || 'Assigned Driver'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {assignment.wasteBatch ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/waste-batches/${assignment.wasteBatch.id}`}
                                  className="font-mono text-xs font-bold text-primary hover:underline"
                                >
                                  {assignment.wasteBatch.wasteId}
                                </Link>
                                <CategoryBadge category={assignment.wasteBatch.category} size="sm" />
                              </div>
                              <span className="text-[11px] text-neutral-500 block">
                                {assignment.wasteBatch.quantity} {assignment.wasteBatch.unit} • {assignment.wasteBatch.department}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">No batch linked</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            <span className="font-semibold text-neutral-800 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                              {assignment.expectedFacility?.name || 'Treatment Facility'}
                            </span>
                            <span className="text-[11px] text-neutral-400 block truncate max-w-[200px]">
                              {assignment.expectedFacility?.latitude && assignment.expectedFacility?.longitude
                                ? `${assignment.expectedFacility.latitude.toFixed(4)}°N, ${assignment.expectedFacility.longitude.toFixed(4)}°E`
                                : 'Coordinates registered'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {latestPing ? (
                            <div className="space-y-0.5 text-xs">
                              <span className="font-mono font-bold text-neutral-800 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {latestPing.latitude.toFixed(4)}°N, {latestPing.longitude.toFixed(4)}°E
                              </span>
                              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatRelative(latestPing.recordedAt)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-neutral-400 text-xs">
                              <Radio className="w-3.5 h-3.5" />
                              <span>No pings yet</span>
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant="pending" className="text-[11px] font-semibold uppercase">
                            {assignment.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {assignment.wasteBatch && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/waste-batches/${assignment.wasteBatch?.id}`)}
                                className="h-8 px-2 text-xs"
                                title="View Batch Manifest"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="sr-only">View</span>
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push('/government/map')}
                              className="h-8 px-2 text-xs text-primary hover:text-primary-dark"
                              title="Track on GIS Radar"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span className="sr-only">Track</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Dispatch Vehicle Assignment Modal */}
        <Dialog
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          title="Dispatch Vehicle & Assign Transport Run"
          description="Link a collected biomedical waste batch to an active vehicle and certified transport driver."
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsDispatchModalOpen(false)}
                disabled={createAssignmentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDispatchSubmit}
                isLoading={createAssignmentMutation.isPending}
                disabled={createAssignmentMutation.isPending}
              >
                Dispatch Shipment
              </Button>
            </div>
          }
        >
          <form onSubmit={handleDispatchSubmit} className="space-y-4 py-2 text-xs">
            {dispatchError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                {dispatchError}
              </div>
            )}

            {/* Waste Batch Select */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-700 block">
                Collected Waste Batch <span className="text-red-500">*</span>
              </label>
              <select
                value={dispatchForm.wasteBatchId}
                onChange={(e) => setDispatchForm((f) => ({ ...f, wasteBatchId: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Select Collected Batch...</option>
                {collectedBatches?.items?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.wasteId} — {b.quantity} {b.unit} ({b.department})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-neutral-400">
                Only batches in COLLECTED status can be dispatched on a vehicle run.
              </p>
            </div>

            {/* Vehicle Select */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-700 block">
                Transport Vehicle <span className="text-red-500">*</span>
              </label>
              <select
                value={dispatchForm.vehicleId}
                onChange={(e) => setDispatchForm((f) => ({ ...f, vehicleId: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Select Active Vehicle...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} ({v.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Select */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-700 block">
                Designated Driver <span className="text-red-500">*</span>
              </label>
              <select
                value={dispatchForm.driverUserId}
                onChange={(e) => setDispatchForm((f) => ({ ...f, driverUserId: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Select Certified Driver...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination CBWTF Select */}
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-700 block">
                Destination CBWTF Plant <span className="text-red-500">*</span>
              </label>
              <select
                value={dispatchForm.expectedFacilityId}
                onChange={(e) => setDispatchForm((f) => ({ ...f, expectedFacilityId: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Select Destination Facility...</option>
                {destinationFacilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} ({fac.address})
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
