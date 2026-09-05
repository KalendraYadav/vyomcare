const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers = {}, ...rest } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: 'include', // send httpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Intercept 401 — attempt silent refresh
  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    const refreshed = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      // Retry original request
      const retry = await fetch(`${BASE_URL}${path}`, {
        ...rest,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) throw new ApiError(retry.status, await retry.json().catch(() => ({})));
      return retry.json();
    } else {
      // Refresh failed — redirect to session expired
      if (typeof window !== 'undefined') window.location.href = '/auth/session-expired';
      throw new ApiError(401, { message: 'Session expired' });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super((data?.message as string) || `HTTP ${status}`);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  refresh: () => apiFetch<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),
};

// ─── Users ────────────────────────────────────────────────────────────────
export const usersApi = {
  me: () => apiFetch<AuthUser>('/users/me'),
  list: (params?: Record<string, string>) => apiFetch<User[]>(`/users?${new URLSearchParams(params)}`),
  create: (dto: CreateUserDto) => apiFetch<User>('/users', { method: 'POST', body: dto }),
  updateStatus: (id: string, status: 'ACTIVE' | 'DEACTIVATED') =>
    apiFetch<User>(`/users/${id}/status`, { method: 'PATCH', body: { status } }),
};

// ─── Facilities ───────────────────────────────────────────────────────────
export const facilitiesApi = {
  list: (params?: Record<string, string>) => apiFetch<Facility[]>(`/facilities?${new URLSearchParams(params)}`),
  get: (id: string) => apiFetch<Facility>(`/facilities/${id}`),
  register: (dto: RegisterFacilityDto) => apiFetch<Facility>('/facilities', { method: 'POST', body: dto }),
  approve: (id: string, action: 'APPROVED' | 'SUSPENDED', reason?: string) =>
    apiFetch<Facility>(`/facilities/${id}/approve`, { method: 'PATCH', body: { action, reason } }),
  update: (id: string, dto: Partial<RegisterFacilityDto>) =>
    apiFetch<Facility>(`/facilities/${id}`, { method: 'PATCH', body: dto }),
};

// ─── Waste Categories ─────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => apiFetch<WasteCategory[]>('/waste-categories'),
  create: (dto: any) => apiFetch<WasteCategory>('/waste-categories', { method: 'POST', body: dto }),
  update: (id: string, dto: any) => apiFetch<WasteCategory>(`/waste-categories/${id}`, { method: 'PATCH', body: dto }),
};

// ─── Compliance Rules ─────────────────────────────────────────────────────
export const complianceApi = {
  list: () => apiFetch<ComplianceRule[]>('/compliance-rules'),
  update: (id: string, maxDurationHours: number) =>
    apiFetch<ComplianceRule>(`/compliance-rules/${id}`, { method: 'PUT', body: { maxDurationHours } }),
};

// ─── Waste Batches ────────────────────────────────────────────────────────
export const batchesApi = {
  create: (dto: CreateBatchDto) => apiFetch<WasteBatch>('/waste-batches', { method: 'POST', body: dto }),
  list: (params?: Record<string, string>) =>
    apiFetch<PaginatedResult<WasteBatch>>(`/waste-batches?${new URLSearchParams(params)}`),
  get: (id: string) => apiFetch<WasteBatch>(`/waste-batches/${id}`),
  history: (id: string) => apiFetch<CustodyEvent[]>(`/waste-batches/${id}/history`),
  generateQr: (id: string) => apiFetch<{ qrCode: QrCode; qrDataUrl: string }>(`/waste-batches/${id}/qr`, { method: 'POST' }),
  scan: (codeValue: string) => apiFetch<ScanResult>('/scan', { method: 'POST', body: { codeValue } }),
  custodyHandover: (id: string, dto: CustodyHandoverDto) =>
    apiFetch<WasteBatch>(`/waste-batches/${id}/custody-events`, { method: 'POST', body: dto }),
  verifyArrival: (id: string, dto: { latitude: number; longitude: number }) =>
    apiFetch<WasteBatch>(`/waste-batches/${id}/verify-arrival`, { method: 'POST', body: dto }),
  confirmTreatment: (id: string, dto: { photoUrl: string; latitude?: number; longitude?: number }) =>
    apiFetch<WasteBatch>(`/waste-batches/${id}/confirm-treatment`, { method: 'POST', body: dto }),
};

// ─── Alerts ───────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (params?: Record<string, string>) =>
    apiFetch<PaginatedResult<Alert>>(`/alerts?${new URLSearchParams(params)}`),
  get: (id: string) => apiFetch<Alert>(`/alerts/${id}`),
  update: (id: string, dto: { status?: string; notes?: string }) =>
    apiFetch<Alert>(`/alerts/${id}`, { method: 'PATCH', body: dto }),
};

