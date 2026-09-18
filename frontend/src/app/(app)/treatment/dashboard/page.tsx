'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { MetricCard } from '@/components/shared/MetricCard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  ArrivalVerificationDialog,
  ArrivalBatchItem,
} from '@/components/treatment/ArrivalVerificationDialog';
import {
  TreatmentConfirmationDialog,
  TreatmentBatchItem,
} from '@/components/treatment/TreatmentConfirmationDialog';
import {
  Truck,
  ShieldCheck,
  Flame,
  CheckCircle2,
  QrCode,
  AlertTriangle,
  Building2,
  Check,
  RefreshCw,
  Search,
} from 'lucide-react';
import { formatDateShort } from '@/lib/utils';
import { WasteBatchStatus } from '@/types/models';
import { useSocket } from '@/hooks/useSocket';

type QueueFilter = 'ALL' | 'IN_TRANSIT' | 'RECEIVED';

export default function TreatmentDashboardPage() {
  const { user, canScan } = useCurrentUser();
  useSocket(); // Maintain real-time WebSocket invalidation listeners

  // Filter & Search states
  const [activeFilter, setActiveFilter] = React.useState<QueueFilter>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Active dialog state
  const [verifyingBatch, setVerifyingBatch] = React.useState<ArrivalBatchItem | null>(null);
  const [treatingBatch, setTreatingBatch] = React.useState<TreatmentBatchItem | null>(null);

  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['dashboard', 'facility'],
    queryFn: dashboardApi.facility,
    staleTime: 15_000,
  });

  const getStatusBadge = (status: WasteBatchStatus) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <Badge variant="info" withIcon>
            RECEIVED (AT GATE)
          </Badge>
        );
      case 'IN_TRANSIT':
        return (
          <Badge variant="pending" withIcon>
            IN TRANSIT (INBOUND)
          </Badge>
        );
      case 'TREATED':
      case 'VERIFIED_CLOSED':
        return (
          <Badge variant="success" withIcon>
            {status.replace(/_/g, ' ')}
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  // Filter pending batches based on tab and search
  const filteredBatches = React.useMemo(() => {
    if (!dashboard?.pendingBatches) return [];
    return dashboard.pendingBatches.filter((batch) => {
      // Tab filter
      if (activeFilter === 'IN_TRANSIT' && batch.status !== 'IN_TRANSIT') return false;
      if (activeFilter === 'RECEIVED' && batch.status !== 'RECEIVED') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = batch.wasteId.toLowerCase().includes(q);
        const matchesHosp = batch.hospital?.name?.toLowerCase().includes(q);
        const matchesCat = batch.category?.name?.toLowerCase().includes(q);
        if (!matchesId && !matchesHosp && !matchesCat) return false;
      }

      return true;
    });
  }, [dashboard?.pendingBatches, activeFilter, searchQuery]);

  const inTransitCount =
    dashboard?.pendingBatches?.filter((b) => b.status === 'IN_TRANSIT').length ?? 0;
  const receivedCount =
    dashboard?.pendingBatches?.filter((b) => b.status === 'RECEIVED').length ?? 0;

  return (
    <RoleGuard allowedRoles={['TREATMENT_FACILITY_STAFF', 'SUPER_ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                CBWTF Gate & Destruction Desk
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {user?.facility?.name || 'Treatment Facility'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Authoritative 5-step gate arrivals, perimeter geofence validation, and autoclave/incinerator destruction logging.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
              aria-label="Refresh desk data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {canScan && (
              <Link href="/scan">
                <Button variant="primary" size="md" className="gap-2 font-medium shadow-xs">
                  <QrCode className="w-4 h-4" />
                  <span>Scan Verification</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : isError ? (
          <ErrorState
            error={error}
            title="Unable to load treatment facility desk"
            onRetry={() => refetch()}
          />
        ) : dashboard ? (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Incoming Vans En Route"
                value={dashboard.incoming}
                icon={Truck}
                subtitle="Active GPS transport runs"
                accentColor="#2563EB"
              />
              <MetricCard
                label="Awaiting Gate Check"
                value={dashboard.pendingVerification}
                icon={AlertTriangle}
                subtitle="In transit to CBWTF"
                accentColor="#D97706"
              />
              <MetricCard
                label="Awaiting Destruction"
                value={dashboard.received}
                icon={ShieldCheck}
                subtitle="Verified inside perimeter"
                accentColor="#7C3AED"
              />
              <MetricCard
                label="Treated Today"
                value={dashboard.treatedToday}
                icon={Flame}
                subtitle="Closed compliance ledger"
                accentColor="#16A34A"
              />
            </div>

            {/* 5-Step Arrival Verification Guidance Card */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-neutral-900 mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>CPCB Statutory 5-Step Arrival Protocol</span>
              </h3>
              <p className="text-xs text-neutral-500 mb-3">
                Every incoming batch is validated across 5 statutory criteria before custody acceptance.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">STEP 1</span>
                  <p className="text-xs font-semibold text-neutral-800">User Authorization</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Certifies plant operator credentials</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">STEP 2</span>
                  <p className="text-xs font-semibold text-neutral-800">Facility Approval</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Validates active regulatory license</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">STEP 3</span>
                  <p className="text-xs font-semibold text-neutral-800">Category Authorization</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Checks plant handles waste type</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">STEP 4</span>
                  <p className="text-xs font-semibold text-neutral-800">Geofence Proximity</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Locks scan inside gate perimeter</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80">
                  <span className="text-[10px] font-bold text-neutral-400 block mb-1">STEP 5</span>
                  <p className="text-xs font-semibold text-neutral-800">Time SLA Verification</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Ensures transit is within 48h limit</p>
                </div>
              </div>
            </div>

            {/* Inbound & Received Batches Queue */}
            <div className="rounded-xl border border-neutral-200 bg-white shadow-2xs overflow-hidden space-y-4 p-4 sm:p-5">
              {/* Table Toolbar: Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-neutral-100">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Active Operational Manifest Queue
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Actionable batches requiring gate arrival check or autoclave/incinerator destruction.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                    <Input
                      placeholder="Search ID, hospital..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-neutral-100 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeFilter === 'ALL'
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  All Active Queue ({dashboard.pendingBatches?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('IN_TRANSIT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                    activeFilter === 'IN_TRANSIT'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <Truck className="w-3 h-3" />
                  <span>Awaiting Arrival Check ({inTransitCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('RECEIVED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                    activeFilter === 'RECEIVED'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  <Flame className="w-3 h-3" />
                  <span>Awaiting Destruction ({receivedCount})</span>
                </button>
              </div>

              {/* Table view for Desktop */}
              {filteredBatches.length > 0 ? (
                <>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
                          <th className="px-4 py-2.5">Waste ID</th>
                          <th className="px-4 py-2.5">Origin Hospital</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5 text-right">Quantity</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Updated</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredBatches.map((batch) => (
                          <tr key={batch.id} className="hover:bg-neutral-50/70 transition-colors">
                            <td className="px-4 py-3 font-mono font-semibold text-neutral-800">
                              <Link
                                href={`/waste-batches/${batch.id}`}
                                className="text-primary hover:underline"
                              >
                                {batch.wasteId}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-neutral-700 font-medium">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                                <span>{batch.hospital?.name || 'Hospital Facility'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <CategoryBadge category={batch.category} size="sm" />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                              {batch.quantity} {batch.unit}
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(batch.status)}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                              {formatDateShort(batch.updatedAt)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {batch.status === 'IN_TRANSIT' ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => setVerifyingBatch(batch as ArrivalBatchItem)}
                                  className="gap-1.5 font-semibold text-xs shadow-2xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Verify Arrival</span>
                                </Button>
                              ) : (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => setTreatingBatch(batch as TreatmentBatchItem)}
                                  className="gap-1.5 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                >
                                  <Flame className="w-3.5 h-3.5" />
                                  <span>Confirm Treatment</span>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Stacked Mobile Operational Cards (§23 Mobile UX) */}
                  <div className="sm:hidden space-y-3">
                    {filteredBatches.map((batch) => (
                      <div
                        key={batch.id}
                        className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/waste-batches/${batch.id}`}
                              className="font-mono text-sm font-bold text-primary hover:underline"
                            >
                              {batch.wasteId}
                            </Link>
                            <p className="text-xs text-neutral-600 mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-neutral-400" />
                              <span>{batch.hospital?.name || 'Hospital Facility'}</span>
                            </p>
                          </div>
                          {getStatusBadge(batch.status)}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
                          <CategoryBadge category={batch.category} size="sm" />
                          <span className="font-bold text-neutral-900">
                            {batch.quantity} {batch.unit}
                          </span>
                        </div>

                        <div className="pt-2">
                          {batch.status === 'IN_TRANSIT' ? (
                            <Button
                              variant="primary"
                              size="md"
                              onClick={() => setVerifyingBatch(batch as ArrivalBatchItem)}
                              className="w-full gap-2 font-semibold shadow-xs"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>Verify Arrival at Gate</span>
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="md"
                              onClick={() => setTreatingBatch(batch as TreatmentBatchItem)}
                              className="w-full gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              <Flame className="w-4 h-4" />
                              <span>Confirm Destruction</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={CheckCircle2}
                    title="No batches in this queue"
                    description={
                      searchQuery
                        ? 'No batches match your current search query. Try clearing the search filter.'
                        : activeFilter === 'IN_TRANSIT'
                        ? 'No shipments are currently in transit to this facility gate.'
                        : activeFilter === 'RECEIVED'
                        ? 'No batches are currently awaiting autoclave/destruction at this facility.'
                        : 'All shipments scheduled for this facility have been processed.'
                    }
                  />
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* 5-Step Arrival Verification Dialog */}
        <ArrivalVerificationDialog
          isOpen={!!verifyingBatch}
          batch={verifyingBatch}
          onClose={() => setVerifyingBatch(null)}
          onSuccess={() => {
            refetch();
          }}
          onProceedToTreatment={(updated) => {
            setVerifyingBatch(null);
            setTreatingBatch(updated as TreatmentBatchItem);
          }}
        />

        {/* Treatment Confirmation Dialog */}
        <TreatmentConfirmationDialog
          isOpen={!!treatingBatch}
          batch={treatingBatch}
          onClose={() => setTreatingBatch(null)}
          onSuccess={() => {
            refetch();
          }}
        />
      </div>
    </RoleGuard>
  );
}
