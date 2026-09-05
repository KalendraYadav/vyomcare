import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    ...opts,
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export const formatDateTime = formatDate;

export function formatRelative(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function statusColor(status: string): string {
  switch (status) {
    case 'VERIFIED_CLOSED': return 'badge-success';
    case 'TREATED': return 'badge-success';
    case 'IN_TRANSIT': return 'badge-pending';
    case 'COLLECTED': return 'badge-pending';
    case 'RECEIVED': return 'badge-info';
    case 'QR_ASSIGNED': return 'badge-info';
    case 'REGISTERED': return 'badge-info';
    case 'VIOLATION': return 'badge-danger';
    case 'APPROVED': return 'badge-success';
    case 'PENDING': return 'badge-pending';
    case 'SUSPENDED': return 'badge-danger';
    case 'ACTIVE': return 'badge-success';
    case 'DEACTIVATED': return 'badge-neutral';
    case 'OPEN': return 'badge-danger';
    case 'INVESTIGATING': return 'badge-pending';
    case 'RESOLVED': return 'badge-success';
    default: return 'badge-neutral';
  }
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    VERIFIED_CLOSED: 'Verified & Closed',
    QR_ASSIGNED: 'QR Assigned',
    IN_TRANSIT: 'In Transit',
    HOSPITAL_ADMIN: 'Hospital Admin',
    HOSPITAL_STAFF: 'Hospital Staff',
    COLLECTION_STAFF: 'Collection Staff',
    TRANSPORT_PERSONNEL: 'Transport',
    TREATMENT_FACILITY_STAFF: 'Facility Staff',
    GOVERNMENT_AUTHORITY: 'Government',
    SUPER_ADMIN: 'Super Admin',
  };
  return map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function severityClass(severity: string): string {
  switch (severity) {
    case 'HIGH': return 'severity-high';
    case 'MEDIUM': return 'severity-medium';
    case 'LOW': return 'severity-low';
    default: return 'severity-medium';
  }
}

export function alertTypeLabel(type: string): string {
  const map: Record<string, string> = {
    DISPOSAL_DELAY: 'Disposal Delay',
    UNAUTHORIZED_LOCATION: 'Unauthorized Location',
    ROUTE_DEVIATION: 'Route Deviation',
    MISSING_SCAN: 'Missing Scan',
  };
  return map[type] || type;
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
