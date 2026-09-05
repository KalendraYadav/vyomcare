'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesApi, getErrorMessage } from '@/lib/api';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { PrintableQRLabel } from '@/components/shared/PrintableQRLabel';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Printer,
  ArrowLeft,
  Eye,
  PlusCircle,
  QrCode,
  AlertTriangle,
  Info,
} from 'lucide-react';
import Link from 'next/link';

export default function PrintQrPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [actionError, setActionError] = React.useState<string | null>(null);

  // Fetch waste batch particulars
  const {
    data: batch,
    isLoading: isBatchLoading,
    isError: isBatchError,
    error: batchError,
  } = useQuery({
    queryKey: ['waste-batches', id],
    queryFn: () => batchesApi.get(id),
    enabled: Boolean(id),
  });

  // Mutation to generate QR code if not already assigned
  const generateQrMutation = useMutation({
    mutationFn: () => batchesApi.generateQr(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-batches', id] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
    },
    onError: (err) => {
      setActionError(getErrorMessage(err));
    },
  });

  // Automatically trigger QR generation if batch has no qrCode and is in REGISTERED status
  React.useEffect(() => {
    if (batch && !batch.qrCode && !generateQrMutation.isPending && !generateQrMutation.isSuccess) {
      generateQrMutation.mutate();
    }
  }, [batch]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (isBatchLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-6">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-10 w-3/4 rounded-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isBatchError || !batch) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Waste Batch Not Found</h2>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
          {batchError ? getErrorMessage(batchError) : 'The requested batch identifier does not exist or has been removed.'}
        </p>
        <Button variant="secondary" size="md" onClick={() => router.push('/waste-batches')}>
          Return to Batch Directory
        </Button>
      </div>
    );
  }

  const qrCodeValue = batch.qrCode?.codeValue;

  return (
    <RoleGuard allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN']}>
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        {/* Navigation Breadcrumb (hidden during print) */}
        <div className="no-print space-y-1">
          <Link
            href={`/waste-batches/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Batch Detail</span>
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-subtle text-primary border border-primary/20 mb-1">
                <QrCode className="w-3.5 h-3.5" />
                <span>Thermal Label Station</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Print Adhesive QR Sticker
              </h1>
              <p className="text-xs text-neutral-500">
                Print 4&quot; × 2&quot; adhesive label and affix securely to waste container bag before dispatch.
              </p>
            </div>

            {/* Print Action Button */}
            <Button
              variant="primary"
              size="touch"
              onClick={handlePrint}
              disabled={!qrCodeValue || generateQrMutation.isPending}
              className="gap-2 font-bold shadow-md"
            >
              <Printer className="w-5 h-5" />
              <span>Print Sticker (Thermal Roll)</span>
            </Button>
          </div>
        </div>

        {/* Action Error Notice */}
        {actionError && (
          <div className="no-print">
            <Alert variant="danger" title="QR Code Generation Error" onDismiss={() => setActionError(null)}>
              {actionError}
            </Alert>
          </div>
        )}

        {/* QR Generating State Notice */}
        {generateQrMutation.isPending && (
          <div className="no-print rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex items-center gap-3 text-xs text-indigo-800">
            <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span>Generating cryptographic barcode payload and updating lifecycle status...</span>
          </div>
        )}

        {/* Operational Guideline Notice (hidden in print) */}
        <div className="no-print rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-neutral-800">
              CPCB 2016 Adhesive Barcode Requirement
            </p>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Every biomedical waste bag or container must carry a scannable barcoded label. Ensure the label is affixed on a clean, dry surface with the barcode facing outward for rapid optical verification by collection staff.
            </p>
          </div>
        </div>

        {/* Centered Printable Sticker Preview */}
        <div className="flex flex-col items-center justify-center p-6 bg-neutral-100 rounded-2xl border border-neutral-200 shadow-inner">
          {qrCodeValue ? (
            <PrintableQRLabel batch={batch} codeValue={qrCodeValue} />
          ) : (
            <div className="bg-white p-8 rounded-xl border border-neutral-200 text-center space-y-3 max-w-sm">
              <QrCode className="w-10 h-10 text-neutral-400 mx-auto animate-pulse" />
              <p className="text-xs text-neutral-600 font-medium">
                Ready to assign QR barcode to this registered batch.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => generateQrMutation.mutate()}
                isLoading={generateQrMutation.isPending}
              >
                Generate Barcode
              </Button>
            </div>
          )}
        </div>

        {/* Action Controls (hidden in print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-200">
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(`/waste-batches/${id}`)}
            className="gap-2 text-xs"
          >
            <Eye className="w-4 h-4" />
            <span>View Batch Details & Custody Timeline</span>
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={() => router.push('/waste-batches/new')}
            className="gap-2 text-xs text-neutral-600 hover:text-neutral-900"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Another Batch</span>
          </Button>
        </div>
      </div>
    </RoleGuard>
  );
}
