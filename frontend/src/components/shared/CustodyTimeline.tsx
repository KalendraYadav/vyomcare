'use client';

import * as React from 'react';
import { CustodyEvent, CustodyEventType, WasteBatchStatus } from '@/types/models';
import {
  FileText,
  QrCode,
  UserCheck,
  Truck,
  ShieldCheck,
  Flame,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  ArrowRight,
} from 'lucide-react';

interface CustodyTimelineProps {
  events: CustodyEvent[];
  currentStatus: WasteBatchStatus;
  currentCustodianName?: string | null;
}

const EVENT_CONFIG: Record<
  CustodyEventType,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    bgClass: string;
  }
> = {
  REGISTERED: {
    label: 'Batch Registered',
    description: 'Waste bag generated and logged at hospital ward',
    icon: FileText,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50 border-blue-200',
  },
  QR_ASSIGNED: {
    label: 'QR Code Affixed',
    description: 'Adhesive thermal barcode printed and linked to batch',
    icon: QrCode,
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50 border-indigo-200',
  },
  COLLECTION_ACCEPTED: {
    label: 'Collection Accepted',
    description: 'Transferred from ward custody to waste collection team',
    icon: UserCheck,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50 border-amber-200',
  },
  TRANSPORT_STARTED: {
    label: 'Transport Dispatched',
    description: 'Loaded onto hazardous transport vehicle and run started',
    icon: Truck,
    colorClass: 'text-sky-600',
    bgClass: 'bg-sky-50 border-sky-200',
  },
  TRANSPORT_UPDATED: {
    label: 'Transit Telemetry Update',
    description: 'Vehicle GPS waypoint and route checkpoint verified',
    icon: Truck,
    colorClass: 'text-cyan-600',
    bgClass: 'bg-cyan-50 border-cyan-200',
  },
  ARRIVAL_VERIFIED: {
    label: 'CBWTF Arrival Verified',
    description: 'Passed 5-step gate geofence and authorization check',
    icon: ShieldCheck,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50 border-emerald-200',
  },
  TREATMENT_CONFIRMED: {
    label: 'Destruction Confirmed',
    description: 'Autoclave/incinerator destruction verified with proof',
    icon: Flame,
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50 border-emerald-300',
  },
  VERIFIED_CLOSED: {
    label: 'Compliance Closed',
    description: 'Manifest closed and archived in compliance ledger',
    icon: CheckCircle2,
    colorClass: 'text-green-700',
    bgClass: 'bg-green-100 border-green-300',
  },
};

export function CustodyTimeline({
  events,
  currentStatus,
  currentCustodianName,
}: CustodyTimelineProps) {
  // Sort events chronologically ascending
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Current Status Callout Header */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Authoritative Lifecycle Status
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h3 className="text-base font-bold text-neutral-900 tracking-tight">
              {currentStatus.replace(/_/g, ' ')}
            </h3>
          </div>
        </div>

        {currentCustodianName && (
          <div className="text-right text-xs">
            <span className="text-neutral-500 block text-[10px] uppercase font-semibold">
              Current Custodian
            </span>
            <span className="font-semibold text-neutral-800">{currentCustodianName}</span>
          </div>
        )}
      </div>

      {/* Timeline entries */}
      {sortedEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center bg-neutral-50 text-neutral-500 text-xs">
          <Clock className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
          <p className="font-semibold">No custody records logged yet</p>
          <p className="text-[11px] text-neutral-400">Events will appear as the batch moves along the custody chain.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-neutral-200">
          {sortedEvents.map((evt, idx) => {
            const config = EVENT_CONFIG[evt.eventType] || {
              label: evt.eventType.replace(/_/g, ' '),
              description: 'Custody event logged',
              icon: FileText,
              colorClass: 'text-neutral-600',
              bgClass: 'bg-neutral-50 border-neutral-200',
            };
            const Icon = config.icon;
            const isLast = idx === sortedEvents.length - 1;

            return (
              <div key={evt.id || idx} className="relative group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center bg-white shadow-xs ${config.colorClass} ${
                    isLast ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  title={config.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Event Card */}
                <div
                  className={`rounded-xl border p-4 transition-all duration-150 ${
                    isLast
                      ? `${config.bgClass} shadow-xs`
                      : 'bg-white border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900">
                        {config.label}
                      </span>
                      {isLast && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                          Latest Event
                        </span>
                      )}
                    </div>

                    <time
                      dateTime={evt.occurredAt}
                      className="text-[11px] font-medium text-neutral-500"
                    >
                      {new Date(evt.occurredAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </time>
                  </div>

                  <p className="text-xs text-neutral-600 mb-2">
                    {evt.notes || config.description}
                  </p>

                  {/* Actor Transfer Details */}
                  {(evt.fromUser || evt.toUser) && (
                    <div className="flex items-center gap-2 text-xs text-neutral-700 bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-md w-fit mb-2">
                      {evt.fromUser && (
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500 text-[10px]">From:</span>
                          <span className="font-semibold">{evt.fromUser.name}</span>
                          <span className="text-[10px] text-neutral-500">
                            ({evt.fromUser.role.replace(/_/g, ' ')})
                          </span>
                        </div>
                      )}

                      {evt.fromUser && evt.toUser && (
                        <ArrowRight className="w-3 h-3 text-neutral-400" />
                      )}

                      {evt.toUser && (
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500 text-[10px]">
                            {evt.fromUser ? 'To:' : 'Actor:'}
                          </span>
                          <span className="font-semibold">{evt.toUser.name}</span>
                          <span className="text-[10px] text-neutral-500">
                            ({evt.toUser.role.replace(/_/g, ' ')})
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location & Photo Metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 pt-1">
                    {evt.latitude !== null && evt.longitude !== null && (
                      <div className="flex items-center gap-1 font-mono">
                        <MapPin className="w-3 h-3 text-neutral-400" />
                        <span>
                          {Number(evt.latitude).toFixed(4)}°N, {Number(evt.longitude).toFixed(4)}°E
                        </span>
                      </div>
                    )}

                    {evt.photoUrl && (
                      <a
                        href={evt.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                      >
                        <Camera className="w-3 h-3" />
                        <span>View Attachment Proof</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
