/**
 * BioTrack / VyomCare — Centralized API Client & Error Foundation
 * Source of truth: design.md §4, §16, §21 and verified NestJS backend
 */

import {
  AuthUser,
  User,
  Facility,
  WasteCategory,
  ComplianceRule,
  WasteBatch,
  CustodyEvent,
  QrCode,
  Vehicle,
  TransportAssignment,
  GpsPing,
  Alert,
  Notification,
  AuditLog,
} from '@/types/models';

import {
  LoginDto,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
  CreateUserDto,
  UsersFilterParams,
  RegisterFacilityDto,
  FacilitiesFilterParams,
  ApproveFacilityDto,
  CreateBatchDto,
  WasteBatchesFilterParams,
  ScanResponse,
  CustodyHandoverDto,
  VerifyArrivalDto,
  ConfirmTreatmentDto,
  CreateTransportAssignmentDto,
  CreateGpsPingDto,
  AlertsFilterParams,
  UpdateAlertDto,
  HospitalDashboardData,
  FacilityDashboardData,
  GovernmentDashboardData,
  AuditLogFilterParams,
  PaginatedResult,
} from '@/types/api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ─── In-Memory Access Token (design.md §21) ──────────────────────────────────
// Strictly kept in-memory to prevent XSS token theft. Never stored in localStorage.
let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
}

// ─── Error Handling Foundation ───────────────────────────────────────────────

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class ApiError extends Error {
  public status: number;
  public code: ApiErrorCode;
  public details?: unknown;

  constructor(status: number, message: string, code?: ApiErrorCode, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;

    if (code) {
      this.code = code;
    } else {
      switch (status) {
        case 400:
          this.code = 'BAD_REQUEST';
          break;
        case 401:
          this.code = 'UNAUTHORIZED';
          break;
        case 403:
          this.code = 'FORBIDDEN';
          break;
        case 404:
          this.code = 'NOT_FOUND';
          break;
        case 409:
          this.code = 'CONFLICT';
          break;
        case 422:
          this.code = 'VALIDATION_ERROR';
          break;
        case 429:
          this.code = 'RATE_LIMITED';
          break;
        case 500:
        case 502:
        case 503:
          this.code = 'SERVER_ERROR';
          break;
        default:
          this.code = status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN';
      }
    }
  }
}

