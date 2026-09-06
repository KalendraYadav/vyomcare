'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesApi, getErrorMessage } from '@/lib/api';
import { useCurrentUser } from '@/stores/authStore';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { CustodyTimeline } from '@/components/shared/CustodyTimeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Printer,
  QrCode,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Flame,
  AlertTriangle,
  Building2,
  Calendar,
  User,
  Scale,
  RefreshCw,
  Clock,
  Layers,
  Camera,
  AlertOctagon,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { CustodyEventType } from '@/types/models';
import { ConfirmTreatmentDto } from '@/types/api';
import {
  ArrivalVerificationDialog,
  ArrivalBatchItem,
} from '@/components/treatment/ArrivalVerificationDialog';
import {
  TreatmentConfirmationDialog,
  TreatmentBatchItem,
} from '@/components/treatment/TreatmentConfirmationDialog';
import { ViolationSeverityBadge } from '@/components/compliance/ViolationSeverityBadge';
import { AlertTypeBadge } from '@/components/compliance/AlertTypeBadge';

export default function WasteBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const {
    user,
    isSuperAdmin,
    isHospitalRole,
    isCollectionStaff,
    isTransportPersonnel,
    isTreatmentStaff,
  } = useCurrentUser();

  // Action dialog states
  const [actionConfirmOpen, setActionConfirmOpen] = React.useState(false);
  const [arrivalDialogOpen, setArrivalDialogOpen] = React.useState(false);
  const [treatmentDialogOpen, setTreatmentDialogOpen] = React.useState(false);
  const [activeActionType, setActiveActionType] = React.useState<
    'COLLECTION_ACCEPTED' | 'TRANSPORT_STARTED' | 'VERIFY_ARRIVAL' | 'CONFIRM_TREATMENT' | null
  >(null);
  const [actionNotes, setActionNotes] = React.useState('');
  const [treatmentPhotoUrl, setTreatmentPhotoUrl] = React.useState(
    'https://storage.biotrack.in/treatment/autoclave-destruction-log.jpg'
  );
  const [actionFeedback, setActionFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // 1. Fetch Batch Details (authoritative current state)
  const {
    data: batch,
    isLoading: isBatchLoading,
    isError: isBatchError,
    error: batchError,
    refetch: refetchBatch,
  } = useQuery({
    queryKey: ['waste-batches', id],
    queryFn: () => batchesApi.get(id),
    enabled: Boolean(id),
  });

  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    if (batch?.qrCode?.codeValue) {
      QRCode.toDataURL(batch.qrCode.codeValue, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 250,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then((url) => {
          if (isMounted) setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('Failed to generate detail QR code', err);
        });
    } else {
      setQrDataUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [batch?.qrCode?.codeValue]);

  // 2. Fetch Custody History
  const {
    data: history = [],
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['waste-batches', id, 'history'],
    queryFn: () => batchesApi.history(id),
    enabled: Boolean(id),
  });

  // Handover mutation (Collection / Transport)
  const handoverMutation = useMutation({
    mutationFn: (dto: { eventType: CustodyEventType; notes?: string }) =>
      batchesApi.custodyHandover(id, dto),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['waste-batches', id] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches', id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      setActionFeedback({
        type: 'success',
        message: `Custody handover recorded! Batch lifecycle transitioned to ${updated.status}.`,
      });
      setActionConfirmOpen(false);
    },
    onError: (err) => {
      setActionFeedback({ type: 'error', message: getErrorMessage(err) });
    },
  });

  // Verify Arrival mutation (CBWTF Gate)
  const arrivalMutation = useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) =>
      batchesApi.verifyArrival(id, coords),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['waste-batches', id] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches', id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      setActionFeedback({
        type: 'success',
        message: `CBWTF Gate arrival verified! Batch received (Status: ${updated.status}).`,
      });
      setActionConfirmOpen(false);
    },
    onError: (err) => {
      setActionFeedback({ type: 'error', message: getErrorMessage(err) });
    },
  });

  // Confirm Treatment mutation (Destruction & Closure)
  const treatmentMutation = useMutation({
    mutationFn: (data: ConfirmTreatmentDto) =>
      batchesApi.confirmTreatment(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['waste-batches', id] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches', id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      setActionFeedback({
        type: 'success',
        message: `Waste destruction verified! Batch compliance cycle closed (${updated.status}).`,
      });
      setActionConfirmOpen(false);
    },
    onError: (err) => {
      setActionFeedback({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const isMutating =
    handoverMutation.isPending || arrivalMutation.isPending || treatmentMutation.isPending;

  const handleExecuteAction = () => {
    setActionFeedback(null);
    if (activeActionType === 'COLLECTION_ACCEPTED') {
      handoverMutation.mutate({
        eventType: 'COLLECTION_ACCEPTED',
        notes: actionNotes.trim() || 'Collection accepted at ward pickup point.',
      });
    } else if (activeActionType === 'TRANSPORT_STARTED') {
      handoverMutation.mutate({
        eventType: 'TRANSPORT_STARTED',
        notes: actionNotes.trim() || 'Loaded onto vehicle and transport run commenced.',
      });
    } else if (activeActionType === 'VERIFY_ARRIVAL') {
      const facilityLat = user?.facility?.latitude ?? 19.2183;
      const facilityLng = user?.facility?.longitude ?? 72.9781;
      arrivalMutation.mutate({ latitude: facilityLat, longitude: facilityLng });
    } else if (activeActionType === 'CONFIRM_TREATMENT') {
      const facilityLat = user?.facility?.latitude ?? 19.2183;
      const facilityLng = user?.facility?.longitude ?? 72.9781;
      treatmentMutation.mutate({
        photoUrl: treatmentPhotoUrl.trim() || 'https://storage.biotrack.in/treatment/autoclave-destruction-log.jpg',
        latitude: facilityLat,
        longitude: facilityLng,
      });
    }
  };

  if (isBatchLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6">
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="md:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isBatchError || !batch) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Waste Batch Not Found</h2>
        <p className="text-xs text-neutral-500">
          {batchError
            ? getErrorMessage(batchError)
            : 'The specified batch record could not be retrieved from the compliance ledger.'}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/waste-batches')}>
            Return to Batch Directory
          </Button>
          <Button variant="primary" size="sm" onClick={() => refetchBatch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Determine allowable custody transitions based on current status & user role
  const canPrintQr =
    (isHospitalRole || isSuperAdmin) &&
    (batch.status === 'REGISTERED' || batch.status === 'QR_ASSIGNED');

  const canAcceptCollection =
    (isCollectionStaff || isSuperAdmin) && batch.status === 'QR_ASSIGNED';

  const canStartTransport =
    (isTransportPersonnel || isSuperAdmin) && batch.status === 'COLLECTED';

  const canVerifyArrival =
    (isTreatmentStaff || isSuperAdmin) && batch.status === 'IN_TRANSIT';

  const canConfirmTreatment =
    (isTreatmentStaff || isSuperAdmin) && batch.status === 'RECEIVED';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/waste-batches"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Batch Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              refetchBatch();
              refetchHistory();
            }}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          {canPrintQr && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/waste-batches/${id}/print-qr`)}
              className="text-xs gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sticker</span>
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <Alert
          variant={actionFeedback.type === 'success' ? 'success' : 'danger'}
          title={actionFeedback.type === 'success' ? 'Operation Completed' : 'Operation Error'}
          onDismiss={() => setActionFeedback(null)}
        >
          {actionFeedback.message}
        </Alert>
      )}

      {/* Active Regulatory Non-Compliance Incidents Banner */}
      {batch.alerts && batch.alerts.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50/90 p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 text-red-700 shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-950">
                  Active Regulatory Incident Logged ({batch.alerts.length})
                </h3>
                <p className="text-xs text-red-800">
                  This batch has triggered an open statutory breach alert in the CPCB compliance registry.
                </p>
              </div>
            </div>
            <Link
              href={`/alerts?id=${batch.alerts[0].id}`}
              className="btn btn-sm btn-danger text-xs font-semibold inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Triage In Incident Desk</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-red-200/80 bg-white/90 rounded-xl border border-red-200 overflow-hidden">
            {batch.alerts.map((al) => (
              <div key={al.id} className="p-3 text-xs flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ViolationSeverityBadge severity={al.severity} />
                    <AlertTypeBadge type={al.type} />
                  </div>
                  {al.notes && (
                    <p className="text-neutral-600 text-[11px] pt-0.5">{al.notes}</p>
                  )}
                </div>
                <Link
                  href={`/alerts?id=${al.id}`}
                  className="text-xs font-bold text-primary hover:underline whitespace-nowrap inline-flex items-center gap-1"
                >
                  <span>Docket</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero Banner: Identity & Authoritative Current State (design.md §9, §10, §18.5) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl md:text-2xl font-black tracking-tight text-neutral-900">
                {batch.wasteId}
              </span>
              <CategoryBadge category={batch.category} size="md" />
            </div>
            <p className="text-xs text-neutral-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>{batch.hospital?.name || 'Hospital Origin'}</span>
              <span>•</span>
              <span className="font-medium text-neutral-700">{batch.department}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Current Authoritative Status
            </span>
            <Badge
              variant={
                batch.status === 'VERIFIED_CLOSED' || batch.status === 'TREATED'
                  ? 'success'
                  : batch.status === 'VIOLATION'
                  ? 'danger'
                  : batch.status === 'IN_TRANSIT' || batch.status === 'COLLECTED'
                  ? 'pending'
                  : 'info'
              }
              className="text-xs font-bold px-3 py-1 uppercase"
            >
              {batch.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>

        {/* Highlight Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 text-xs">
          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60">
            <span className="text-neutral-500 text-[10px] uppercase font-semibold block">
              Net Quantity
            </span>
            <span className="text-sm font-bold text-neutral-900 flex items-center gap-1 mt-0.5">
              <Scale className="w-3.5 h-3.5 text-neutral-400" />
              {batch.quantity} {batch.unit}
            </span>
          </div>

          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60">
            <span className="text-neutral-500 text-[10px] uppercase font-semibold block">
              Generated Date
            </span>
            <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              {new Date(batch.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60">
            <span className="text-neutral-500 text-[10px] uppercase font-semibold block">
              Logged By
            </span>
            <span className="text-xs font-semibold text-neutral-800 truncate flex items-center gap-1 mt-0.5">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              {batch.generatedByUser?.name || 'Ward Staff'}
            </span>
          </div>

          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60">
            <span className="text-neutral-500 text-[10px] uppercase font-semibold block">
              QR Barcode
            </span>
            <span className="text-xs font-mono font-bold text-neutral-800 truncate flex items-center gap-1 mt-0.5">
              <QrCode className="w-3.5 h-3.5 text-neutral-400" />
              {batch.qrCode ? 'Assigned' : 'Pending Label'}
            </span>
          </div>
        </div>

        {/* Active Alerts Banner if SLA Delay or Geofence Breach exists */}
        {batch.alerts && batch.alerts.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 space-y-1">
            <div className="flex items-center gap-2 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>Active Compliance Notice ({batch.alerts.length})</span>
            </div>
            {batch.alerts.map((al) => (
              <p key={al.id} className="text-[11px] text-red-700 pl-6">
                • {al.type.replace(/_/g, ' ')} ({al.severity} Severity) — Status: {al.status}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Contextual Action Bar (Backend-Supported Custody Operations) */}
      {(canAcceptCollection || canStartTransport || canVerifyArrival || canConfirmTreatment) && (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary-subtle/20 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
              Authorized Custody Operation
            </span>
            <p className="text-xs text-neutral-700 font-medium">
              You are authorized to execute the next chain-of-custody transition on this batch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canAcceptCollection && (
              <Button
                variant="primary"
                size="touch"
                className="gap-2 font-bold shadow-sm"
                onClick={() => {
                  setActiveActionType('COLLECTION_ACCEPTED');
                  setActionConfirmOpen(true);
                }}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Accept Ward Custody</span>
              </Button>
            )}

            {canStartTransport && (
              <Button
                variant="primary"
                size="touch"
                className="gap-2 font-bold shadow-sm"
                onClick={() => {
                  setActiveActionType('TRANSPORT_STARTED');
                  setActionConfirmOpen(true);
                }}
              >
                <Truck className="w-5 h-5" />
                <span>Commence Vehicle Transport</span>
              </Button>
            )}

            {canVerifyArrival && (
              <Button
                variant="primary"
                size="touch"
                className="gap-2 font-bold shadow-sm"
                onClick={() => setArrivalDialogOpen(true)}
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Verify CBWTF Gate Arrival (5-Step)</span>
              </Button>
            )}

            {canConfirmTreatment && (
              <Button
                variant="danger"
                size="touch"
                className="gap-2 font-bold shadow-sm"
                onClick={() => setTreatmentDialogOpen(true)}
              >
                <Flame className="w-5 h-5" />
                <span>Confirm Waste Destruction</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Layout: Custody History vs Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Detailed Chain-of-Custody Timeline */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Chain of Custody Ledger</h2>
              <p className="text-xs text-neutral-500">
                Statutory audit trail of physical custody transfers under CPCB rules.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              {history.length} Event{history.length === 1 ? '' : 's'}
            </span>
          </div>

          <CustodyTimeline
            events={history}
            currentStatus={batch.status}
            currentCustodianName={null}
          />
        </div>

        {/* Right 1 Col: Batch QR Code Card & Statutory Verification */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold text-neutral-900">
                QR Adhesive Barcode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              {batch.qrCode ? (
                <div className="space-y-3">
                  <div className="p-3 bg-white border border-neutral-200 rounded-xl inline-block shadow-2xs">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`QR code for ${batch.wasteId}`}
                        className="w-32 h-32 mx-auto object-contain block"
                      />
                    ) : (
                      <div className="w-32 h-32 flex items-center justify-center text-neutral-400 text-xs font-mono">
                        Generating...
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                      Barcode String
                    </span>
                    <span className="font-mono text-xs font-bold text-neutral-800 break-all select-all">
                      {batch.qrCode.codeValue}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    onClick={() => router.push(`/waste-batches/${id}/print-qr`)}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Reprint Sticker</span>
                  </Button>
                </div>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <Clock className="w-8 h-8 text-neutral-400 mx-auto" />
                  <p className="text-xs text-neutral-500">
                    QR label has not been assigned yet.
                  </p>
                  {canPrintQr && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs"
                      onClick={() => router.push(`/waste-batches/${id}/print-qr`)}
                    >
                      Assign & Print QR
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {(batch.status === 'TREATED' || batch.status === 'VERIFIED_CLOSED') && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Destruction Certificate</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-neutral-700">
                <p className="text-[11px] text-emerald-900">
                  This batch has undergone physical destruction and is permanently closed in the CPCB compliance ledger.
                </p>
                {history.some((e) => e.eventType === 'TREATMENT_CONFIRMED' && !!e.photoUrl) && (
                  <div className="space-y-1.5 pt-1 border-t border-emerald-200/60">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                      Destruction Evidence
                    </span>
                    <a
                      href={history.find((e) => e.eventType === 'TREATMENT_CONFIRMED' && !!e.photoUrl)?.photoUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 break-all"
                    >
                      <Camera className="w-3.5 h-3.5 shrink-0" />
                      <span>View Uploaded Proof Photo</span>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold text-neutral-900 flex items-center justify-between">
                <span>Statutory Compliance</span>
                <span className="text-[10px] font-semibold text-neutral-400 uppercase">CPCB 2016</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-neutral-600">
              {/* SLA Time Tracker */}
              {(() => {
                const collectionEvent = history.find((e) => e.eventType === 'COLLECTION_ACCEPTED');
                if (!collectionEvent || batch.status === 'VERIFIED_CLOSED' || batch.status === 'TREATED') {
                  return null;
                }
                const elapsedHours =
                  Math.round(
                    ((Date.now() - new Date(collectionEvent.occurredAt).getTime()) / (1000 * 3600)) * 10
                  ) / 10;
                const isOverdue = elapsedHours > 48;
                const isWarning = elapsedHours > 36 && !isOverdue;

                return (
                  <div
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      isOverdue
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : isWarning
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>SLA Transit Timer:</span>
                      </span>
                      <span>{elapsedHours}h / 48h</span>
                    </div>
                    <p className="text-[11px] leading-tight">
                      {isOverdue ? (
                        <span className="font-bold text-red-700">
                          Breached by {(elapsedHours - 48).toFixed(1)} hours. Disposal delay incident logged.
                        </span>
                      ) : isWarning ? (
                        <span className="font-semibold text-amber-700">
                          Approaching 48h disposal limit. Priority treatment required.
                        </span>
                      ) : (
                        <span className="text-neutral-500">
                          Operating within statutory 48-hour transport duration window.
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p>
                  CPCB 2016 Bio-medical Waste Management Rules strictly apply. Maximum allowable disposal SLA is 48 hours from collection.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p>
                  Every physical transfer requires biometric or cryptographic barcode handshake.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog for Consequential Custody Actions */}
      <Dialog
        isOpen={actionConfirmOpen}
        onClose={() => setActionConfirmOpen(false)}
        title={
          activeActionType === 'COLLECTION_ACCEPTED'
            ? 'Confirm Custody Acceptance'
            : activeActionType === 'TRANSPORT_STARTED'
            ? 'Commence Transport Run'
            : activeActionType === 'VERIFY_ARRIVAL'
            ? 'Verify CBWTF Gate Arrival'
            : 'Confirm Waste Destruction'
        }
        description="This action creates an immutable event in the CPCB compliance trail. Verify physical bag particulars before executing."
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActionConfirmOpen(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              variant={activeActionType === 'CONFIRM_TREATMENT' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleExecuteAction}
              isLoading={isMutating}
              disabled={isMutating}
            >
              Confirm Handshake
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-xs">
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">Manifest ID:</span>
              <span className="font-mono font-bold text-neutral-900">{batch.wasteId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Weight & Category:</span>
              <span className="font-bold text-neutral-900">
                {batch.quantity} {batch.unit} • {batch.category?.name}
              </span>
            </div>
          </div>

          {activeActionType === 'CONFIRM_TREATMENT' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 block">
                Destruction Photo Proof URL <span className="text-red-500">*</span>
              </label>
              <Input
                value={treatmentPhotoUrl}
                onChange={(e) => setTreatmentPhotoUrl(e.target.value)}
                placeholder="https://storage.biotrack.in/treatment/autoclave-photo.jpg"
                className="text-xs"
              />
              <p className="text-[11px] text-neutral-400">
                Regulatory requirement: Uploaded photo showing destruction run log or autoclave cycle readout.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-700 block">
              Operational Notes <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <Input
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="e.g. Verified tamper-evident barcode seal intact"
              className="text-xs"
            />
          </div>
        </div>
      </Dialog>

      {/* 5-Step Arrival Verification Dialog */}
      <ArrivalVerificationDialog
        isOpen={arrivalDialogOpen}
        batch={batch as ArrivalBatchItem}
        onClose={() => setArrivalDialogOpen(false)}
        onSuccess={() => {
          refetchBatch();
          refetchHistory();
        }}
        onProceedToTreatment={() => {
          setArrivalDialogOpen(false);
          setTreatmentDialogOpen(true);
        }}
      />

      {/* Treatment Confirmation Dialog */}
      <TreatmentConfirmationDialog
        isOpen={treatmentDialogOpen}
        batch={batch as TreatmentBatchItem}
        onClose={() => setTreatmentDialogOpen(false)}
        onSuccess={() => {
          refetchBatch();
          refetchHistory();
        }}
      />
    </div>
  );
}
