'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { MetricCard } from '@/components/shared/MetricCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Building2,
  Truck,
  AlertOctagon,
  ShieldCheck,
  Map,
  ChevronRight,
  Clock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import { AlertSeverity } from '@/types/models';

export default function GovernmentDashboardPage() {
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'government'],
    queryFn: dashboardApi.government,
    staleTime: 15_000,
  });

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'HIGH':
        return <Badge variant="danger" withIcon>HIGH SEVERITY</Badge>;
      case 'MEDIUM':
        return <Badge variant="pending" withIcon>MEDIUM</Badge>;
      case 'LOW':
      default:
        return <Badge variant="info" withIcon>LOW</Badge>;
    }
  };

  return (
    <RoleGuard allowedRoles={['GOVERNMENT_AUTHORITY', 'SUPER_ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                State Pollution Control Radar
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Statutory Regulatory Console
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Statewide real-time hazardous waste surveillance, SLA breach triage, and licensed facility oversight.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/government/map">
              <Button variant="primary" size="md" className="gap-2 font-medium shadow-xs">
                <Map className="w-4 h-4" />
                <span>Live GIS Fleet Radar</span>
              </Button>
            </Link>

            <Link href="/alerts">
              <Button variant="secondary" size="md" className="gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-status-danger" />
                <span>Violation Tickets</span>
              </Button>
            </Link>
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
            <SkeletonTable rows={6} cols={5} />
          </div>
        ) : isError ? (
          <ErrorState
            error={error}
            title="Unable to load regulatory radar"
            onRetry={() => refetch()}
          />
        ) : dashboard ? (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Licensed Facilities"
                value={dashboard.totalFacilities}
                icon={Building2}
                subtitle="Approved hospitals & CBWTFs"
                accentColor="#2563EB"
              />
              <MetricCard
                label="Active Transit Fleet"
                value={dashboard.inTransit}
                icon={Truck}
                subtitle="Live waste batches in transit"
                accentColor="#D97706"
              />
              <MetricCard
                label="Unresolved Violations"
                value={dashboard.openAlerts}
                icon={AlertOctagon}
                subtitle="Open SLA breaches requiring review"
                accentColor="#DC2626"
              />
              <MetricCard
                label="Statewide Compliance"
                value={`${dashboard.overallCompliance}%`}
                icon={ShieldCheck}
                subtitle="Verified closed without breaches"
                accentColor="#16A34A"
              />
            </div>

            {/* Two-Column Section: High-Priority Violations & Licensed Facilities */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Unresolved Alerts Triage Desk (7 cols) */}
              <div className="lg:col-span-7 rounded-xl border border-neutral-200 bg-white shadow-2xs overflow-hidden flex flex-col">
                <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-status-danger" />
                      <span>Active Regulatory Incidents & Violations</span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Statutory time breaches, geofence deviations, and missed scans.
                    </p>
                  </div>
                  <Link
                    href="/alerts"
                    className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                  >
                    <span>Full Inbox</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {dashboard.recentAlerts && dashboard.recentAlerts.length > 0 ? (
                  <div className="overflow-x-auto divide-y divide-neutral-100">
                    {dashboard.recentAlerts.map((alert) => (
                      <div key={alert.id} className="p-4 hover:bg-neutral-50/70 transition-colors flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getSeverityBadge(alert.severity)}
                            <span className="text-xs font-bold text-neutral-900">
                              {alert.type.replace(/_/g, ' ')}
                            </span>
                            {alert.wasteBatch?.wasteId && (
                              <span className="font-mono text-[11px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {alert.wasteBatch.wasteId}
                              </span>
                            )}
                          </div>
                          {alert.notes && (
                            <p className="text-xs text-neutral-600 leading-relaxed">
                              {alert.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                            <Clock className="w-3 h-3" />
                            <span>Raised {formatRelative(alert.createdAt)}</span>
                          </div>
                        </div>

                        <Link
                          href={`/alerts?id=${alert.id}`}
                          className="btn btn-sm btn-secondary text-xs font-medium flex-shrink-0"
                        >
                          <span>Triage</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8">
                    <EmptyState
                      icon={ShieldCheck}
                      title="No active violations"
                      description="All hazardous waste operations across the jurisdiction are currently operating within statutory SLA limits."
                    />
                  </div>
                )}
              </div>

              {/* Licensed Healthcare Facilities Overview (5 cols) */}
              <div className="lg:col-span-5 rounded-xl border border-neutral-200 bg-white shadow-2xs overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span>Registered Facilities</span>
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Licensed hospitals and treatment operators.
                      </p>
                    </div>
                    <Link
                      href="/admin/facilities"
                      className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                    >
                      <span>Directory</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {dashboard.facilities && dashboard.facilities.length > 0 ? (
                      dashboard.facilities.slice(0, 6).map((fac) => (
                        <div key={fac.id} className="p-3.5 hover:bg-neutral-50 transition-colors flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-neutral-900 truncate">{fac.name}</p>
                            <p className="text-[11px] text-neutral-500 truncate flex items-center gap-1 mt-0.5">
                              <span>Reg #{fac.registrationNumber}</span>
                              <span>•</span>
                              <span>{fac.type.replace(/_/g, ' ')}</span>
                            </p>
                          </div>
                          <Badge
                            variant={fac.status === 'APPROVED' ? 'success' : fac.status === 'PENDING' ? 'pending' : 'danger'}
                            size="sm"
                          >
                            {fac.status}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-neutral-500 p-6 text-center">
                        No facilities onboarded yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                  <span>Regulatory oversight under CPCB guidelines</span>
                  <Link href="/admin/compliance-rules" className="text-primary font-semibold hover:underline flex items-center gap-1">
                    <span>Manage SLAs</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </RoleGuard>
  );
}