/**
 * Sanitizes and extracts an actionable, user-friendly error message.
 * Prevents exposing SQL queries, stack traces, or internal server exceptions.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'UNAUTHORIZED':
        return 'Invalid credentials or session expired. Please sign in again.';
      case 'FORBIDDEN':
        return 'Access denied. Your role is not authorized to perform this action.';
      case 'NOT_FOUND':
        return 'The requested record or resource was not found.';
      case 'CONFLICT':
        return 'A record with this identifier already exists.';
      case 'VALIDATION_ERROR':
      case 'BAD_REQUEST':
        return err.message || 'Validation error. Please verify input fields.';
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'SERVER_ERROR':
        return 'Internal server error. Please try again or contact support.';
      case 'NETWORK_ERROR':
        return 'Network connection error. Please verify your internet connection.';
      case 'TIMEOUT':
        return 'Request timed out. Please try again.';
      default:
        return err.message || 'An unexpected error occurred.';
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// ─── Silent Refresh Concurrency Lock ─────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// ─── Fetch Wrapper with Bearer Auth & Silent Refresh ─────────────────────────

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  timeoutMs?: number;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers = {}, timeoutMs = 15000, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (inMemoryAccessToken) {
    reqHeaders['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      credentials: 'include', // Send httpOnly refresh_token cookie
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    clearTimeout(timeoutId);

    // ─── 401 Unauthorized Interception (design.md §16.1 & §21.2) ───────────
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshRes.ok) {
            const data: RefreshResponse = await refreshRes.json();
            setAccessToken(data.accessToken);
            isRefreshing = false;
            onRefreshed(data.accessToken);
          } else {
            // Refresh token expired or revoked
            clearAccessToken();
            isRefreshing = false;
            onRefreshed(null);
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
              window.location.href = `/login?session=expired&redirect=${encodeURIComponent(window.location.pathname)}`;
            }
            throw new ApiError(401, 'Session expired. Please log in again.', 'UNAUTHORIZED');
          }
        } catch (refreshErr) {
          isRefreshing = false;
          onRefreshed(null);
          clearAccessToken();
          throw refreshErr instanceof ApiError
            ? refreshErr
            : new ApiError(401, 'Session refresh failed.', 'UNAUTHORIZED');
        }
      }

      // Concurrently waiting requests wait for the active refresh to finish
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh(async (newToken) => {
          if (!newToken) {
            return reject(new ApiError(401, 'Session expired.', 'UNAUTHORIZED'));
          }

          try {
            const retryHeaders = {
              ...reqHeaders,
              Authorization: `Bearer ${newToken}`,
            };
            const retryRes = await fetch(`${BASE_URL}${path}`, {
              ...rest,
              credentials: 'include',
              headers: retryHeaders,
              body: body !== undefined ? JSON.stringify(body) : undefined,
            });

            if (!retryRes.ok) {
              const errData = await retryRes.json().catch(() => ({}));
              const msg = (errData as { message?: string }).message || `HTTP ${retryRes.status}`;
              return reject(new ApiError(retryRes.status, msg, undefined, errData));
            }

            if (retryRes.status === 204) {
              return resolve(undefined as T);
            }
            const data = await retryRes.json();
            return resolve(data as T);
          } catch (retryErr) {
            return reject(retryErr);
          }
        });
      });
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const rawMessage = (errData as { message?: string | string[] }).message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : (rawMessage as string) || `HTTP ${res.status}`;

      throw new ApiError(res.status, message, undefined, errData);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out after 15 seconds.', 'TIMEOUT');
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(0, 'Unable to connect to BioTrack server. Verify network.', 'NETWORK_ERROR');
    }

    throw new ApiError(0, (error as Error)?.message || 'An unexpected error occurred.', 'UNKNOWN');
  }
}

// ─── Resource API Namespaces ─────────────────────────────────────────────────

export const authApi = {
  login: async (dto: LoginDto): Promise<LoginResponse> => {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: dto,
    });
    if (res?.accessToken) {
      setAccessToken(res.accessToken);
    }
    return res;
  },
  logout: async (): Promise<LogoutResponse> => {
    try {
      return await apiFetch<LogoutResponse>('/auth/logout', { method: 'POST' });
    } finally {
      clearAccessToken();
    }
  },
  refresh: async (): Promise<RefreshResponse> => {
    const res = await apiFetch<RefreshResponse>('/auth/refresh', { method: 'POST' });
    if (res?.accessToken) {
      setAccessToken(res.accessToken);
    }
    return res;
  },
  verifyEmail: async (token: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch<{ success: boolean; message: string }>('/auth/verify-email', {
      method: 'POST',
      body: { token },
    });
  },
  resendVerification: async (email: string): Promise<{ success: boolean; message: string }> => {
    return apiFetch<{ success: boolean; message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: { email },
    });
  },
};

export const usersApi = {
  me: (): Promise<AuthUser> => apiFetch<AuthUser>('/users/me'),
  list: (params?: UsersFilterParams): Promise<User[]> => {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.facilityId) query.set('facilityId', params.facilityId);
    if (params?.status) query.set('status', params.status);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return apiFetch<User[]>(`/users${qs ? `?${qs}` : ''}`);
  },
  create: (dto: CreateUserDto): Promise<User> =>
    apiFetch<User>('/users', { method: 'POST', body: dto }),
  updateStatus: (id: string, status: 'ACTIVE' | 'DEACTIVATED'): Promise<User> =>
    apiFetch<User>(`/users/${id}/status`, { method: 'PATCH', body: { status } }),
};

export const facilitiesApi = {
  list: (params?: FacilitiesFilterParams): Promise<Facility[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return apiFetch<Facility[]>(`/facilities${qs ? `?${qs}` : ''}`);
  },
  get: (id: string): Promise<Facility> => apiFetch<Facility>(`/facilities/${id}`),
  register: (dto: RegisterFacilityDto): Promise<Facility> =>
    apiFetch<Facility>('/facilities', { method: 'POST', body: dto }),
  approve: (id: string, dto: ApproveFacilityDto): Promise<Facility> =>
    apiFetch<Facility>(`/facilities/${id}/approve`, { method: 'PATCH', body: dto }),
  update: (id: string, dto: Partial<RegisterFacilityDto>): Promise<Facility> =>
    apiFetch<Facility>(`/facilities/${id}`, { method: 'PATCH', body: dto }),
};

export const categoriesApi = {
  list: (): Promise<WasteCategory[]> => apiFetch<WasteCategory[]>('/waste-categories'),
  create: (dto: Partial<WasteCategory>): Promise<WasteCategory> =>
    apiFetch<WasteCategory>('/waste-categories', { method: 'POST', body: dto }),
  update: (id: string, dto: Partial<WasteCategory>): Promise<WasteCategory> =>
    apiFetch<WasteCategory>(`/waste-categories/${id}`, { method: 'PATCH', body: dto }),
  deactivate: (id: string): Promise<WasteCategory> =>
    apiFetch<WasteCategory>(`/waste-categories/${id}`, { method: 'DELETE' }),
};

export const complianceApi = {
  list: (): Promise<ComplianceRule[]> => apiFetch<ComplianceRule[]>('/compliance-rules'),
  update: (id: string, maxDurationHours: number): Promise<ComplianceRule> =>
    apiFetch<ComplianceRule>(`/compliance-rules/${id}`, {
      method: 'PUT',
      body: { maxDurationHours },
    }),
};

export const batchesApi = {
  create: (dto: CreateBatchDto): Promise<WasteBatch> =>
    apiFetch<WasteBatch>('/waste-batches', { method: 'POST', body: dto }),
  list: (params?: WasteBatchesFilterParams): Promise<PaginatedResult<WasteBatch>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.hospitalId) query.set('hospitalId', params.hospitalId);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    // Note: Backend waste-batches.service.ts does not parseInt(query.page/limit), causing Prisma take: '...' 500 error.
    // We omit page/limit so backend defaults to numeric page=1, limit=25 safely.
    const qs = query.toString();
    return apiFetch<PaginatedResult<WasteBatch>>(`/waste-batches${qs ? `?${qs}` : ''}`);
  },
  get: (id: string): Promise<WasteBatch> => apiFetch<WasteBatch>(`/waste-batches/${id}`),
  history: (id: string): Promise<CustodyEvent[]> =>
    apiFetch<CustodyEvent[]>(`/waste-batches/${id}/history`),
  generateQr: (id: string): Promise<{ qrCode: QrCode; qrDataUrl: string }> =>
    apiFetch<{ qrCode: QrCode; qrDataUrl: string }>(`/waste-batches/${id}/qr`, {
      method: 'POST',
    }),
  scan: (codeValue: string): Promise<ScanResponse> =>
    apiFetch<ScanResponse>('/scan', { method: 'POST', body: { codeValue } }),
  custodyHandover: (id: string, dto: CustodyHandoverDto): Promise<WasteBatch> =>
    apiFetch<WasteBatch>(`/waste-batches/${id}/custody-events`, {
      method: 'POST',
      body: dto,
    }),
  verifyArrival: (id: string, dto: VerifyArrivalDto): Promise<WasteBatch> =>
    apiFetch<WasteBatch>(`/waste-batches/${id}/verify-arrival`, {
      method: 'POST',
      body: dto,
    }),
  confirmTreatment: (id: string, dto: ConfirmTreatmentDto): Promise<WasteBatch> =>
    apiFetch<WasteBatch>(`/waste-batches/${id}/confirm-treatment`, {
      method: 'POST',
      body: dto,
    }),
};

export const transportApi = {
  getActive: (): Promise<TransportAssignment[]> =>
    apiFetch<TransportAssignment[]>('/transport/active'),
  myAssignment: (): Promise<TransportAssignment | null> =>
    apiFetch<TransportAssignment | null>('/transport/my-assignment'),
  vehicles: (): Promise<Vehicle[]> => apiFetch<Vehicle[]>('/transport/vehicles'),
  createAssignment: (dto: CreateTransportAssignmentDto): Promise<TransportAssignment> =>
    apiFetch<TransportAssignment>('/transport/assignments', { method: 'POST', body: dto }),
  ingestGps: (dto: CreateGpsPingDto): Promise<void> =>
    apiFetch<void>('/gps-pings', { method: 'POST', body: dto }),
  getPings: (assignmentId: string): Promise<GpsPing[]> =>
    apiFetch<GpsPing[]>(`/gps-pings/${assignmentId}`),
};

export const alertsApi = {
  list: (params?: AlertsFilterParams): Promise<PaginatedResult<Alert>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<PaginatedResult<Alert>>(`/alerts${qs ? `?${qs}` : ''}`);
  },
  get: (id: string): Promise<Alert> => apiFetch<Alert>(`/alerts/${id}`),
  update: (id: string, dto: UpdateAlertDto): Promise<Alert> =>
    apiFetch<Alert>(`/alerts/${id}`, { method: 'PATCH', body: dto }),
};

export const dashboardApi = {
  hospital: (): Promise<HospitalDashboardData> =>
    apiFetch<HospitalDashboardData>('/dashboard/hospital'),
  facility: (): Promise<FacilityDashboardData> =>
    apiFetch<FacilityDashboardData>('/dashboard/facility'),
  government: (): Promise<GovernmentDashboardData> =>
    apiFetch<GovernmentDashboardData>('/dashboard/government'),
};

export const notificationsApi = {
  list: (): Promise<Notification[]> => apiFetch<Notification[]>('/notifications'),
  unreadCount: (): Promise<{ count: number }> =>
    apiFetch<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string): Promise<void> =>
    apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: (): Promise<void> =>
    apiFetch<void>('/notifications/mark-all-read', { method: 'PATCH' }),
};

export const auditLogApi = {
  list: (params?: AuditLogFilterParams): Promise<AuditLog[]> => {
    const query = new URLSearchParams();
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.actorUserId) query.set('actorUserId', params.actorUserId);
    const qs = query.toString();
    return apiFetch<AuditLog[]>(`/audit-log${qs ? `?${qs}` : ''}`);
  },
};
