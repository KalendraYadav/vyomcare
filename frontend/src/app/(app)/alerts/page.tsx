'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ViolationSeverityBadge } from '@/components/compliance/ViolationSeverityBadge';
import { AlertTypeBadge } from '@/components/compliance/AlertTypeBadge';
import { AlertInvestigationDrawer } from '@/components/compliance/AlertInvestigationDrawer';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { formatDate, formatRelative } from '@/lib/utils';
import { AlertSeverity, AlertStatus, AlertType } from '@/types/models';
import { useSocket } from '@/hooks/useSocket';

type StatusTab = 'ALL' | 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export default function AlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkedAlertId = searchParams.get('id');

  const { isSuperAdmin, isGovernmentAuthority, user } = useCurrentUser();
  useSocket(); // Real-time Socket.IO alert subscriptions

  // Filter states
  const [activeTab, setActiveTab] = React.useState<StatusTab>('OPEN');
  const [selectedSeverity, setSelectedSeverity] = React.useState<string>('ALL');
  const [selectedType, setSelectedType] = React.useState<string>('ALL');

  // Investigation drawer state
  const [activeAlertId, setActiveAlertId] = React.useState<string | null>(deepLinkedAlertId);

  React.useEffect(() => {
    if (deepLinkedAlertId) {
      setActiveAlertId(deepLinkedAlertId);
    }
  }, [deepLinkedAlertId]);

  // Query alerts list
  const {
    data: alertsData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'alerts',
      {
        status: activeTab === 'ALL' ? undefined : activeTab,
        severity: selectedSeverity === 'ALL' ? undefined : (selectedSeverity as AlertSeverity),
        type: selectedType === 'ALL' ? undefined : (selectedType as AlertType),
      },
    ],
    queryFn: () =>
      alertsApi.list({
        status: activeTab === 'ALL' ? undefined : (activeTab as AlertStatus),
        severity: selectedSeverity === 'ALL' ? undefined : (selectedSeverity as AlertSeverity),
        type: selectedType === 'ALL' ? undefined : (selectedType as AlertType),
        limit: 50,
      }),
    staleTime: 10_000,
  });

  const alerts = alertsData?.items || [];

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="danger" withIcon>OPEN BREACH</Badge>;
      case 'INVESTIGATING':
        return <Badge variant="pending" withIcon>INVESTIGATING</Badge>;
      case 'RESOLVED':
        return <Badge variant="success" withIcon>RESOLVED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const handleOpenAlert = (id: string) => {
    setActiveAlertId(id);
    router.replace(`/alerts?id=${id}`, { scroll: false });
  };

  const handleCloseDrawer = () => {
    setActiveAlertId(null);
    router.replace('/alerts', { scroll: false });
  };

  return (
    <RoleGuard
      allowedRoles={[
        'GOVERNMENT_AUTHORITY',
        'SUPER_ADMIN',
        'HOSPITAL_ADMIN',
        'TREATMENT_FACILITY_STAFF',
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Regulatory Alerts & Violation Desk
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                CPCB Statutory Audit Desk
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Active hazardous waste incidents, statutory 48-hour SLA breaches, unauthorized route deviations, and triage dockets.
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
              <span className="hidden sm:inline">Refresh Incidents</span>
            </Button>

            {(isGovernmentAuthority || isSuperAdmin) && (
              <Link href="/admin/compliance-rules">
                <Button variant="primary" size="md" className="gap-1.5 font-medium shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Configure SLAs</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: 'OPEN', label: 'Open Breaches', count: alertsData?.total },
                  { key: 'INVESTIGATING', label: 'Under Investigation' },
                  { key: 'RESOLVED', label: 'Resolved Tickets' },
                  { key: 'ALL', label: 'All Incidents' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === tab.key
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scope Notice for Facility Roles */}
            {!isGovernmentAuthority && !isSuperAdmin && (
              <span className="text-[11px] text-neutral-400 font-medium">
                Showing alerts scoped to {user?.facility?.name || 'your facility'}
              </span>
            )}
          </div>

          {/* Secondary Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-neutral-500 font-semibold">Filters:</span>
            </div>

            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-xs bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1 text-neutral-700 font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">High Severity Only</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="LOW">Low Severity</option>
            </select>

            {/* Alert Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1 text-neutral-700 font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Violation Types</option>
              <option value="DISPOSAL_DELAY">SLA Disposal Delay</option>
              <option value="UNAUTHORIZED_LOCATION">Unauthorized Location</option>
              <option value="ROUTE_DEVIATION">Corridor Deviation</option>
              <option value="MISSING_SCAN">Missing Handover Scan</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : isError ? (
          <ErrorState
            error={error}
            title="Unable to load incident dockets"
            onRetry={() => refetch()}
          />
        ) : alerts.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block rounded-xl border border-neutral-200 bg-white shadow-2xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Incident Type</th>
                    <th className="px-4 py-3">Affected Batch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Logged</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {alerts.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenAlert(item.id)}
                      className="hover:bg-neutral-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <ViolationSeverityBadge severity={item.severity} />
                      </td>
                      <td className="px-4 py-3.5">
                        <AlertTypeBadge type={item.type} />
                        {item.notes && (
                          <p className="text-[11px] text-neutral-500 truncate max-w-xs mt-0.5">
                            {item.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {item.wasteBatch ? (
                          <Link
                            href={`/waste-batches/${item.wasteBatchId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-primary font-bold hover:underline flex items-center gap-1"
                          >
                            <span>{item.wasteBatch.wasteId}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-400" />
                          </Link>
                        ) : (
                          <span className="text-neutral-400 italic">System Alert</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-neutral-500">
                        <span>{formatRelative(item.createdAt)}</span>
                        <span className="block text-[10px] text-neutral-400">
                          {formatDate(item.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAlert(item.id);
                          }}
                          className="gap-1 text-xs font-semibold"
                        >
                          <span>Triage Docket</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Incident Cards */}
            <div className="sm:hidden space-y-3">
              {alerts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenAlert(item.id)}
                  className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3 shadow-2xs cursor-pointer active:bg-neutral-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <ViolationSeverityBadge severity={item.severity} />
                        <span className="text-xs font-bold text-neutral-900">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {item.wasteBatch && (
                        <p className="font-mono text-xs font-bold text-primary">
                          {item.wasteBatch.wasteId}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-neutral-600 bg-neutral-50 p-2 rounded-md">
                      {item.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelative(item.createdAt)}</span>
                    </span>
                    <span className="font-semibold text-primary flex items-center gap-0.5">
                      <span>Triage File</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center">
            <EmptyState
              icon={ShieldCheck}
              title="No active regulatory violations"
              description={
                activeTab !== 'ALL'
                  ? `There are currently no incidents with status "${activeTab}".`
                  : 'All tracked healthcare facilities, logistics vehicles, and treatment operations are currently operating in full compliance with CPCB regulations.'
              }
            />
          </div>
        )}

        {/* Investigation Docket Sheet / Drawer */}
        <AlertInvestigationDrawer
          alertId={activeAlertId}
          isOpen={!!activeAlertId}
          onClose={handleCloseDrawer}
          onUpdated={() => {
            refetch();
          }}
        />
      </div>
    </RoleGuard>
  );
}
