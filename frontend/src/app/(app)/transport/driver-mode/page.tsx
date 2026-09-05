'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transportApi } from '@/lib/api';
import { useGeolocation } from '@/hooks/useGeolocation';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Truck,
  QrCode,
  MapPin,
  Building2,
  Navigation,
  Clock,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
} from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export default function DriverModePage() {
  const queryClient = useQueryClient();

  const {
    data: assignment,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['transport', 'my-assignment'],
    queryFn: transportApi.myAssignment,
    staleTime: 10_000,
    refetchInterval: 15_000, // Background poll every 15s for active driver instructions
  });

  // Query recent GPS pings for this assignment
  const { data: pings = [], refetch: refetchPings } = useQuery({
    queryKey: ['gps-pings', assignment?.id],
    queryFn: () => (assignment?.id ? transportApi.getPings(assignment.id) : Promise.resolve([])),
    enabled: Boolean(assignment?.id),
    refetchInterval: 15_000,
  });

  // Background GPS Telemetry Watcher (30s throttled dispatch)
  const {
    coords,
    lastPingAt,
    permissionState,
    error: geoError,
    isSending,
    sendGpsPing,
  } = useGeolocation({
    enabled: Boolean(assignment && assignment.status === 'IN_PROGRESS'),
    transportAssignmentId: assignment?.id,
    pingIntervalMs: 30_000,
  });

  const handleManualPing = async () => {
    if (coords && assignment?.id) {
      await sendGpsPing(coords.latitude, coords.longitude);
      refetchPings();
      queryClient.invalidateQueries({ queryKey: ['transport', 'my-assignment'] });
    }
  };

  return (
    <RoleGuard allowedRoles={['TRANSPORT_PERSONNEL', 'SUPER_ADMIN']}>
      <div className="max-w-2xl mx-auto space-y-5 pb-12">
        {/* Top In-Cabin HUD Status Bar (design.md §18.6) */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Assigned Van
              </p>
              <p className="text-base font-black text-neutral-900 font-mono tracking-tight">
                {assignment?.vehicle?.registrationNumber || 'No Vehicle Linked'}
              </p>
              {assignment?.vehicle?.type && (
                <span className="text-[11px] text-neutral-500 font-medium">
                  {assignment.vehicle.type}
                </span>
              )}
            </div>
          </div>

          {/* Real-time GPS Indicator */}
          <div className="flex items-center gap-2">
            {permissionState === 'denied' ? (
              <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>GPS Denied</span>
              </div>
            ) : coords ? (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span>GPS Lock Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-neutral-100 text-neutral-600 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold">
                <Radio className="w-4 h-4 text-neutral-400 animate-spin" />
                <span>Acquiring Lock...</span>
              </div>
            )}
          </div>
        </div>

        {/* GPS Permission Warning if applicable */}
        {geoError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{geoError}</span>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : isError ? (
          <ErrorState
            error={error}
            title="Unable to load driver assignment"
            onRetry={() => refetch()}
          />
        ) : assignment ? (
          <>
            {/* Mission Overview Card */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold text-primary bg-primary-subtle px-2.5 py-1 rounded-full border border-primary/20 uppercase tracking-wider">
                    Active Transit Run
                  </span>
                  <h2 className="text-xl font-bold text-neutral-900 mt-2">
                    CBWTF Delivery Run
                  </h2>
                </div>
                <Badge variant="pending" withIcon className="text-xs font-bold uppercase">
                  {assignment.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              {/* Destination Facility Info */}
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Destination Facility</span>
                </div>
                <p className="text-base font-bold text-neutral-900">
                  {assignment.expectedFacility?.name || 'Treatment Facility'}
                </p>
                <p className="text-xs text-neutral-600 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
                  <span>{assignment.expectedFacility?.address || 'Designated industrial zone'}</span>
                </p>
                {assignment.expectedFacility?.geofenceRadiusM && (
                  <p className="text-[11px] text-neutral-400 font-medium">
                    Gate Geofence Boundary: {assignment.expectedFacility.geofenceRadiusM} meters
                  </p>
                )}
              </div>

              {/* Manifest Batch Info */}
              {assignment.wasteBatch && (
                <div className="space-y-3 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Manifest Bag On Board
                    </span>
                    <Link
                      href={`/waste-batches/${assignment.wasteBatch.id}`}
                      className="font-mono text-xs font-bold text-primary bg-primary-subtle px-2 py-0.5 rounded hover:underline"
                    >
                      {assignment.wasteBatch.wasteId}
                    </Link>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={assignment.wasteBatch.category} size="md" />
                      <span className="text-xs font-semibold text-neutral-700">
                        {assignment.wasteBatch.department}
                      </span>
                    </div>
                    <span className="text-base font-black text-neutral-900 font-mono">
                      {assignment.wasteBatch.quantity} {assignment.wasteBatch.unit}
                    </span>
                  </div>
                </div>
              )}

              {/* High-Friction Mobile Touch Actions (design.md §18.6: 56px CTAs) */}
              <div className="space-y-3 pt-2">
                <Link href="/scan" className="block w-full">
                  <Button
                    variant="primary"
                    size="touch"
                    className="w-full justify-center gap-2.5 text-base font-bold shadow-md h-14"
                  >
                    <QrCode className="w-5 h-5" />
                    <span>Scan Waste Bag Onto Van</span>
                  </Button>
                </Link>

                <Link href="/scan" className="block w-full">
                  <Button
                    variant="secondary"
                    size="touch"
                    className="w-full justify-center gap-2.5 text-base font-bold h-14 border-neutral-300 hover:bg-neutral-100"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Report Arrival at CBWTF Gate</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Live GPS Telemetry Status & Pings */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    GPS Telemetry & Waypoints
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleManualPing}
                    disabled={!coords || isSending}
                    isLoading={isSending}
                    className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary-subtle"
                  >
                    <Send className="w-3 h-3" />
                    <span>Ping Now</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      refetch();
                      refetchPings();
                    }}
                    className="h-7 px-2 text-[11px] text-neutral-500"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Current Device Coordinates */}
              {coords && (
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/80 text-xs grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
                      Current Lat/Lng
                    </span>
                    <span className="font-mono font-bold text-neutral-800">
                      {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
                      Last Ingest Dispatched
                    </span>
                    <span className="text-neutral-700 font-medium">
                      {lastPingAt ? formatRelative(lastPingAt) : 'Ready to ping'}
                    </span>
                  </div>
                </div>
              )}

              {/* Telemetry Ping History */}
              {pings.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block mb-1">
                    Recent Telemetry Logs ({pings.length})
                  </span>
                  {pings.slice(0, 5).map((ping) => (
                    <div
                      key={ping.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 last:border-0"
                    >
                      <div className="font-mono text-neutral-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>
                          {ping.latitude.toFixed(5)}°N, {ping.longitude.toFixed(5)}°E
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelative(ping.recordedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500 py-2">
                  No automated GPS pings recorded yet for this transit run.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 bg-white rounded-2xl border border-neutral-200 shadow-xs">
            <EmptyState
              icon={Truck}
              title="No active transport run"
              description="You do not currently have an active biomedical waste assignment assigned to your account. Stand by for vehicle dispatch."
            />
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
