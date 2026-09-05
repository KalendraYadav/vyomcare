/**
 * BioTrack / VyomCare — Domain Models & Enums
 * Source of truth: Prisma schema & design.md §7, §8, §16
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole =
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'COLLECTION_STAFF'
  | 'TRANSPORT_PERSONNEL'
  | 'TREATMENT_FACILITY_STAFF'
  | 'GOVERNMENT_AUTHORITY'
  | 'SUPER_ADMIN';

export type UserStatus = 'ACTIVE' | 'DEACTIVATED';

export type FacilityType = 'HOSPITAL' | 'TREATMENT_FACILITY';

export type FacilityStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';

export type WasteBatchStatus =
  | 'REGISTERED'
  | 'QR_ASSIGNED'
  | 'COLLECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'TREATED'
  | 'VERIFIED_CLOSED'
  | 'VIOLATION';

export type WasteUnit = 'KG' | 'COUNT';

export type CustodyEventType =
  | 'REGISTERED'
  | 'QR_ASSIGNED'
  | 'COLLECTION_ACCEPTED'
  | 'TRANSPORT_STARTED'
  | 'TRANSPORT_UPDATED'
  | 'ARRIVAL_VERIFIED'
  | 'TREATMENT_CONFIRMED'
  | 'VERIFIED_CLOSED';

export type ComplianceStage = 'COLLECTION' | 'TRANSPORT' | 'TREATMENT';

export type AlertType =
  | 'DISPOSAL_DELAY'
  | 'UNAUTHORIZED_LOCATION'
  | 'ROUTE_DEVIATION'
  | 'MISSING_SCAN';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type AlertStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export type TransportAssignmentStatus = 'IN_PROGRESS' | 'ARRIVED' | 'ABANDONED';

export type VehicleStatus = 'ACTIVE' | 'INACTIVE';

// ─── Core Domain Entities ───────────────────────────────────────────────────

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  registrationNumber: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number | null;
  authorizedCategoryIds: string[];
  status: FacilityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  facilityId: string | null;
  facility?: Facility;
}

export interface User extends AuthUser {
  phone: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface WasteCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  colorCode: string;
  isActive: boolean;
  createdAt: string;
}

export interface ComplianceRule {
  id: string;
  wasteCategoryId: string;
  stage: ComplianceStage;
  maxDurationHours: number;
  createdAt: string;
  updatedAt: string;
  wasteCategory?: WasteCategory;
}

export interface QrCode {
  id: string;
  wasteBatchId: string;
  codeValue: string;
  generatedAt: string;
  generatedByUserId: string;
}

export interface CustodyEvent {
  id: string;
  wasteBatchId: string;
  eventType: CustodyEventType;
  fromUserId: string | null;
  toUserId: string | null;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
  notes: string | null;
  photoUrl: string | null;
  fromUser?: { id: string; name: string; role: UserRole };
  toUser?: { id: string; name: string; role: UserRole };
}

export interface WasteBatch {
  id: string;
  wasteId: string;
  categoryId: string;
  hospitalId: string;
  department: string;
  quantity: number;
  unit: WasteUnit;
  generatedByUserId: string;
  generatedAt: string;
  status: WasteBatchStatus;
  photoUrl: string | null;
  currentCustodianUserId: string | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  category?: WasteCategory;
  hospital?: Facility;
  generatedByUser?: { id: string; name: string; email: string };
  qrCode?: QrCode | null;
  custodyEvents?: CustodyEvent[];
  alerts?: Alert[];
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: string;
  capacity: number | null;
  status: VehicleStatus;
}

export interface GpsPing {
  id: string;
  transportAssignmentId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
}

export interface TransportAssignment {
  id: string;
  wasteBatchId: string;
  vehicleId: string;
  driverUserId: string;
  startTime: string;
  expectedFacilityId: string;
  endTime: string | null;
  status: TransportAssignmentStatus;
  wasteBatch?: WasteBatch;
  vehicle?: Vehicle;
  driverUser?: { id: string; name: string; email: string };
  expectedFacility?: Facility;
  gpsPings?: GpsPing[];
}

export interface Alert {
  id: string;
  wasteBatchId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  notes: string | null;
  wasteBatch?: WasteBatch;
  resolvedByUser?: { id: string; name: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  occurredAt: string;
}
