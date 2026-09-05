'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert as UiAlert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { ViolationSeverityBadge } from '@/components/compliance/ViolationSeverityBadge';
import { AlertTypeBadge } from '@/components/compliance/AlertTypeBadge';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import {
  Building2,
  ExternalLink,
  ShieldCheck,
  Loader2,
  FileText,
  UserCheck,
} from 'lucide-react';
import { formatRelative, formatDate } from '@/lib/utils';
import { AlertStatus } from '@/types/models';

interface AlertInvestigationDrawerProps {
  alertId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function AlertInvestigationDrawer({
  alertId,
  isOpen,
  onClose,
  onUpdated,
}: AlertInvestigationDrawerProps) {
  const queryClient = useQueryClient();
  const { isSuperAdmin, isGovernmentAuthority } = useCurrentUser();
  const canTriage = isSuperAdmin || isGovernmentAuthority;

  const [triageStatus, setTriageStatus] = React.useState<AlertStatus>('INVESTIGATING');
  const [triageNotes, setTriageNotes] = React.useState('');
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Fetch full alert audit file
  const {
    data: alert,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['alerts', alertId],
    queryFn: () => (alertId ? alertsApi.get(alertId) : Promise.reject('No ID')),
    enabled: isOpen && !!alertId,
    staleTime: 5_000,
  });

  // Pre-fill triage form on load
  React.useEffect(() => {
    if (alert) {
      setTriageStatus(alert.status);
      setTriageNotes(alert.notes || '');
      setFeedback(null);
    }
  }, [alert]);

  // Update alert mutation: PATCH /api/alerts/:id
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!alertId) throw new Error('No alert ID specified');
      return alertsApi.update(alertId, {
        status: triageStatus as 'INVESTIGATING' | 'RESOLVED',
        notes: triageNotes.trim() || undefined,
      });
    },
    onSuccess: (updatedAlert) => {
      setFeedback({
        type: 'success',
        message: `Alert record successfully updated to ${updatedAlert.status}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', alertId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      if (onUpdated) onUpdated();
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        message: getErrorMessage(err),
      });
    },
  });

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="danger" withIcon>OPEN BREACH</Badge>;
      case 'INVESTIGATING':
        return <Badge variant="pending" withIcon>UNDER INVESTIGATION</Badge>;
      case 'RESOLVED':
        return <Badge variant="success" withIcon>RESOLVED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Regulatory Incident Audit File"
      description="Central Pollution Control Board statutory non-compliance ledger and investigation docket."
      footer={
        canTriage && alert && (
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => updateMutation.mutate()}
              isLoading={updateMutation.isPending}
              disabled={updateMutation.isPending}
              className="gap-1.5 font-semibold"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Review...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Update Regulatory Status</span>
                </>
              )}
            </Button>
          </div>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-4 py-2">
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : isError || !alert ? (
        <div className="py-8">
          <ErrorState
            error={error}
            title="Failed to load violation audit file"
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <div className="space-y-5 py-1">
          {/* Feedback alert */}
          {feedback && (
            <UiAlert
              variant={feedback.type === 'success' ? 'success' : 'danger'}
              title={feedback.type === 'success' ? 'Record Updated' : 'Operation Failed'}
              onDismiss={() => setFeedback(null)}
            >
              {feedback.message}
            </UiAlert>
          )}

          {/* Incident Overview Card */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ViolationSeverityBadge severity={alert.severity} size="md" />
                <AlertTypeBadge type={alert.type} size="md" />
              </div>
              {getStatusBadge(alert.status)}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-neutral-200/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Incident Raised At
                </span>
                <span className="font-semibold text-neutral-800">
                  {formatDate(alert.createdAt)}
                </span>
                <span className="text-[11px] text-neutral-500 block">
                  ({formatRelative(alert.createdAt)})
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Resolution Status
                </span>
                {alert.resolvedAt ? (
                  <span className="font-semibold text-emerald-700 block">
                    Resolved {formatDate(alert.resolvedAt)}
                  </span>
                ) : (
                  <span className="font-semibold text-amber-700 block">
                    Pending Regulatory Action
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Associated Waste Batch Card */}
          {alert.wasteBatch ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Associated Manifest Batch
                </span>
                <Link
                  href={`/waste-batches/${alert.wasteBatch.id}`}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Open Full Ledger</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-mono text-sm font-bold text-neutral-900">
                    {alert.wasteBatch.wasteId}
                  </h4>
                  <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-neutral-400" />
                    <span>{alert.wasteBatch.hospital?.name || 'Hospital Facility'}</span>
                  </p>
                </div>
                {alert.wasteBatch.category && (
                  <CategoryBadge category={alert.wasteBatch.category} size="sm" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60">
                <div>
                  <span className="text-[10px] text-neutral-400 block">Quantity</span>
                  <span className="font-bold text-neutral-800">
                    {alert.wasteBatch.quantity} {alert.wasteBatch.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block">Current Batch Status</span>
                  <span className="font-bold text-neutral-800">
                    {alert.wasteBatch.status?.replace(/_/g, ' ') || 'ACTIVE'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-xs text-neutral-500 text-center">
              No specific waste batch directly attached to this system alert.
            </div>
          )}

          {/* Custody Log Snapshot */}
          {alert.wasteBatch?.custodyEvents && alert.wasteBatch.custodyEvents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                <span>Custody Event Audit Chain ({alert.wasteBatch.custodyEvents.length})</span>
              </h4>
              <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white max-h-48 overflow-y-auto">
                {alert.wasteBatch.custodyEvents.map((evt) => (
                  <div key={evt.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-neutral-800 block">
                        {evt.eventType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(evt.occurredAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {evt.toUser && ` • Actor: ${evt.toUser.name}`}
                      </span>
                    </div>
                    {evt.notes && (
                      <span className="text-[11px] text-neutral-500 max-w-[140px] truncate" title={evt.notes}>
                        {evt.notes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regulatory Triage / Resolution Workflow */}
          {canTriage ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>Regulatory Triage & Resolution Docket</span>
              </h4>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-700 block">
                  Statutory Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['OPEN', 'INVESTIGATING', 'RESOLVED'] as AlertStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTriageStatus(st)}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                        triageStatus === st
                          ? st === 'RESOLVED'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : st === 'INVESTIGATING'
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-red-50 border-red-300 text-red-800'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block">
                  Regulatory Finding & Auditor Notes
                </label>
                <textarea
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  placeholder="Record root-cause inquiry, driver interview, or corrective action..."
                  rows={3}
                  className="w-full text-xs rounded-lg border border-neutral-200 p-2.5 focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-neutral-400">
                  Notes are permanently recorded on this incident record for compliance audit trails.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-2 text-xs">
              <h4 className="font-bold text-neutral-800 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-neutral-500" />
                <span>Auditor Findings</span>
              </h4>
              <p className="text-neutral-600">
                {alert.notes || 'No auditor investigation notes recorded for this incident yet.'}
              </p>
              <p className="text-[11px] text-neutral-400 pt-1">
                Only State Pollution Control Board officers and BioTrack Super Admins are authorized to resolve regulatory violations.
              </p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