// ─── Dashboards ───────────────────────────────────────────────────────────
export const dashboardApi = {
  hospital: () => apiFetch<HospitalDashboard>('/dashboard/hospital'),
  facility: () => apiFetch<FacilityDashboard>('/dashboard/facility'),
  government: () => apiFetch<GovernmentDashboard>('/dashboard/government'),
};

// ─── Transport ────────────────────────────────────────────────────────────
export const transportApi = {
  getActive: () => apiFetch<TransportAssignment[]>('/transport/active'),
  myAssignment: () => apiFetch<TransportAssignment | null>('/transport/my-assignment'),
  vehicles: () => apiFetch<Vehicle[]>('/transport/vehicles'),
  createAssignment: (dto: any) => apiFetch<TransportAssignment>('/transport/assignments', { method: 'POST', body: dto }),
  ingestGps: (dto: { transportAssignmentId: string; latitude: number; longitude: number }) =>
    apiFetch('/gps-pings', { method: 'POST', body: dto }),
};

// ─── Notifications ────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => apiFetch<Notification[]>('/notifications'),
  unreadCount: () => apiFetch<number>('/notifications/unread-count'),
  markRead: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiFetch('/notifications/mark-all-read', { method: 'PATCH' }),
};

// ─── Types ────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string; name: string; email: string; role: string; facilityId: string | null;
}
export interface User extends AuthUser {
  status: string; lastLoginAt: string | null; createdAt: string;
}
export interface CreateUserDto { name: string; email: string; password: string; role: string; facilityId?: string; }

export interface Facility {
  id: string; name: string; type: string; registrationNumber: string;
  address: string; latitude?: number; longitude?: number;
  geofenceRadiusM?: number; authorizedCategoryIds: string[];
  status: string; createdAt: string;
}
export interface RegisterFacilityDto {
  name: string; type: string; registrationNumber: string; address: string;
  latitude?: number; longitude?: number; geofenceRadiusM?: number; authorizedCategoryIds?: string[];
}

export interface WasteCategory { id: string; code: string; name: string; description?: string; colorCode: string; isActive: boolean; }
export interface ComplianceRule { id: string; wasteCategoryId: string; stage: string; maxDurationHours: number; wasteCategory: WasteCategory; }

export interface WasteBatch {
  id: string; wasteId: string; categoryId: string; hospitalId: string;
  department: string; quantity: number; unit: string; status: string;
  photoUrl?: string; generatedAt: string; createdAt: string; updatedAt: string;
  category?: WasteCategory; hospital?: { id: string; name: string };
  qrCode?: QrCode; alerts?: Alert[];
}
export interface CreateBatchDto { categoryId: string; department: string; quantity: number; unit: string; photoUrl?: string; idempotencyKey?: string; }
export interface QrCode { id: string; codeValue: string; generatedAt: string; }

export interface CustodyEvent {
  id: string; wasteBatchId: string; eventType: string;
  fromUser?: { id: string; name: string; role: string };
  toUser?: { id: string; name: string; role: string };
  latitude?: number; longitude?: number; occurredAt: string; notes?: string; photoUrl?: string;
}
export interface CustodyHandoverDto { eventType: string; latitude?: number; longitude?: number; notes?: string; photoUrl?: string; }

export interface ScanResult { batch: WasteBatch; validActions: string[]; }

export interface Alert {
  id: string; wasteBatchId?: string; type: string; severity: string; status: string;
  createdAt: string; resolvedAt?: string; notes?: string;
  wasteBatch?: { wasteId: string; hospitalId: string };
}

export interface TransportAssignment {
  id: string; wasteBatchId: string; vehicleId: string; driverUserId: string;
  startTime: string; expectedFacilityId: string; endTime?: string; status: string;
  wasteBatch?: WasteBatch; vehicle?: Vehicle;
  driverUser?: { id: string; name: string };
  expectedFacility?: { id: string; name: string; address: string; latitude?: number; longitude?: number; geofenceRadiusM?: number };
  gpsPings?: GpsPing[];
}
export interface Vehicle { id: string; registrationNumber: string; type: string; capacity?: number; status: string; }
export interface GpsPing { id: string; latitude: number; longitude: number; recordedAt: string; }

export interface HospitalDashboard {
  totalRegistered: number; pendingCollection: number; inTransit: number;
  delayed: number; complianceRate: number; wasteByCategory: any[]; recentBatches: WasteBatch[];
}
export interface FacilityDashboard {
  incoming: number; pendingVerification: number; received: number; treatedToday: number; pendingBatches: WasteBatch[];
}
export interface GovernmentDashboard {
  totalFacilities: number; inTransit: number; openAlerts: number; overallCompliance: number;
  facilities: Facility[]; recentAlerts: Alert[];
}

export interface PaginatedResult<T> { items: T[]; total: number; page: number; limit: number; }
// eslint-disable-next-line @typescript-eslint/no-shadow
export interface Notification { id: string; userId: string; type: string; message: string; readAt: string | null; createdAt: string; }
