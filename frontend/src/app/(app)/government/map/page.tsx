'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { transportApi, facilitiesApi, getErrorMessage } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Dialog } from '@/components/ui/dialog';
import {
  Truck,
  Building2,
  Radio,
  RefreshCw,
  Table as TableIcon,
  Crosshair,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { Facility, TransportAssignment } from '@/types/models';

export default function GovernmentFleetMapPage() {
  const { isConnected } = useSocket();
  const [viewMode, setViewMode] = React.useState<'map' | 'table'>('map');
  const [selectedEntity, setSelectedEntity] = React.useState<{
    type: 'vehicle' | 'facility';
    data: TransportAssignment | Facility;
  } | null>(null);

  // 1. Fetch active shipments with latest GPS telemetry
  const {
    data: activeShipments = [],
    isLoading: isShipmentsLoading,
    isError: isShipmentsError,
    error: shipmentsError,
    refetch: refetchShipments,
    isFetching: isShipmentsFetching,
  } = useQuery({
    queryKey: ['transport', 'active'],
    queryFn: () => transportApi.getActive(),
    refetchInterval: 15_000,
  });

  // 2. Fetch all registered facilities (hospitals & treatment plants)
  const {
    data: facilities = [],
    isLoading: isFacilitiesLoading,
    isError: isFacilitiesError,
    error: facilitiesError,
    refetch: refetchFacilities,
  } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesApi.list(),
    staleTime: 60_000,
  });

  const isLoading = isShipmentsLoading || isFacilitiesLoading;
  const isError = isShipmentsError || isFacilitiesError;
  const error = shipmentsError || facilitiesError;

  // Filter facilities with valid coordinates
  const mappedFacilities = React.useMemo(() => {
    return facilities.filter((f) => f.latitude !== null && f.longitude !== null);
  }, [facilities]);

  // Compute dynamic geographical bounding box for SVG radar canvas
  const bounds = React.useMemo(() => {
    const allLats: number[] = [];
    const allLngs: number[] = [];

    mappedFacilities.forEach((f) => {
      if (f.latitude && f.longitude) {
        allLats.push(f.latitude);
        allLngs.push(f.longitude);
      }
    });

    activeShipments.forEach((s) => {
      const ping = s.gpsPings?.[0];
      if (ping) {
        allLats.push(ping.latitude);
        allLngs.push(ping.longitude);
      }
    });

    // Default bounds (Maharashtra / Central India) if no coordinates available
    if (allLats.length === 0) {
      return { minLat: 18.9, maxLat: 19.4, minLng: 72.8, maxLng: 73.1 };
    }

    const minLat = Math.min(...allLats) - 0.05;
    const maxLat = Math.max(...allLats) + 0.05;
    const minLng = Math.min(...allLngs) - 0.05;
    const maxLng = Math.max(...allLngs) + 0.05;

    return { minLat, maxLat, minLng, maxLng };
  }, [mappedFacilities, activeShipments]);

  // Transform lat/lng to SVG canvas percentage coordinates (0 - 100)
  const projectCoords = React.useCallback(
    (lat: number, lng: number) => {
      const latRange = bounds.maxLat - bounds.minLat || 0.1;
      const lngRange = bounds.maxLng - bounds.minLng || 0.1;

      // Invert Y axis for SVG rendering
      const x = ((lng - bounds.minLng) / lngRange) * 80 + 10;
      const y = ((bounds.maxLat - lat) / latRange) * 75 + 12;

      return { x: Math.max(5, Math.min(95, x)), y: Math.max(8, Math.min(92, y)) };
    },
    [bounds]
  );

  return (
    <RoleGuard allowedRoles={['GOVERNMENT_AUTHORITY', 'SUPER_ADMIN', 'HOSPITAL_ADMIN']}>
      <div className="space-y-6 pb-12">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Statewide GIS Fleet Radar
              </h1>
              <div
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                }`}
              >
                <Radio className={`w-3 h-3 ${isConnected ? 'text-emerald-500 animate-pulse' : ''}`} />
                <span>{isConnected ? 'Telemetry Online' : 'Connecting to Gateway...'}</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Live geospatial radar monitoring hazardous biomedical waste transit corridors, healthcare origin points, and destination CBWTFs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher (WCAG 2.2 Accessible Alternative) */}
            <div className="flex items-center rounded-lg border border-neutral-200 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'map'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Radar View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Accessible Grid</span>
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                refetchShipments();
                refetchFacilities();
              }}
              disabled={isShipmentsFetching}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isShipmentsFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs">
            <span className="text-neutral-400 font-bold uppercase text-[10px] block">
              Active Vans in Transit
            </span>
            <span className="text-xl font-black text-neutral-900 font-mono mt-0.5 block">
              {activeShipments.length}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs">
            <span className="text-neutral-400 font-bold uppercase text-[10px] block">
              Registered Hospitals
            </span>
            <span className="text-xl font-black text-primary font-mono mt-0.5 block">
              {mappedFacilities.filter((f) => f.type === 'HOSPITAL').length}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs">
            <span className="text-neutral-400 font-bold uppercase text-[10px] block">
              Authorized CBWTF Plants
            </span>
            <span className="text-xl font-black text-emerald-600 font-mono mt-0.5 block">
              {mappedFacilities.filter((f) => f.type === 'TREATMENT_FACILITY').length}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs">
            <span className="text-neutral-400 font-bold uppercase text-[10px] block">
              GPS Signal Freshness
            </span>
            <span className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry Stream
            </span>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="h-[520px] rounded-2xl border border-neutral-200 bg-white p-8 flex flex-col items-center justify-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
        ) : isError ? (
          <div className="p-8 bg-white rounded-2xl border border-neutral-200">
            <ErrorState
              title="Failed to Load GIS Telemetry"
              message={getErrorMessage(error)}
              onRetry={() => {
                refetchShipments();
                refetchFacilities();
              }}
            />
          </div>
        ) : viewMode === 'map' ? (
          /* Interactive Vector Radar Canvas */
          <div className="relative rounded-2xl border border-neutral-300 bg-neutral-900 text-white shadow-xl overflow-hidden min-h-[560px] select-none">
            {/* Grid overlay & radar lines */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(#38bdf8 1px, transparent 1px), linear-gradient(to right, #ffffff08 1px, transparent 1px), linear-gradient(to bottom, #ffffff08 1px, transparent 1px)',
                backgroundSize: '32px 32px, 64px 64px, 64px 64px',
              }}
            />

            {/* Canvas Header & Legend */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-neutral-900/90 backdrop-blur-md p-2 px-3 rounded-xl border border-neutral-700 text-[11px]">
              <span className="text-neutral-400 font-bold uppercase text-[10px] mr-1">Legend:</span>
              <span className="flex items-center gap-1 text-blue-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Hospital
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                CBWTF Plant
              </span>
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Active Vehicle
              </span>
            </div>

            {/* SVG Projected Radar Canvas */}
            <svg className="w-full h-[560px] relative z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Route connecting lines (Hospital -> Van -> Destination CBWTF) */}
              {activeShipments.map((shipment) => {
                const ping = shipment.gpsPings?.[0];
                const dest = shipment.expectedFacility;
                if (!ping || !dest || !dest.latitude || !dest.longitude) return null;

                const vanPos = projectCoords(ping.latitude, ping.longitude);
                const destPos = projectCoords(dest.latitude, dest.longitude);

                return (
                  <g key={`route-${shipment.id}`}>
                    <line
                      x1={vanPos.x}
                      y1={vanPos.y}
                      x2={destPos.x}
                      y2={destPos.y}
                      stroke="#f59e0b"
                      strokeWidth="0.4"
                      strokeDasharray="1.2 1.2"
                      opacity="0.75"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Projected HTML Interactive Markers */}
            <div className="absolute inset-0 pointer-events-none">
              {/* 1. Facility Markers */}
              {mappedFacilities.map((fac) => {
                if (!fac.latitude || !fac.longitude) return null;
                const pos = projectCoords(fac.latitude, fac.longitude);
                const isHospital = fac.type === 'HOSPITAL';

                return (
                  <div
                    key={fac.id}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
                    onClick={() => setSelectedEntity({ type: 'facility', data: fac })}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shadow-lg transition-transform group-hover:scale-125 ${
                        isHospital
                          ? 'bg-blue-600 border-white text-white'
                          : 'bg-emerald-600 border-white text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>

                    {/* Hover Tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-neutral-900 border border-neutral-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md z-30">
                      {fac.name} ({fac.type.replace(/_/g, ' ')})
                    </div>
                  </div>
                );
              })}

              {/* 2. Active Transport Vehicle Markers with Radar Pulse */}
              {activeShipments.map((shipment) => {
                const ping = shipment.gpsPings?.[0];
                if (!ping) return null;
                const pos = projectCoords(ping.latitude, ping.longitude);

                return (
                  <div
                    key={shipment.id}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group z-30"
                    onClick={() => setSelectedEntity({ type: 'vehicle', data: shipment })}
                  >
                    {/* Pulsing radar wave */}
                    <span className="absolute -inset-2 rounded-full bg-amber-400/30 animate-ping pointer-events-none" />

                    <div className="relative w-8 h-8 rounded-full bg-amber-500 border-2 border-white text-neutral-950 flex items-center justify-center shadow-xl transition-transform group-hover:scale-125 font-bold">
                      <Truck className="w-4 h-4" />
                    </div>

                    {/* Permanent Vehicle Badge */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-8 whitespace-nowrap bg-neutral-900/90 border border-amber-500/60 text-amber-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                      {shipment.vehicle?.registrationNumber || 'VAN'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Accessible Table Representation (WCAG 2.2 AA) */
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-neutral-200 bg-neutral-50/50">
              <h2 className="text-sm font-bold text-neutral-900">
                Active Vehicle Manifest & Telemetry Registry
              </h2>
            </div>
            <div className="divide-y divide-neutral-200">
              {activeShipments.map((shipment) => {
                const latestPing = shipment.gpsPings?.[0];
                return (
                  <div
                    key={shipment.id}
                    className="p-4 hover:bg-neutral-50 flex flex-wrap items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-neutral-900">
                          {shipment.vehicle?.registrationNumber}
                        </span>
                        <Badge variant="pending" className="text-[10px] uppercase">
                          {shipment.status}
                        </Badge>
                      </div>
                      <p className="text-neutral-500">
                        Driver: <span className="font-semibold text-neutral-700">{shipment.driverUser?.name}</span> •
                        Destination: <span className="font-semibold text-neutral-700">{shipment.expectedFacility?.name}</span>
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      {latestPing ? (
                        <span className="font-mono font-bold text-neutral-800 block">
                          {latestPing.latitude.toFixed(4)}°N, {latestPing.longitude.toFixed(4)}°E
                        </span>
                      ) : (
                        <span className="text-neutral-400 block">No GPS coordinates</span>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedEntity({ type: 'vehicle', data: shipment })}
                        className="text-xs h-7"
                      >
                        Inspect Manifest
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Entity Inspection Dialog */}
        <Dialog
          isOpen={Boolean(selectedEntity)}
          onClose={() => setSelectedEntity(null)}
          title={
            selectedEntity?.type === 'vehicle'
              ? `Vehicle ${((selectedEntity.data as TransportAssignment).vehicle?.registrationNumber || 'Details')}`
              : `Facility: ${(selectedEntity?.data as Facility)?.name}`
          }
          description="Operational details, active custody manifest, and registered coordinates."
          footer={
            <Button variant="secondary" size="sm" onClick={() => setSelectedEntity(null)}>
              Close
            </Button>
          }
        >
          {selectedEntity?.type === 'vehicle' && (
            <div className="space-y-4 py-2 text-xs">
              {/* Vehicle Particulars */}
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Registration Number:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {(selectedEntity.data as TransportAssignment).vehicle?.registrationNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Driver in Charge:</span>
                  <span className="font-semibold text-neutral-800">
                    {(selectedEntity.data as TransportAssignment).driverUser?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Destination Plant:</span>
                  <span className="font-semibold text-neutral-800">
                    {(selectedEntity.data as TransportAssignment).expectedFacility?.name}
                  </span>
                </div>
              </div>

              {/* Manifest Batch Info */}
              {(selectedEntity.data as TransportAssignment).wasteBatch && (
                <div className="space-y-2 border-t border-neutral-100 pt-3">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                    Manifest Cargo
                  </span>
                  <div className="p-3 bg-primary-subtle/30 rounded-lg border border-primary/20 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-primary block">
                        {(selectedEntity.data as TransportAssignment).wasteBatch?.wasteId}
                      </span>
                      <span className="text-[11px] text-neutral-600">
                        {(selectedEntity.data as TransportAssignment).wasteBatch?.department}
                      </span>
                    </div>
                    <span className="font-bold text-neutral-900">
                      {(selectedEntity.data as TransportAssignment).wasteBatch?.quantity}{' '}
                      {(selectedEntity.data as TransportAssignment).wasteBatch?.unit}
                    </span>
                  </div>

                  <Link
                    href={`/waste-batches/${(selectedEntity.data as TransportAssignment).wasteBatch?.id}`}
                    className="inline-flex items-center gap-1 text-primary font-semibold text-xs hover:underline pt-1"
                  >
                    <span>View Full Waste Manifest Ledger</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {selectedEntity?.type === 'facility' && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Facility Type:</span>
                  <span className="font-bold text-neutral-900">
                    {(selectedEntity.data as Facility).type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Registration Number:</span>
                  <span className="font-mono font-semibold text-neutral-800">
                    {(selectedEntity.data as Facility).registrationNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Status:</span>
                  <Badge variant="success">{(selectedEntity.data as Facility).status}</Badge>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Address
                </span>
                <p className="text-neutral-700">{(selectedEntity.data as Facility).address}</p>
              </div>

              {(selectedEntity.data as Facility).geofenceRadiusM && (
                <div className="flex items-center gap-1.5 text-neutral-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Geofence Boundary: {(selectedEntity.data as Facility).geofenceRadiusM}m</span>
                </div>
              )}
            </div>
          )}
        </Dialog>
      </div>
    </RoleGuard>
  );
}
