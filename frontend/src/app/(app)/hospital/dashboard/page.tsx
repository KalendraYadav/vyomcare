'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, categoriesApi } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
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
  Radio,
  FileText,
  Activity,
  ArrowRight,
  CheckCircle2,
  Building2,
  Scale,
  Flame,
} from 'lucide-react';
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

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const getStatusBadge = (status: WasteBatchStatus) => {
    switch (status) {
      case 'VERIFIED_CLOSED':
      case 'TREATED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {status.replace(/_/g, ' ')}
          </span>
        );
      case 'COLLECTED':
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300">
            <Truck className="w-3 h-3 text-blue-400" />
            {status.replace(/_/g, ' ')}
          </span>
        );
      case 'VIOLATION':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-950/80 border border-red-500/60 text-red-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            SLA BREACH
          </span>
        );
      case 'REGISTERED':
      case 'QR_ASSIGNED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300">
            <Clock className="w-3 h-3 text-amber-400" />
            STAGED AT BAY
          </span>
        );
    }
  };

  return (
    <RoleGuard allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN']}>
      <div className="space-y-6 pb-12">
        {/* 1. APEX FACILITY TELEMETRY RIBBON */}
        <div className="relative bg-[#0B101B]/95 border border-slate-800 rounded-xl p-5 md:p-6 shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Tactical Corners */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500 pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold uppercase">
                  <Building2 className="w-3 h-3 text-cyan-400" />
                  HCF FACILITY NODE
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300 font-bold">
                  {user?.facility?.name || 'City General Hospital'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  REG: {user?.facility?.registrationNumber || 'HCF-MH-PUN-0842'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SLA CLOCK ACTIVE
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <span>Clinical Biomedical Waste Command Center</span>
              </h1>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                Centralized ward custody monitoring, serialized CPCB Form-VI manifest logging, and automated 48-hour statutory pickup dispatch.
              </p>
            </div>

            {/* Quick Action Matrix */}
            <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
              {canScan && (
                <Link href="/scan">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-mono font-bold px-4 py-2.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 transition-all shadow-md cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    <span>TERMINAL SCANNER</span>
                  </button>
                </Link>
              )}

              {canRegisterWaste && (
                <Link href="/waste-batches/new">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-mono font-bold px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black transition-all shadow-lg hover:shadow-cyan-500/25 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>REGISTER HAZARDOUS BAG</span>
                  </button>
                </Link>
              )}
            </div>
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
            title="Unable to load hospital command center"
            onRetry={() => refetch()}
          />
        ) : dashboard ? (
          <>
            {/* 2. CONTINUOUS 4-STAGE CUSTODY PIPELINE RIBBON */}
            <div className="bg-[#0B101B]/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span className="font-bold text-white uppercase tracking-wider">
                    CHAIN OF CUSTODY LIFECYCLE
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  STATUTORY CPCB 2016 MANDATE • 48-HR CEILING
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
                {/* Stage 1: Ward Registration */}
                <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden group hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="font-bold text-[10px] uppercase tracking-widest text-cyan-400">
                      01. WARD ENCODED
                    </span>
                    <Package className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white font-mono tabular-nums">
                      {dashboard.totalRegistered}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Total Bags
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Gross manifests registered and sealed across hospital wards.
                  </p>
                </div>

                {/* Stage 2: Awaiting Collection (High Action Priority) */}
                <div className={`p-4 rounded-lg border space-y-2 relative overflow-hidden transition-all ${
                  dashboard.pendingCollection > 0
                    ? 'bg-amber-950/20 border-amber-500/50 shadow-lg'
                    : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[10px] uppercase tracking-widest text-amber-400">
                      02. HOLDING BAY STAGED
                    </span>
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-300 font-mono tabular-nums">
                      {dashboard.pendingCollection}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40">
                      ACTION QUEUE
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-tight">
                    Sealed at loading dock awaiting authorized carrier custody.
                  </p>
                </div>

                {/* Stage 3: In Transit to CBWTF */}
                <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden group hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="font-bold text-[10px] uppercase tracking-widest text-blue-400">
                      03. GPS CORRIDOR TRANSIT
                    </span>
                    <Truck className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-blue-400 font-mono tabular-nums">
                      {dashboard.inTransit}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Active Vans
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    En route to CBWTF under live satellite geofence watch.
                  </p>
                </div>

                {/* Stage 4: SLA Compliance & Closed */}
                <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden group hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="font-bold text-[10px] uppercase tracking-widest text-emerald-400">
                      04. CBWTF DESTRUCTION
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-400 font-mono tabular-nums">
                      {dashboard.complianceRate}%
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40">
                      ON-TIME
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Form-VI certified destruction within 48-hour statutory SLA.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. SPLIT OPERATIONAL MATRIX: LEFT = MANIFEST ROSTER | RIGHT = DIAGNOSTIC WING */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (8 cols): Real-Time Ward Manifest Roster */}
              <div className="lg:col-span-8 bg-[#0B101B]/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        Active Ward Manifest Ledger
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        CPCB FORM-VI
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Immutable operational ledger of serialized clinical waste consignments.
                    </p>
                  </div>
                  <Link
                    href="/waste-batches"
                    className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <span>EXPLORE ALL BATCHES</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {dashboard.recentBatches && dashboard.recentBatches.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-widest font-mono text-[10px]">
                          <th className="px-4 py-3.5">Manifest ID</th>
                          <th className="px-4 py-3.5">CPCB Stream</th>
                          <th className="px-4 py-3.5">Origin Ward / Unit</th>
                          <th className="px-4 py-3.5 text-right">Gross Mass</th>
                          <th className="px-4 py-3.5">Custody State</th>
                          <th className="px-4 py-3.5 text-right">Dossier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-mono">
                        {dashboard.recentBatches.slice(0, 8).map((batch) => (
                          <tr key={batch.id} className="hover:bg-slate-900/50 transition-colors group">
                            <td className="px-4 py-3.5 font-bold text-white">
                              <Link
                                href={`/waste-batches/${batch.id}`}
                                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
                              >
                                <span>{batch.wasteId}</span>
                              </Link>
                            </td>
                            <td className="px-4 py-3.5">
                              <CategoryBadge category={batch.category} size="sm" />
                            </td>
                            <td className="px-4 py-3.5 text-slate-300 font-sans font-medium">
                              {batch.department}
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold text-white tabular-nums">
                              {batch.quantity} <span className="text-[10px] text-slate-400">{batch.unit}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              {getStatusBadge(batch.status)}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Link
                                href={`/waste-batches/${batch.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
                              >
                                <span>Inspect</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
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

              {/* Right Column (4 cols): CPCB Stream Distribution & Compliance Alerts */}
              <div className="lg:col-span-4 space-y-6">
                {/* CPCB Statutory Category Distribution */}
                <div className="bg-[#0B101B]/95 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        CPCB Segregation Ratio
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">SCHEDULE I</span>
                  </div>

                  <div className="space-y-3">
                    {dashboard.wasteByCategory && dashboard.wasteByCategory.length > 0 ? (
                      dashboard.wasteByCategory.map((item) => {
                        const cat = categoryMap.get(item.categoryId);
                        return (
                          <div key={item.categoryId} className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                            <CategoryBadge category={cat} name={cat?.name || 'Stream'} size="sm" />
                            <span className="text-xs font-mono font-bold text-white tabular-nums">
                              {item._count} <span className="text-[10px] text-slate-500 font-normal">bags</span>
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500 py-4 text-center font-mono">
                        NO CATEGORY LOGS FOUND
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Statutory Standard:</span>
                    <span className="text-cyan-400 font-bold">CPCB 2016 4-Color</span>
                  </div>
                </div>

                {/* SLA Delay Alert Callout if Violations Exist */}
                {dashboard.delayed > 0 ? (
                  <div className="rounded-xl border border-red-500/50 bg-red-950/20 p-5 space-y-2 shadow-xl">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-xs font-mono">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
                      <span>{dashboard.delayed} STATUTORY SLA DELAY NOTICE</span>
                    </div>
                    <p className="text-[11px] text-red-200/80 leading-relaxed">
                      Holding duration has exceeded statutory threshold. SPCB enforcement ticket will trigger if collection is not completed.
                    </p>
                    <Link
                      href="/alerts"
                      className="inline-flex items-center gap-1 text-xs font-mono font-bold text-red-400 hover:underline pt-1"
                    >
                      <span>OPEN COMPLIANCE DESK</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex items-center gap-3 shadow-xl">
                    <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold text-emerald-300 uppercase">Zero Statutory Breaches</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">All clinical waste batches compliant with 48h CPCB SLA.</p>
                    </div>
                  </div>
                )}

                {/* Logistics Liaison Card */}
                <div className="bg-[#0B101B]/95 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest">
                      ACCREDITED CBWTF PARTNER
                    </span>
                    <Truck className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">GreenDispose Common Facility</h4>
                    <p className="text-[11px] text-slate-400 font-mono">Plant 02 • Distance 14.2 KM</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>NEXT SCHEDULED ROUTE:</span>
                    <span className="text-emerald-400 font-bold">14:30 IST</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </RoleGuard>
  );
}
