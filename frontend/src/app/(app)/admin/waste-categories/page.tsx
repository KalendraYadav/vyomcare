'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { WasteCategory } from '@/types/models';
import { CreateWasteCategoryDialog } from '@/components/admin/CreateWasteCategoryDialog';
import { EditWasteCategoryDialog } from '@/components/admin/EditWasteCategoryDialog';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Package,
  PlusCircle,
  Search,
  CheckCircle2,
  RefreshCw,
  Edit,
  Power,
} from 'lucide-react';

export default function WasteCategoriesManagementPage() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useCurrentUser();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<WasteCategory | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<WasteCategory | null>(null);

  const {
    data: categories = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['waste-categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 30_000,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-hub-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-catalog'] });
      setDeactivateTarget(null);
    },
  });

  const filteredCategories = React.useMemo(() => {
    return categories.filter((c) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        (c.description && c.description.toLowerCase().includes(term))
      );
    });
  }, [categories, searchTerm]);

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'GOVERNMENT_AUTHORITY', 'HOSPITAL_ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Waste Category Streams
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {filteredCategories.length} Streams Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Statutory biomedical waste streams defined under CPCB BMW Rules 2016 with standardized color barcodes.
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
                onClick={() => setIsCreateOpen(true)}
                className="gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Category</span>
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="card p-4 border-neutral-200 shadow-subtle">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by code, stream name, description..."
              className="pl-9 text-xs"
            />
          </div>
        </div>

        {/* Categories Table & Cards */}
        {isLoading ? (
          <SkeletonTable rows={4} />
        ) : isError ? (
          <ErrorState
            title="Failed to Load Categories"
            message={getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        ) : filteredCategories.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Categories Found"
            description="No waste streams match your current search query."
            actionLabel={isSuperAdmin ? 'Create New Stream' : undefined}
            onAction={isSuperAdmin ? () => setIsCreateOpen(true) : undefined}
          />
        ) : (
          <div className="card overflow-hidden border-neutral-200 shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Color & Identifier</th>
                    <th className="py-3 px-4">Stream Code</th>
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">CPCB Description</th>
                    <th className="py-3 px-4">Status</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredCategories.map((c) => {
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50/70 transition-colors">
                        {/* Color & Identifier */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-md shadow-xs border border-black/10 flex-shrink-0"
                              style={{ backgroundColor: c.colorCode }}
                            />
                            <span className="font-mono text-[11px] text-neutral-600 font-medium">
                              {c.colorCode}
                            </span>
                          </div>
                        </td>

                        {/* Code */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded text-[11px] border border-neutral-200">
                            {c.code}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-neutral-900 text-xs">{c.name}</span>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4 max-w-sm">
                          <p className="text-neutral-500 text-[11px] truncate leading-relaxed">
                            {c.description || 'Standard CPCB regulatory stream'}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </span>
                        </td>

                        {/* Actions (Super Admin Only) */}
                        {isSuperAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="text-[11px] h-7 px-2.5 gap-1"
                                onClick={() => setEditingCategory(c)}
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[11px] h-7 px-2 text-rose-700 hover:bg-rose-50 border-rose-200"
                                onClick={() => setDeactivateTarget(c)}
                              >
                                <Power className="w-3 h-3" />
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

        {/* Create Dialog */}
        <CreateWasteCategoryDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />

        {/* Edit Dialog */}
        <EditWasteCategoryDialog
          category={editingCategory}
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
        />

        {/* Deactivate Confirmation Dialog */}
        {deactivateTarget && (
          <ConfirmDialog
            isOpen={true}
            onClose={() => setDeactivateTarget(null)}
            onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
            title="Deactivate Waste Category Stream"
            message={`Are you sure you want to deactivate stream "${deactivateTarget.name}" (${deactivateTarget.code})? Existing waste batches in this stream will retain their history, but new batches cannot be registered under this category.`}
            confirmLabel="Deactivate Stream"
            isDestructive={true}
            isLoading={deactivateMutation.isPending}
          />
        )}
      </div>
    </RoleGuard>
  );
}
