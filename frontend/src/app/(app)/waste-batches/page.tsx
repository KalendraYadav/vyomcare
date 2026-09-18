'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { batchesApi, categoriesApi } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Plus,
  Search,
  Filter,
  Printer,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Package,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Radio,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { WasteBatchStatus } from '@/types/models';

const STATUS_FILTERS: Array<{ label: string; value: WasteBatchStatus | 'ALL' }> = [
  { label: 'ALL CONSIGNMENTS', value: 'ALL' },
  { label: 'REGISTERED', value: 'REGISTERED' },
  { label: 'QR ASSIGNED', value: 'QR_ASSIGNED' },
  { label: 'COLLECTED', value: 'COLLECTED' },
  { label: 'IN TRANSIT', value: 'IN_TRANSIT' },
  { label: 'RECEIVED', value: 'RECEIVED' },
  { label: 'TREATED', value: 'TREATED' },
  { label: 'CLOSED', value: 'VERIFIED_CLOSED' },
];

export default function WasteBatchesDirectoryPage() {
  const router = useRouter();
  const { isHospitalRole, isSuperAdmin } = useCurrentUser();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<WasteBatchStatus | 'ALL'>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>('ALL');
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  // Categories query for filter dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['waste-categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Batches list query with pagination and filters
  const {
    data: batchesData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'waste-batches',
      {
        page: currentPage,
        limit: pageSize,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        categoryId: selectedCategoryId === 'ALL' ? undefined : selectedCategoryId,
      },
    ],
    queryFn: () =>
      batchesApi.list({
        page: currentPage,
        limit: pageSize,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        categoryId: selectedCategoryId === 'ALL' ? undefined : selectedCategoryId,
      }),
  });

  const rawItems = batchesData?.items || [];
  const totalItems = batchesData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Client-side search filter by wasteId or department
  const filteredBatches = React.useMemo(() => {
    if (!searchTerm.trim()) return rawItems;
    const q = searchTerm.toLowerCase();
    return rawItems.filter(
      (b) =>
        b.wasteId.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q) ||
        (b.hospital?.name && b.hospital.name.toLowerCase().includes(q))
    );
  }, [rawItems, searchTerm]);

  const canCreateBatch = isHospitalRole || isSuperAdmin;

  const getStatusBadge = (status: WasteBatchStatus) => {
    switch (status) {
      case 'VERIFIED_CLOSED':
      case 'TREATED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {status.replace(/_/g, ' ')}
          </span>
        );
      case 'COLLECTED':
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-blue-300">
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
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300">
            <Clock className="w-3 h-3 text-amber-400" />
            STAGED AT BAY
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* 1. APEX MANIFEST AUTHORITY HEADER */}
      <div className="relative bg-[#0B101B]/95 border border-slate-800 rounded-xl p-5 md:p-6 shadow-2xl overflow-hidden backdrop-blur-md">
        {/* Tactical Corners */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500 pointer-events-none" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 font-sans">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold uppercase">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                CPCB STATUTORY MANIFEST REGISTRY
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-bold">
                {totalItems} Active Form-VI Consignments
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Biomedical Waste Custody Ledger
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Statutory national registry recording serialized barcode handshakes, vehicle transit telemetry, and CBWTF destruction certificates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isFetching ? 'animate-spin' : ''}`} />
              <span>SYNC LEDGER</span>
            </button>

            {canCreateBatch && (
              <button
                type="button"
                onClick={() => router.push('/waste-batches/new')}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black transition-all shadow-lg hover:shadow-cyan-500/25 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ENCODE NEW MANIFEST</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. ADVANCED TACTICAL FILTER & SEARCH CONTROLS */}
      <div className="bg-[#0B101B]/95 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Global Search */}
          <div className="md:col-span-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by Manifest ID (e.g. BMW-2026), Ward, or Hospital..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-4 relative">
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="ALL">ALL CPCB STREAMS (YELLOW, RED, WHITE, BLUE)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.code})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter Reset */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('ALL');
                setSelectedCategoryId('ALL');
                setCurrentPage(1);
              }}
              className="w-full text-center px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:text-white transition-colors"
            >
              RESET FILTERS
            </button>
          </div>
        </div>

        {/* Status Segmentation Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
          {STATUS_FILTERS.map((f) => {
            const isActive = selectedStatus === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setSelectedStatus(f.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. SOVEREIGN ENTERPRISE MANIFEST TABLE */}
      <div className="bg-[#0B101B]/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <SkeletonTable rows={8} cols={6} />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState
              error={error}
              title="Unable to load manifest registry"
              onRetry={() => refetch()}
            />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              icon={Package}
              title="No manifest records match criteria"
              description="Adjust your search keywords, CPCB stream filters, or lifecycle status."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-widest text-[10px]">
                  <th className="px-4 py-3.5">Manifest ID</th>
                  <th className="px-4 py-3.5">CPCB Stream</th>
                  <th className="px-4 py-3.5">Origin Node / Ward</th>
                  <th className="px-4 py-3.5 text-right">Net Mass</th>
                  <th className="px-4 py-3.5">Custody State</th>
                  <th className="px-4 py-3.5">Sealed At</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredBatches.map((batch) => (
                  <tr
                    key={batch.id}
                    className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/waste-batches/${batch.id}`)}
                  >
                    <td className="px-4 py-3.5 font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <span className="text-cyan-400 group-hover:text-cyan-300">
                          {batch.wasteId}
                        </span>
                        {batch.qrCode && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            QR
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <CategoryBadge category={batch.category} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 font-sans">
                      <div className="font-semibold text-white truncate max-w-[200px]">
                        {batch.hospital?.name || 'Healthcare Node'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {batch.department}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-white tabular-nums">
                      {batch.quantity} <span className="text-[10px] text-slate-500">{batch.unit}</span>
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {getStatusBadge(batch.status)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 tabular-nums">
                      {new Date(batch.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/waste-batches/${batch.id}`}
                          className="text-cyan-400 hover:text-cyan-300 text-xs font-bold hover:underline"
                        >
                          Dossier &rarr;
                        </Link>
                        {canCreateBatch && (
                          <Link
                            href={`/waste-batches/${batch.id}/print-qr`}
                            className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                            title="Print sticker"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tactical Pagination Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-bold">{filteredBatches.length}</span> of{' '}
            <span className="text-white font-bold">{totalItems}</span> manifests
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page <strong className="text-white">{currentPage}</strong> of{' '}
              <strong className="text-white">{totalPages}</strong>
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
