/**
 * BioTrack / VyomCare — API Request/Response DTOs & Interfaces
 * Source of truth: Verified NestJS modules & design.md §16
 */

import {
  AuthUser,
  UserRole,
  UserStatus,
  Facility,
  FacilityType,
  FacilityStatus,
  WasteCategory,
  WasteBatch,
  WasteUnit,
  WasteBatchStatus,
  CustodyEventType,
  QrCode,
  Alert,
  AlertStatus,
  AlertType,
  AlertSeverity,
} from './models';

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Auth Module ────────────────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface LogoutResponse {
  message: string;
}

// ─── Users Module ───────────────────────────────────────────────────────────

export interface CreateUserDto {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: UserRole;
  facilityId?: string;
}

export interface UsersFilterParams {
  role?: UserRole;
  facilityId?: string;
  status?: UserStatus;
  limit?: number;
  offset?: number;
}

// ─── Facilities Module ──────────────────────────────────────────────────────

export interface RegisterFacilityDto {
  name: string;
  type: FacilityType;
  registrationNumber: string;
  address: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusM?: number;
  authorizedCategoryIds?: string[];
}

export interface FacilitiesFilterParams {
  status?: FacilityStatus;
  type?: FacilityType;
  limit?: number;
  offset?: number;
}

export interface ApproveFacilityDto {
  action: 'APPROVED' | 'SUSPENDED';
  reason?: string;
}

// ─── Waste Batches Module ───────────────────────────────────────────────────

export interface CreateBatchDto {
  categoryId: string;
  department: string;
  quantity: number;
  unit: WasteUnit;
  photoUrl?: string;
  idempotencyKey?: string;
}

export interface WasteBatchesFilterParams {
  status?: WasteBatchStatus;
  hospitalId?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface ScanDto {
  codeValue: string;
}

export interface ScanResponse {
  batch: WasteBatch & { category: WasteCategory; hospital: Facility };
  qrCode: QrCode;
  validActions: string[];
}

export interface CustodyHandoverDto {
  eventType: CustodyEventType;
  toUserId?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  photoUrl?: string;
}

export interface VerifyArrivalDto {
  latitude: number;
  longitude: number;
}

export interface ConfirmTreatmentDto {
  photoUrl: string;
  latitude?: number;
  longitude?: number;
}

// ─── Transport & GPS Modules ────────────────────────────────────────────────

export interface CreateTransportAssignmentDto {
  wasteBatchId: string;
  vehicleId: string;
  driverUserId: string;
  expectedFacilityId: string;
}

export interface CreateGpsPingDto {
  transportAssignmentId: string;
  latitude: number;
  longitude: number;
}

// ─── Alerts Module ──────────────────────────────────────────────────────────

export interface AlertsFilterParams {
  status?: AlertStatus;
  type?: AlertType;
  severity?: AlertSeverity;
  limit?: number;
  page?: number;
}

export interface UpdateAlertDto {
  status?: 'INVESTIGATING' | 'RESOLVED';
  notes?: string;
}

// ─── Dashboards Module ──────────────────────────────────────────────────────

export interface CategoryBreakdown {
  categoryId: string;
  _count: number;
  name?: string;
  color?: string;
  count?: number;
  weight?: number;
}

export interface HospitalDashboardData {
  totalRegistered: number;
  pendingCollection: number;
  inTransit: number;
  delayed: number;
  complianceRate: number;
  wasteByCategory: CategoryBreakdown[];
  recentBatches: WasteBatch[];
}

export interface FacilityDashboardData {
  incoming: number;
  pendingVerification: number;
  received: number;
  treatedToday: number;
  pendingBatches: WasteBatch[];
}

export interface GovernmentDashboardData {
  totalFacilities: number;
  inTransit: number;
  openAlerts: number;
  overallCompliance: number;
  facilities: Facility[];
  recentAlerts: Alert[];
}

// ─── Audit Log Module ───────────────────────────────────────────────────────

export interface AuditLogFilterParams {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  limit?: number;
  offset?: number;
}
