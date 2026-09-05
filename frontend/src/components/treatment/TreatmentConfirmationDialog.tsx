'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { WasteBatch, WasteBatchStatus } from '@/types/models';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import {
  Flame,
  Camera,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export interface TreatmentBatchItem {
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

interface TreatmentConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  batch: TreatmentBatchItem | null;
  onSuccess?: (updatedBatch: WasteBatch) => void;
}

type TreatmentState = 'INPUT' | 'CONFIRMING' | 'SUCCESS' | 'ERROR';

const PHOTO_PRESETS = [
  {
    label: 'Autoclave Destruction Cycle Log',
    url: 'https://storage.biotrack.in/treatment/autoclave-cycle-verification.jpg',
  },
  {
    label: 'High-Temp Incinerator Burn Record',
    url: 'https://storage.biotrack.in/treatment/incinerator-destruction-log.jpg',
  },
  {
    label: 'Hydroclave & Shredder Readout Proof',
    url: 'https://storage.biotrack.in/treatment/hydroclave-shredder-proof.jpg',
  },
];

export function TreatmentConfirmationDialog({
  isOpen,
  onClose,
  batch,
  onSuccess,
}: TreatmentConfirmationDialogProps) {
  const { user, isTreatmentStaff, isSuperAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  const [state, setState] = React.useState<TreatmentState>('INPUT');
  const [photoUrl, setPhotoUrl] = React.useState('');
  const [certified, setCertified] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [closedBatch, setClosedBatch] = React.useState<WasteBatch | null>(null);

  // Initialize or reset state
  React.useEffect(() => {
    if (isOpen) {
      setState('INPUT');
      setPhotoUrl(PHOTO_PRESETS[0].url);
      setCertified(false);
      setErrorMessage(null);
      setClosedBatch(null);
    }
  }, [isOpen, batch?.id]);

  const canConfirm = (isTreatmentStaff || isSuperAdmin) && batch?.status === 'RECEIVED';

  // Treatment Confirmation Mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!batch) throw new Error('No batch selected for treatment');
      if (!photoUrl.trim()) throw new Error('Destruction proof photo URL is required');

      const lat = user?.facility?.latitude ?? 19.2183;
      const lng = user?.facility?.longitude ?? 72.9781;

      // Note: Strictly no notes field sent here as backend ConfirmTreatmentDto only accepts photoUrl, latitude, longitude
      return batchesApi.confirmTreatment(batch.id, {
        photoUrl: photoUrl.trim(),
        latitude: lat,
        longitude: lng,
      });
    },
    onMutate: () => {
      setState('CONFIRMING');
      setErrorMessage(null);
    },
    onSuccess: (updatedBatch) => {
      setState('SUCCESS');
      setClosedBatch(updatedBatch);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['waste-batches', batch?.id] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches', batch?.id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'facility'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

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
        if (state !== 'CONFIRMING') onClose();
      }}
      title="Confirm Treatment & Destruction"
      description="Irreversible statutory closure of biomedical waste batch in the CPCB compliance ledger."
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
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
              Current: {batch.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-neutral-600">
            <div>
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Quantity for Destruction</span>
              <span className="font-bold text-neutral-900 text-sm">
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
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Executing Facility</span>
              <span className="font-semibold text-neutral-800 truncate block">
                {user?.facility?.name || 'Authorized CBWTF'}
              </span>
            </div>
          </div>
        </div>

        {/* Warning Callout: High Friction */}
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-bold">Irreversible Statutory Action</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Confirming treatment transitions this batch through <code>TREATED</code> and permanently archives it as <code>VERIFIED_CLOSED</code>. This cannot be undone.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {state === 'ERROR' && errorMessage && (
          <Alert
            variant="danger"
            title="Treatment Confirmation Failed"
            onDismiss={() => setErrorMessage(null)}
          >
            <p className="text-xs">{errorMessage}</p>
          </Alert>
        )}

        {/* Success Alert */}
        {state === 'SUCCESS' && closedBatch && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-950">
                  Treatment Confirmed & Batch Closed
                </h4>
                <p className="text-xs text-emerald-800">
                  The destruction cycle has been certified. The manifest has been marked as <strong>VERIFIED_CLOSED</strong> in the CPCB compliance ledger.
                </p>
              </div>
            </div>

            <div className="bg-white/80 rounded-lg p-3 border border-emerald-200 text-xs grid grid-cols-2 gap-2 text-neutral-700">
              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-semibold">Authoritative Final Status</span>
                <span className="font-bold text-emerald-700">{closedBatch.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block uppercase font-semibold">Destruction Proof</span>
                <a
                  href={photoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-primary hover:underline truncate block"
                >
                  View Verified Proof Photo
                </a>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Link
                href={`/waste-batches/${batch.id}`}
                className="btn btn-sm btn-secondary text-xs inline-flex items-center gap-1"
                onClick={onClose}
              >
                <span>View Final Ledger & Certificate</span>
                <ExternalLink className="w-3 h-3 text-neutral-400" />
              </Link>
              <Button variant="primary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Input & Verification Form */}
        {state !== 'SUCCESS' && (
          <div className="space-y-4">
            {/* Destruction Photo Proof Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-neutral-600" />
                  <span>Destruction Proof Photo URL (Required)</span>
                </span>
                <span className="text-[11px] font-normal text-neutral-400">
                  Must point to plant autoclave or incinerator log
                </span>
              </label>

              <Input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://storage.biotrack.in/treatment/..."
                className="font-mono text-xs"
                required
              />

              {/* Photo Presets for Operator Ease */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase mr-1">
                  Verified Presets:
                </span>
                {PHOTO_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setPhotoUrl(preset.url)}
                    className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                      photoUrl === preset.url
                        ? 'bg-purple-50 border-purple-300 text-purple-700 font-semibold'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Certification Checkbox */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={certified}
                  onChange={(e) => setCertified(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4"
                />
                <div className="text-xs text-neutral-700 leading-snug">
                  <span className="font-semibold text-neutral-900 block">
                    Statutory Operator Certification
                  </span>
                  <span>
                    I confirm that I have witnessed or verified the physical destruction/autoclaving of this batch at {user?.facility?.name || 'this facility'} under CPCB Biomedical Waste Management Rules.
                  </span>
                </div>
              </label>
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
              disabled={state === 'CONFIRMING'}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => confirmMutation.mutate()}
              disabled={state === 'CONFIRMING' || !canConfirm || !photoUrl.trim() || !certified}
              className="gap-2 font-semibold shadow-xs"
            >
              {state === 'CONFIRMING' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Closing Manifest...</span>
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4" />
                  <span>Confirm Destruction & Close</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
