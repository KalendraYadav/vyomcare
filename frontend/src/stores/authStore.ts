/**
 * BioTrack / VyomCare — Authentication State Store (Zustand)
 * Source of truth: design.md §7, §8, §9, §21
 *
 * SECURITY CONTRACT (design.md §21.1):
 * Access tokens are stored strictly in-memory (in Zustand state & api.ts).
 * Never persisted to localStorage/sessionStorage to protect against XSS token theft.
 */

'use client';

import { create } from 'zustand';
import { AuthUser, UserRole } from '@/types/models';
import { setAccessToken, getAccessToken, clearAccessToken } from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: AuthUser, accessToken: string) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  updateAccessToken: (token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,

  setAuth: (user, accessToken) => {
    const effectiveToken = accessToken || getAccessToken();
    if (effectiveToken) {
      setAccessToken(effectiveToken);
    }
    set({
      user,
      accessToken: effectiveToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateUser: (partialUser) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partialUser } : null,
    }));
  },

  updateAccessToken: (token) => {
    setAccessToken(token);
    set({ accessToken: token, isAuthenticated: true });
  },

  clearAuth: () => {
    clearAccessToken();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));

/**
 * Canonical route mapping per design.md §9
 */
export function getDashboardPath(role?: UserRole | string | null): string {
  switch (role) {
    case 'HOSPITAL_ADMIN':
    case 'HOSPITAL_STAFF':
      return '/hospital/dashboard';
    case 'COLLECTION_STAFF':
      return '/scan';
    case 'TRANSPORT_PERSONNEL':
      return '/transport/driver-mode';
    case 'TREATMENT_FACILITY_STAFF':
      return '/treatment/dashboard';
    case 'GOVERNMENT_AUTHORITY':
    case 'SUPER_ADMIN':
      return '/government/dashboard';
    default:
      return '/login';
  }
}

/**
 * Role-Based Access Helper Hook (design.md §8)
 */
export function useCurrentUser() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const role = user?.role;

  return {
    user,
    role,
    isAuthenticated,
    isLoading,

    // Specific role flags
    isHospitalAdmin: role === 'HOSPITAL_ADMIN',
    isHospitalStaff: role === 'HOSPITAL_STAFF',
    isHospitalRole: role === 'HOSPITAL_ADMIN' || role === 'HOSPITAL_STAFF',
    isCollectionStaff: role === 'COLLECTION_STAFF',
    isTransportPersonnel: role === 'TRANSPORT_PERSONNEL',
    isTreatmentStaff: role === 'TREATMENT_FACILITY_STAFF',
    isGovernmentAuthority: role === 'GOVERNMENT_AUTHORITY',
    isSuperAdmin: role === 'SUPER_ADMIN',

    // Permission checks (design.md §8 Matrix)
    canScan: [
      'HOSPITAL_ADMIN',
      'HOSPITAL_STAFF',
      'COLLECTION_STAFF',
      'TRANSPORT_PERSONNEL',
      'TREATMENT_FACILITY_STAFF',
    ].includes(role || ''),
    canRegisterWaste: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN'].includes(role || ''),
    canPrintQr: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'].includes(role || ''),
    canAcceptCollection: role === 'COLLECTION_STAFF',
    canStartTransport: role === 'TRANSPORT_PERSONNEL',
    canVerifyArrival: role === 'TREATMENT_FACILITY_STAFF',
    canConfirmTreatment: role === 'TREATMENT_FACILITY_STAFF',
    canViewGovernmentData: ['GOVERNMENT_AUTHORITY', 'SUPER_ADMIN'].includes(role || ''),
    canManageUsers: ['HOSPITAL_ADMIN', 'SUPER_ADMIN'].includes(role || ''),
    canApproveFacilities: role === 'SUPER_ADMIN',
    canEditSla: ['GOVERNMENT_AUTHORITY', 'SUPER_ADMIN'].includes(role || ''),
    canInspectAuditLog: role === 'SUPER_ADMIN',

    // Canonical navigation destination
    dashboardPath: getDashboardPath(role),
  };
}
