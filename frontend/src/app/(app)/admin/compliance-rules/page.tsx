'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { EditComplianceRuleDialog } from '@/components/compliance/EditComplianceRuleDialog';
import {
  ShieldCheck,
  Clock,
  Edit,
  RefreshCw,
  Layers,
  Scale,
} from 'lucide-react';
import { formatDateShort } from '@/lib/utils';
import { ComplianceRule } from '@/types/models';
import { useCurrentUser } from '@/stores/authStore';

export default function ComplianceRulesPage() {
  const { isSuperAdmin, isGovernmentAuthority } = useCurrentUser();
  const canEdit = isSuperAdmin || isGovernmentAuthority;

  const [editingRule, setEditingRule] = React.useState<ComplianceRule | null>(null);

  const {
    data: rules = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['compliance-rules'],
    queryFn: complianceApi.list,
    staleTime: 30_000,
  });

  return (
    <RoleGuard
      allowedRoles={[
        'GOVERNMENT_AUTHORITY',
        'SUPER_ADMIN',
        'HOSPITAL_ADMIN',
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                SLA Compliance Thresholds
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                CPCB 2016 Bio-medical Waste Rules
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Configure statutory maximum duration limits per waste category and custody stage. Exceeding thresholds automatically logs violation incidents.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Rules</span>
            </Button>
          </div>
        </div>

        {/* Statutory Context Banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 flex items-start gap-3">
          <Scale className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 space-y-1">
            <p className="font-bold">Statutory Rule 8(7) — Central Pollution Control Board (CPCB)</p>
            <p className="text-blue-800 leading-relaxed">
              Untreated biomedical waste shall not be stored beyond a period of <strong>48 hours</strong>. Provided that in case for any reason it becomes necessary to store beyond 48 hours, the authorized facility must take permission of the prescribed authority and ensure that it does not adversely affect human health and environment.
            </p>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : isError ? (
          <ErrorState
            error={error}
            title="Unable to load statutory compliance rules"
            onRetry={() => refetch()}
          />
        ) : rules.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block rounded-xl border border-neutral-200 bg-white shadow-2xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
                    <th className="px-4 py-3">Waste Category</th>
                    <th className="px-4 py-3">Custody Stage</th>
                    <th className="px-4 py-3 text-right">Max Duration Threshold</th>
                    <th className="px-4 py-3">Last Updated</th>
                    {canEdit && <th className="px-4 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        {rule.wasteCategory ? (
                          <div className="flex items-center gap-2">
                            <CategoryBadge category={rule.wasteCategory} size="sm" />
                            <span className="font-mono text-neutral-400 text-[11px]">
                              ({rule.wasteCategory.code})
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-500 italic">Universal Category</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-neutral-800">
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{rule.stage}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-neutral-900 text-sm">
                        <span className="inline-flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{rule.maxDurationHours} Hours</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 whitespace-nowrap">
                        {formatDateShort(rule.updatedAt)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingRule(rule)}
                            className="gap-1.5 text-xs font-semibold"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit SLA</span>
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="sm:hidden space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {rule.wasteCategory && (
                        <CategoryBadge category={rule.wasteCategory} size="sm" />
                      )}
                      <p className="text-xs font-semibold text-neutral-700 mt-1">
                        Stage: {rule.stage}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-neutral-900 block">
                        {rule.maxDurationHours} Hours
                      </span>
                      <span className="text-[10px] text-neutral-400">Max Limit</span>
                    </div>
                  </div>

                  {canEdit && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingRule(rule)}
                      className="w-full gap-1.5 text-xs font-semibold"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Statutory SLA Threshold</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No compliance rules configured"
            description="Compliance rules define statutory hour limits for each category and stage."
          />
        )}

        {/* Edit Rule Dialog */}
        <EditComplianceRuleDialog
          rule={editingRule}
          isOpen={!!editingRule}
          onClose={() => setEditingRule(null)}
          onUpdated={() => {
            refetch();
          }}
        />
      </div>
    </RoleGuard>
  );
}
