'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, categoriesApi } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { MetricCard } from '@/components/shared/MetricCard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Package,
  Clock,
  Truck,
  AlertTriangle,
  PlusCircle,
  QrCode,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { formatDateShort } from '@/lib/utils';
import { WasteBatchStatus } from '@/types/models';

export default function HospitalDashboardPage() {
  const { user, canRegisterWaste, canScan } = useCurrentUser();

  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'hospital'],
    queryFn: dashboardApi.hospital,
    staleTime: 15_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['waste-categories'],
    queryFn: categoriesApi.list,
    staleTime: 60_000,
  });

  // Category map helper for breakdown
  const categoryMap = React.useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const getStatusBadge = (status: WasteBatchStatus) => {
    switch (status) {
      case 'VERIFIED_CLOSED':
      case 'TREATED':
        return <Badge variant="success" withIcon>{status.replace(/_/g, ' ')}</Badge>;
      case 'COLLECTED':
      case 'IN_TRANSIT':
        return <Badge variant="pending" withIcon>{status.replace(/_/g, ' ')}</Badge>;
      case 'VIOLATION':
        return <Badge variant="danger" withIcon>VIOLATION</Badge>;
      case 'REGISTERED':
      case 'QR_ASSIGNED':
      case 'RECEIVED':
      default:
        return <Badge variant="info" withIcon>{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <RoleGuard allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN']}>
      <div className="space-y-6">
        {/* Page Header with Action CTAs (design.md §10.1 & §18.3) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Hospital Waste Command Hub
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-primary border border-blue-200">
                {user?.facility?.name || 'Authorized Ward'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Operational overview of segregated biomedical waste batches, collection handovers, and compliance SLAs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canScan && (
              <Link href="/scan">
                <Button variant="secondary" size="md" className="gap-2 font-medium">
                  <QrCode className="w-4 h-4 text-primary" />
                  <span>Scan QR</span>
                </Button>
              </Link>
            )}

            {canRegisterWaste && (
              <Link href="/waste-batches/new">
                <Button variant="primary" size="md" className="gap-2 font-medium shadow-xs">
                  <PlusCircle className="w-4 h-4" />
                  <span>New Waste Batch</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Loading / Error / Content */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <SkeletonTable rows={6} cols={5} />
          </div>
        ) : isError ? (
          <ErrorState
            error={error}
            title="Unable to load hospital dashboard"
            onRetry={() => refetch()}
          />
        ) : dashboard ? (
          <>
            {/* KPI Metric Cards (design.md §11.1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Registered"
                value={dashboard.totalRegistered}
                icon={Package}
                subtitle="All waste batches created"
              />
              <MetricCard
                label="Awaiting Collection"
                value={dashboard.pendingCollection}
                icon={Clock}
                subtitle="Sealed & QR affixed at ward"
                accentColor="#D97706"
              />
              <MetricCard
                label="In Transit to CBWTF"
                value={dashboard.inTransit}
                icon={Truck}
                subtitle="Loaded on verified vehicles"
                accentColor="#2563EB"
              />
              <MetricCard
                label="SLA Violations"
                value={dashboard.delayed}
                icon={AlertTriangle}
                subtitle="Disposal delays or breaches"
                accentColor="#DC2626"
              />
            </div>

            {/* Compliance Health Banner */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                    CPCB Regulatory Compliance Health
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Percentage of hazardous waste batches verified closed within statutory SLA deadlines.
                  </p>
                </div>
              </div>

              <div className="flex items-baseline gap-2 self-end sm:self-center">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {dashboard.complianceRate}%
                </span>
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                  Compliant
                </span>
              </div>
            </div>

            {/* Two-Column Section: Category Distribution & Recent Batches */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Breakdown (4 cols) */}
              <div className="lg:col-span-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <h3 className="text-sm font-bold text-neutral-900">
                      Waste by Category
                    </h3>
                    <span className="text-[11px] text-neutral-400 font-medium">Statutory Types</span>
                  </div>

                  <div className="divide-y divide-neutral-100 mt-2">
                    {dashboard.wasteByCategory && dashboard.wasteByCategory.length > 0 ? (
                      dashboard.wasteByCategory.map((item) => {
                        const cat = categoryMap.get(item.categoryId);
                        return (
                          <div key={item.categoryId} className="py-2.5 flex items-center justify-between">
                            <CategoryBadge category={cat} name={cat?.name || 'Category'} size="sm" />
                            <span className="text-xs font-bold text-neutral-800">
                              {item._count} <span className="text-[10px] font-normal text-neutral-500">batches</span>
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-neutral-500 py-6 text-center">
                        No category distribution recorded yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 text-[11px] text-neutral-500">
                  Automated segregation verification per CPCB 2016 schedule.
                </div>
              </div>

              {/* Recent Waste Batches Table (8 cols) */}
              <div className="lg:col-span-8 rounded-xl border border-neutral-200 bg-white shadow-2xs overflow-hidden flex flex-col">
                <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">
                      Recent Waste Batches
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Latest bags sealed and registered at hospital departments.
                    </p>
                  </div>
                  <Link
                    href="/waste-batches"
                    className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                  >
                    <span>View all</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {dashboard.recentBatches && dashboard.recentBatches.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
                          <th className="px-4 py-2.5">Waste ID</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Ward / Dept</th>
                          <th className="px-4 py-2.5 text-right">Quantity</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {dashboard.recentBatches.slice(0, 8).map((batch) => (
                          <tr key={batch.id} className="hover:bg-neutral-50/70 transition-colors">
                            <td className="px-4 py-3 font-mono font-semibold text-neutral-800">
                              <Link
                                href={`/waste-batches/${batch.id}`}
                                className="text-primary hover:underline"
                              >
                                {batch.wasteId}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <CategoryBadge category={batch.category} size="sm" />
                            </td>
                            <td className="px-4 py-3 text-neutral-700 font-medium">
                              {batch.department}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                              {batch.quantity} {batch.unit}
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(batch.status)}
                            </td>
                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                              {formatDateShort(batch.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8">
                    <EmptyState
                      icon={ClipboardList}
                      title="No waste batches registered"
                      description="No biomedical waste has been logged for this facility yet. Click below to create the first batch."
                      actionLabel="Register First Batch"
                      actionHref="/waste-batches/new"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </RoleGuard>
  );
}
