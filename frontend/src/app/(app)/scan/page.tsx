'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  ArrivalVerificationDialog,
  ArrivalBatchItem,
} from '@/components/treatment/ArrivalVerificationDialog';
import {
  TreatmentConfirmationDialog,
  TreatmentBatchItem,
} from '@/components/treatment/TreatmentConfirmationDialog';
import {
  QrCode,
  Scan,
  CheckCircle2,
  ShieldCheck,
  Flame,
  Truck,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { ScanResponse } from '@/types/api';
import { CustodyEventType } from '@/types/models';
import { QRScanner } from '@/components/shared/QRScanner';

export default function UniversalScannerPage() {
  const queryClient = useQueryClient();
  const { isCollectionStaff, isTransportPersonnel, isTreatmentStaff, isSuperAdmin } =
    useCurrentUser();

  const [manualCode, setManualCode] = React.useState('');
  const [scanResult, setScanResult] = React.useState<ScanResponse | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = React.useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = React.useState<string | null>(null);

  // Treatment dialog triggers
  const [arrivalDialogBatch, setArrivalDialogBatch] = React.useState<ArrivalBatchItem | null>(null);
  const [treatmentDialogBatch, setTreatmentDialogBatch] = React.useState<TreatmentBatchItem | null>(null);
  const resultCardRef = React.useRef<HTMLDivElement>(null);

  // Scan mutation: POST /api/scan
  const scanMutation = useMutation({
    mutationFn: (codeValue: string) => batchesApi.scan(codeValue),
    onSuccess: (data) => {
      setScanResult(data);
      setActionSuccessMsg(null);
      setActionErrorMsg(null);
      setTimeout(() => {
        resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    },
    onError: (err) => {
      setActionErrorMsg(getErrorMessage(err));
      setScanResult(null);
    },
  });

  // Custody handover mutation: POST /api/waste-batches/:id/custody-events
  const custodyMutation = useMutation({
    mutationFn: ({ batchId, eventType }: { batchId: string; eventType: CustodyEventType }) =>
      batchesApi.custodyHandover(batchId, { eventType }),
    onSuccess: (updatedBatch) => {
      setActionSuccessMsg(`Custody handover recorded successfully. Batch is now ${updatedBatch.status}.`);
      setScanResult(null);
      setManualCode('');
      queryClient.invalidateQueries({ queryKey: ['waste-batches', updatedBatch.id] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
    },
    onError: (err) => {
      setActionErrorMsg(getErrorMessage(err));
    },
  });

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    scanMutation.mutate(manualCode.trim());
  };

  const isPerformingAction = custodyMutation.isPending;
  const canPerformTreatment = isTreatmentStaff || isSuperAdmin;

  return (
    <RoleGuard
      allowedRoles={[
        'COLLECTION_STAFF',
        'TRANSPORT_PERSONNEL',
        'TREATMENT_FACILITY_STAFF',
        'HOSPITAL_ADMIN',
        'HOSPITAL_STAFF',
        'SUPER_ADMIN',
      ]}
    >
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-subtle text-primary border border-primary/20 mb-1">
            <Scan className="w-3.5 h-3.5" />
            <span>Universal QR Scanner</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Chain-of-Custody Barcode Terminal
          </h1>
          <p className="text-xs text-neutral-500">
            Scan or enter adhesive QR labels to advance batch lifecycle according to your operational permissions.
          </p>
        </div>

        {/* Notices */}
        {actionSuccessMsg && (
          <Alert variant="success" title="Success" onDismiss={() => setActionSuccessMsg(null)}>
            {actionSuccessMsg}
          </Alert>
        )}

        {actionErrorMsg && (
          <Alert variant="danger" title="Operation Failed" onDismiss={() => setActionErrorMsg(null)}>
            {actionErrorMsg}
          </Alert>
        )}

        {/* Live Optical QR Camera Scanner */}
        <QRScanner
          onScan={(decodedText) => {
            const trimmed = decodedText.trim();
            setManualCode(trimmed);
            scanMutation.mutate(trimmed);
          }}
          disabled={scanMutation.isPending}
        />

        {/* Manual Barcode Entry Form */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Manual Barcode Entry (Field Fallback)
            </h3>
            <button
              type="button"
              onClick={() => setManualCode('BIOTRACK:WASTE-1001:TEST')}
              className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <QrCode className="w-3 h-3" />
              <span>Fill Sample Code</span>
            </button>
          </div>
          <form onSubmit={handleManualScan} className="flex gap-2">
            <Input
              placeholder="e.g. BIOTRACK:WASTE-1001:A1B2C3D4"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              type="submit"
              variant="primary"
              isLoading={scanMutation.isPending}
              className="flex-shrink-0"
            >
              Verify
            </Button>
          </form>
        </div>

        {/* Scan Result Resolution Card & Contextual Actions */}
        {scanResult && scanResult.batch && (
          <div ref={resultCardRef} className="rounded-xl border border-neutral-200 bg-white p-6 shadow-md space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Scanned Waste Batch
                </span>
                <h3 className="text-lg font-bold text-neutral-900 font-mono">
                  {scanResult.batch.wasteId}
                </h3>
              </div>
              <Badge variant="info">
                {scanResult.batch.status.replace(/_/g, ' ')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Category</span>
                <CategoryBadge category={scanResult.batch.category} size="sm" />
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Quantity</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {scanResult.batch.quantity} {scanResult.batch.unit}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Department</span>
                <span className="font-medium text-neutral-800">{scanResult.batch.department}</span>
              </div>
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Origin</span>
                <span className="font-medium text-neutral-800 truncate block">
                  {scanResult.batch.hospital?.name || 'Hospital Facility'}
                </span>
              </div>
            </div>

            {/* Contextual Action Button based on Role & Status Matrix */}
            <div className="pt-2 space-y-2">
              {isCollectionStaff && scanResult.batch.status === 'QR_ASSIGNED' && (
                <Button
                  variant="primary"
                  size="touch"
                  className="w-full justify-center gap-2 font-bold shadow-xs"
                  isLoading={isPerformingAction}
                  onClick={() =>
                    custodyMutation.mutate({
                      batchId: scanResult.batch.id,
                      eventType: 'COLLECTION_ACCEPTED',
                    })
                  }
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Accept Custody into Collection</span>
                </Button>
              )}

              {isTransportPersonnel && scanResult.batch.status === 'COLLECTED' && (
                <Button
                  variant="primary"
                  size="touch"
                  className="w-full justify-center gap-2 font-bold shadow-xs"
                  isLoading={isPerformingAction}
                  onClick={() =>
                    custodyMutation.mutate({
                      batchId: scanResult.batch.id,
                      eventType: 'TRANSPORT_STARTED',
                    })
                  }
                >
                  <Truck className="w-5 h-5" />
                  <span>Start Transport Run</span>
                </Button>
              )}

              {canPerformTreatment && scanResult.batch.status === 'IN_TRANSIT' && (
                <Button
                  variant="primary"
                  size="touch"
                  className="w-full justify-center gap-2 font-bold shadow-xs"
                  onClick={() => setArrivalDialogBatch(scanResult.batch as ArrivalBatchItem)}
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Verify Gate Arrival (5-Step Check)</span>
                </Button>
              )}

              {canPerformTreatment && scanResult.batch.status === 'RECEIVED' && (
                <Button
                  variant="danger"
                  size="touch"
                  className="w-full justify-center gap-2 font-bold shadow-xs"
                  onClick={() => setTreatmentDialogBatch(scanResult.batch as TreatmentBatchItem)}
                >
                  <Flame className="w-5 h-5" />
                  <span>Confirm Destruction & Close Batch</span>
                </Button>
              )}

              {(scanResult.batch.status === 'TREATED' ||
                scanResult.batch.status === 'VERIFIED_CLOSED') && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center space-y-2">
                  <div className="inline-flex p-2 rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-emerald-950">
                    Treatment Verified & Closed
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    This biomedical waste manifest has completed destruction and is archived in the immutable ledger.
                  </p>
                  <Link
                    href={`/waste-batches/${scanResult.batch.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
                  >
                    <span>Inspect Full Custody Ledger</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              <Button
                variant="secondary"
                size="md"
                className="w-full justify-center text-xs"
                onClick={() => setScanResult(null)}
              >
                Scan Another Bag
              </Button>
            </div>
          </div>
        )}

        {/* 5-Step Arrival Verification Dialog */}
        <ArrivalVerificationDialog
          isOpen={!!arrivalDialogBatch}
          batch={arrivalDialogBatch}
          onClose={() => setArrivalDialogBatch(null)}
          onSuccess={(updated) => {
            setActionSuccessMsg(
              `5-Step Arrival Verification passed! Batch received at gate (Status: ${updated.status}).`
            );
            setScanResult(null);
            setManualCode('');
          }}
          onProceedToTreatment={(updated) => {
            setArrivalDialogBatch(null);
            setTreatmentDialogBatch(updated as TreatmentBatchItem);
          }}
        />

        {/* Treatment Confirmation Dialog */}
        <TreatmentConfirmationDialog
          isOpen={!!treatmentDialogBatch}
          batch={treatmentDialogBatch}
          onClose={() => setTreatmentDialogBatch(null)}
          onSuccess={(updated) => {
            setActionSuccessMsg(
              `Waste destruction confirmed! Batch closed with status ${updated.status}.`
            );
            setScanResult(null);
            setManualCode('');
          }}
        />
      </div>
    </RoleGuard>
  );
}
