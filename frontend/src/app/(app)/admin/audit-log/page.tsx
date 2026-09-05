'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogApi, getErrorMessage } from '@/lib/api';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { AuditLog } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { formatDateTime } from '@/lib/utils';
import {
  Activity,
  Search,
  RefreshCw,
  Eye,
  Shield,
  Clock,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';

export default function AuditLogPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [entityTypeFilter, setEntityTypeFilter] = React.useState<string>('ALL');
  const [inspectLog, setInspectLog] = React.useState<AuditLog | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const {
    data: logs = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['audit-logs', entityTypeFilter],
    queryFn: () => {
      const params: { entityType?: string } = {};
      if (entityTypeFilter !== 'ALL') params.entityType = entityTypeFilter;
      return auditLogApi.list(params);
    },
    staleTime: 15_000,
  });

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        log.action.toLowerCase().includes(term) ||
        log.entityType.toLowerCase().includes(term) ||
        log.entityId.toLowerCase().includes(term) ||
        (log.actorUserId && log.actorUserId.toLowerCase().includes(term)) ||
        (log.ipAddress && log.ipAddress.toLowerCase().includes(term))
      );
    });
  }, [logs, searchTerm]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('REGISTER')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('UPDATE') || act.includes('MODIFY') || act.includes('EDIT')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (act.includes('APPROVE') || act.includes('VERIFY')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (act.includes('DELETE') || act.includes('DEACTIVATE') || act.includes('SUSPEND')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-neutral-100 text-neutral-700 border-neutral-200';
  };

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Immutable System Audit Log
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Tamper-Proof
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Append-only ledger of critical administrative and security events, actor attributions, and payload metadata.
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
              <span>Refresh Trail</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="card p-4 border-neutral-200 shadow-subtle space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search action, entity ID, actor, IP address..."
                className="pl-9 text-xs"
              />
            </div>

            <div>
              <Select
                options={[
                  { value: 'ALL', label: 'All Entity Types' },
                  { value: 'User', label: 'User Operations' },
                  { value: 'Facility', label: 'Facility Operations' },
                  { value: 'WasteBatch', label: 'Waste Batches' },
                  { value: 'Alert', label: 'Alert Actions' },
                  { value: 'ComplianceRule', label: 'Compliance SLA Tuning' },
                  { value: 'TransportAssignment', label: 'Transport Assignments' },
                ]}
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        {isLoading ? (
          <SkeletonTable rows={6} />
        ) : isError ? (
          <ErrorState
            title="Failed to Retrieve Audit Log"
            message={getErrorMessage(error)}
            onRetry={() => refetch()}
          />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Audit Records"
            description="No administrative audit events recorded matching your query."
          />
        ) : (
          <div className="card overflow-hidden border-neutral-200 shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp (UTC/IST)</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity Type</th>
                    <th className="py-3 px-4">Entity ID</th>
                    <th className="py-3 px-4">Actor User ID</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-mono">
                  {filteredLogs.map((log) => {
                    return (
                      <tr key={log.id} className="hover:bg-neutral-50/70 transition-colors">
                        {/* Timestamp */}
                        <td className="py-3 px-4 text-neutral-700 whitespace-nowrap text-[11px]">
                          <div className="flex items-center gap-1.5 font-sans">
                            <Clock className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                            <span>{formatDateTime(log.occurredAt)}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border font-mono ${getActionBadge(
                              log.action,
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        {/* Entity Type */}
                        <td className="py-3 px-4 font-sans font-medium text-neutral-900 text-xs">
                          {log.entityType}
                        </td>

                        {/* Entity ID */}
                        <td className="py-3 px-4 text-neutral-600 text-[11px]">
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[120px]">{log.entityId}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(log.entityId, log.id)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                              title="Copy Entity ID"
                            >
                              {copiedId === log.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Actor User ID */}
                        <td className="py-3 px-4 text-neutral-500 text-[11px]">
                          {log.actorUserId ? (
                            <span className="truncate max-w-[100px] block" title={log.actorUserId}>
                              {log.actorUserId.substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-neutral-400 italic font-sans">System Automated</span>
                          )}
                        </td>

                        {/* IP Address */}
                        <td className="py-3 px-4 text-neutral-500 text-[11px]">
                          {log.ipAddress || '127.0.0.1'}
                        </td>

                        {/* Payload Action */}
                        <td className="py-3 px-4 text-right font-sans">
                          {log.metadata && Object.keys(log.metadata).length > 0 ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-[10px] h-6 px-2 gap-1 font-sans"
                              onClick={() => setInspectLog(log)}
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">None</span>
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

        {/* Metadata Inspector Modal */}
        {inspectLog && (
          <Dialog
            isOpen={true}
            onClose={() => setInspectLog(null)}
            title={`Audit Metadata: ${inspectLog.action} on ${inspectLog.entityType}`}
            description={`Log ID: ${inspectLog.id} | Occurred at: ${formatDateTime(inspectLog.occurredAt)}`}
            maxWidth="lg"
            footer={
              <Button variant="secondary" size="sm" onClick={() => setInspectLog(null)}>
                Close Inspector
              </Button>
            }
          >
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <span className="text-neutral-500">Entity Type:</span>{' '}
                  <span className="font-semibold text-neutral-800">{inspectLog.entityType}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Entity ID:</span>{' '}
                  <span className="font-mono text-neutral-800 text-[11px]">{inspectLog.entityId}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Actor User:</span>{' '}
                  <span className="font-mono text-neutral-800 text-[11px]">
                    {inspectLog.actorUserId || 'Automated / System'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Client IP:</span>{' '}
                  <span className="font-mono text-neutral-800 text-[11px]">
                    {inspectLog.ipAddress || 'Internal Network'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                    Structured Event Payload
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(JSON.stringify(inspectLog.metadata, null, 2))
                    }
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    Copy JSON
                  </button>
                </div>
                <pre className="p-3 bg-neutral-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto max-h-[300px] leading-relaxed">
                  {JSON.stringify(inspectLog.metadata, null, 2)}
                </pre>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </RoleGuard>
  );
}
