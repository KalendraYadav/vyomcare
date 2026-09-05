'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { WasteBatch, WasteBatchStatus } from '@/types/models';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import {
  ShieldCheck,
  UserCheck,
  Building2,
  Tag,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Navigation,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export interface ArrivalBatchItem {
  id: string;
  wasteId: string;
  category?: {
    id: string;
    name: string;
    code?: string;
    colorHex?: string;
  };
  quantity: number;
  unit: string;
  hospital?: {
    id?: string;
    name: string;
  };
  status: WasteBatchStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface ArrivalVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  batch: ArrivalBatchItem | null;
  onSuccess?: (updatedBatch: WasteBatch) => void;
  onProceedToTreatment?: (batch: WasteBatch) => void;
}

type VerificationState = 'READY' | 'VERIFYING' | 'SUCCESS' | 'ERROR';

export function ArrivalVerificationDialog({
  isOpen,
  onClose,
  batch,
  onSuccess,
  onProceedToTreatment,
}: ArrivalVerificationDialogProps) {
  const { user, isTreatmentStaff, isSuperAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  const [state, setState] = React.useState<VerificationState>('READY');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [verifiedBatch, setVerifiedBatch] = React.useState<WasteBatch | null>(null);

  // Coordinates management
  const facilityLat = user?.facility?.latitude ?? 19.2183;
  const facilityLng = user?.facility?.longitude ?? 72.9781;
  const [selectedCoords, setSelectedCoords] = React.useState<{ lat: number; lng: number }>({
    lat: facilityLat,
    lng: facilityLng,
  });
  const [coordsSource, setCoordsSource] = React.useState<'facility' | 'live'>('facility');
  const [liveGpsLoading, setLiveGpsLoading] = React.useState(false);
  const [liveGpsError, setLiveGpsError] = React.useState<string | null>(null);

  // Reset state when opening a new batch
  React.useEffect(() => {
    if (isOpen) {
      setState('READY');
      setErrorMessage(null);
      setVerifiedBatch(null);
      setSelectedCoords({
        lat: user?.facility?.latitude ?? 19.2183,
        lng: user?.facility?.longitude ?? 72.9781,
      });
      setCoordsSource('facility');
      setLiveGpsError(null);
    }
  }, [isOpen, batch?.id, user?.facility]);

  // Client-side preliminary checks for the 5-step protocol
  const userAuthorized = isTreatmentStaff || isSuperAdmin;
  const facilityApproved = user?.facility ? user.facility.status === 'APPROVED' : true;
  
  // Category check: if facility has authorizedCategoryIds, does it include batch category?
  const isCategoryAuthorized = React.useMemo(() => {
    if (!batch?.category?.id || !user?.facility?.authorizedCategoryIds) return true;
    const authIds = user.facility.authorizedCategoryIds;
    if (!Array.isArray(authIds) || authIds.length === 0) return true;
    return authIds.includes(batch.category.id);
  }, [batch?.category?.id, user?.facility?.authorizedCategoryIds]);

  // Handler for live GPS coordinate capture
  const handleCaptureLiveGps = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLiveGpsError('Geolocation is not supported by your browser/device.');
      return;
    }
    setLiveGpsLoading(true);
    setLiveGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setCoordsSource('live');
        setLiveGpsLoading(false);
      },
      (err) => {
        setLiveGpsError(`Device GPS error: ${err.message}. Falling back to registered plant coordinates.`);
        setLiveGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Arrival Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!batch) throw new Error('No batch selected for verification');
      return batchesApi.verifyArrival(batch.id, {
        latitude: Number(selectedCoords.lat),
        longitude: Number(selectedCoords.lng),
      });
    },
    onMutate: () => {
      setState('VERIFYING');
      setErrorMessage(null);
    },
    onSuccess: (updatedBatch) => {
      setState('SUCCESS');
      setVerifiedBatch(updatedBatch);

      // Invalidate queries across the application
      queryClient.invalidateQueries({ queryKey: ['waste-batches', batch?.id] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches', batch?.id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'facility'] });
      queryClient.invalidateQueries({ queryKey: ['transport', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });

      if (onSuccess) {
        onSuccess(updatedBatch);
      }
    },
    onError: (err) => {
      setState('ERROR');
      setErrorMessage(getErrorMessage(err));
    },
  });

  if (!batch) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (state !== 'VERIFYING') onClose();
      }}
      title="5-Step Arrival Verification"
      description="Authoritative gate arrival verification and chain-of-custody transfer to treatment facility."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Batch Overview Header */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-neutral-900">
                {batch.wasteId}
              </span>
              {batch.category && (
                <CategoryBadge category={batch.category} size="sm" />
              )}
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
              Current: {batch.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-neutral-600">
            <div>
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Quantity</span>
              <span className="font-bold text-neutral-900">
                {batch.quantity} {batch.unit}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Origin Hospital</span>
              <span className="font-semibold text-neutral-800 truncate block">
                {batch.hospital?.name || 'Healthcare Facility'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Destination CBWTF</span>
              <span className="font-semibold text-neutral-800 truncate block">
                {user?.facility?.name || 'GreenDispose CBWTF'}
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {state === 'ERROR' && errorMessage && (
          <Alert
            variant="danger"
            title="Verification Rejected by Backend"
            onDismiss={() => setErrorMessage(null)}
          >
            <p className="text-xs">{errorMessage}</p>
            <p className="text-[11px] text-neutral-600 mt-1">
              Please inspect the failure reason above. If this is a geofence error, ensure your coordinates are within the registered plant boundary.
            </p>
          </Alert>
        )}

        {/* Success Alert */}
        {state === 'SUCCESS' && verifiedBatch && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-950">
                  Arrival Verified Successfully
                </h4>
                <p className="text-xs text-emerald-800">
                  The batch has been formally accepted at the gate and recorded in the immutable compliance ledger.
                </p>
              </div>
            </div>

            <div className="bg-white/80 rounded-lg p-3 border border-emerald-200 text-xs grid grid-cols-2 gap-2 text-neutral-700">
              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-semibold">Authoritative Status</span>
                <span className="font-bold text-emerald-700">{verifiedBatch.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-semibold">Gate Checkpoint</span>
                <span className="font-mono text-neutral-800">
                  {selectedCoords.lat.toFixed(4)}°N, {selectedCoords.lng.toFixed(4)}°E
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Link
                href={`/waste-batches/${batch.id}`}
                className="btn btn-sm btn-secondary text-xs inline-flex items-center gap-1"
                onClick={onClose}
              >
                <span>View Full Ledger</span>
                <ExternalLink className="w-3 h-3 text-neutral-400" />
              </Link>
              {onProceedToTreatment && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onProceedToTreatment(verifiedBatch);
                  }}
                  className="gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Proceed to Treatment</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 5-Step Statutory Verification Panel */}
        {state !== 'SUCCESS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Statutory 5-Step Check Breakdown</span>
              </h4>
              <span className="text-[10px] font-medium text-neutral-400">
                Authoritative validation executed server-side
              </span>
            </div>

            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white overflow-hidden text-xs">
              {/* 1. User Authorization */}
              <div className="p-3.5 flex items-start gap-3">
                <div
                  className={`p-1.5 rounded-md ${
                    userAuthorized
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">
                      1. User Authorization
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        userAuthorized ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {userAuthorized ? 'Authorized' : 'Role Mismatch'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Operator: {user?.name} ({user?.role.replace(/_/g, ' ')})
                  </p>
                </div>
              </div>

              {/* 2. Facility Approval */}
              <div className="p-3.5 flex items-start gap-3">
                <div
                  className={`p-1.5 rounded-md ${
                    facilityApproved
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">
                      2. Treatment Facility Registration
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        facilityApproved ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {user?.facility?.status || 'Active Facility'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Assigned: {user?.facility?.name || 'Registered CBWTF Unit'}
                  </p>
                </div>
              </div>

              {/* 3. Category Authorization */}
              <div className="p-3.5 flex items-start gap-3">
                <div
                  className={`p-1.5 rounded-md ${
                    isCategoryAuthorized
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">
                      3. Category Authorization
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        isCategoryAuthorized ? 'text-emerald-700' : 'text-amber-600'
                      }`}
                    >
                      {isCategoryAuthorized ? 'Authorized Type' : 'Authorization Notice'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Category: {batch.category?.name || 'Biomedical Waste'}. Verified against facility license.
                  </p>
                  {!isCategoryAuthorized && (
                    <div className="mt-1.5 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Warning: This waste category may not be in this facility&apos;s authorized schedule. Backend will validate strictly.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Geofence Proximity */}
              <div className="p-3.5 flex items-start gap-3">
                <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">
                      4. Gate Geofence Proximity
                    </span>
                    <span className="text-[11px] font-bold text-blue-700">
                      Radius: {user?.facility?.geofenceRadiusM || 300}m
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    The backend verifies coordinates against the registered facility polygon.
                  </p>

                  {/* Coordinate Source Selector */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCoords({ lat: facilityLat, lng: facilityLng });
                        setCoordsSource('facility');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        coordsSource === 'facility'
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      Facility Gate Point ({facilityLat.toFixed(4)}, {facilityLng.toFixed(4)})
                    </button>

                    <button
                      type="button"
                      onClick={handleCaptureLiveGps}
                      disabled={liveGpsLoading}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border inline-flex items-center gap-1.5 transition-colors ${
                        coordsSource === 'live'
                          ? 'bg-blue-50 border-blue-300 text-blue-800'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      {liveGpsLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Navigation className="w-3 h-3" />
                      )}
                      <span>
                        {coordsSource === 'live'
                          ? `Live GPS (${selectedCoords.lat.toFixed(4)}, ${selectedCoords.lng.toFixed(4)})`
                          : 'Use Live Device GPS'}
                      </span>
                    </button>
                  </div>

                  {liveGpsError && (
                    <p className="text-[11px] text-amber-700">{liveGpsError}</p>
                  )}
                </div>
              </div>

              {/* 5. Time / SLA Compliance */}
              <div className="p-3.5 flex items-start gap-3">
                <div className="p-1.5 rounded-md bg-neutral-100 text-neutral-600">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900">
                      5. Time & SLA Compliance
                    </span>
                    <span className="text-[11px] font-bold text-neutral-700">
                      CPCB 48-Hour Threshold
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Backend evaluates transit duration vs statutory rule. Any delay automatically logs a high-severity alert.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dialog Actions Footer */}
        {state !== 'SUCCESS' && (
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={state === 'VERIFYING'}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => verifyMutation.mutate()}
              disabled={state === 'VERIFYING' || !userAuthorized}
              className="gap-2 font-semibold shadow-xs"
            >
              {state === 'VERIFYING' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying 5-Step Check...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Execute Gate Arrival Verification</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
