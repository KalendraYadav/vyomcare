'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { batchesApi, categoriesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Filter,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { WasteBatchStatus } from '@/types/models';

const STATUS_FILTERS: Array<{ label: string; value: WasteBatchStatus | 'ALL' }> = [
  { label: 'All Batches', value: 'ALL' },
  { label: 'Registered', value: 'REGISTERED' },
  { label: 'QR Assigned', value: 'QR_ASSIGNED' },
  { label: 'Collected', value: 'COLLECTED' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Treated', value: 'TREATED' },
  { label: 'Closed', value: 'VERIFIED_CLOSED' },
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Primary CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Biomedical Waste Batches
          </h1>
          <p className="text-xs text-neutral-500">
            Authoritative registry and chain of custody tracking for hazardous healthcare waste.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          {canCreateBatch && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/waste-batches/new')}
              className="text-xs gap-1.5 font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Batch</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_FILTERS.map((tab) => {
            const isSelected = selectedStatus === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setSelectedStatus(tab.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Category Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400 pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Waste ID (e.g. BMW-2026), Ward, or Facility..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / Directory Card */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
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
              title="Failed to Load Waste Batches"
              message={getErrorMessage(error)}
              onRetry={() => refetch()}
            />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Waste Batches Found"
              description={
                searchTerm || selectedStatus !== 'ALL' || selectedCategoryId !== 'ALL'
                  ? 'No batches match your active filter criteria. Try adjusting or clearing filters.'
                  : 'No waste batches have been logged in the system yet.'
              }
              actionLabel={canCreateBatch ? 'Register First Batch' : undefined}
              onAction={canCreateBatch ? () => router.push('/waste-batches/new') : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Manifest ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Origin / Ward</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Generated At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow key={batch.id} className="hover:bg-neutral-50/80 transition-colors">
                    <TableCell>
                      <Link
                        href={`/waste-batches/${batch.id}`}
                        className="font-mono text-xs font-bold text-primary hover:underline"
                      >
                        {batch.wasteId}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <CategoryBadge category={batch.category} size="sm" />
                    </TableCell>

                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <span className="font-semibold text-neutral-800 block truncate max-w-[200px]">
                          {batch.hospital?.name || 'Healthcare Facility'}
                        </span>
                        <span className="text-neutral-500 text-[11px] block truncate max-w-[200px]">
                          {batch.department}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono font-bold text-xs text-neutral-900">
                        {batch.quantity} {batch.unit}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          batch.status === 'VERIFIED_CLOSED' || batch.status === 'TREATED'
                            ? 'success'
                            : batch.status === 'VIOLATION'
                            ? 'danger'
                            : batch.status === 'IN_TRANSIT' || batch.status === 'COLLECTED'
                            ? 'pending'
                            : 'info'
                        }
                        className="text-[11px] font-semibold"
                      >
                        {batch.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(batch.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/waste-batches/${batch.id}`)}
                          className="h-8 px-2 text-xs"
                          title="View Details & Custody Timeline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="sr-only">View</span>
                        </Button>

                        {isHospitalRole && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/waste-batches/${batch.id}/print-qr`)}
                            className="h-8 px-2 text-xs text-neutral-600 hover:text-neutral-900"
                            title="Print Adhesive QR Label"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="sr-only">Print QR</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && !isError && totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-600">
            <div>
              Showing <span className="font-semibold text-neutral-900">{filteredBatches.length}</span>{' '}
              of <span className="font-semibold text-neutral-900">{totalItems}</span> total batches
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 px-2.5 text-xs gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Button>

              <span className="font-medium text-neutral-800">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 text-xs gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
