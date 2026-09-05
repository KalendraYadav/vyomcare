'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from './api';

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  updateAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => set({ user, accessToken }),
      clearAuth: () => set({ user: null, accessToken: null }),
      updateAccessToken: (token) => set({ accessToken: token }),
    }),
    {
      name: 'biotrack-auth',
      partialize: (state) => ({ user: state.user }), // Don't persist access token
    },
  ),
);

// Helper hook for role checks
export function useCurrentUser() {
  const { user } = useAuthStore();
  return {
    user,
    isHospitalAdmin: user?.role === 'HOSPITAL_ADMIN',
    isHospitalStaff: user?.role === 'HOSPITAL_STAFF',
    isHospital: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'].includes(user?.role || ''),
    isCollection: user?.role === 'COLLECTION_STAFF',
    isTransport: user?.role === 'TRANSPORT_PERSONNEL',
    isFacilityStaff: user?.role === 'TREATMENT_FACILITY_STAFF',
    isGovernment: user?.role === 'GOVERNMENT_AUTHORITY',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    canScan: ['COLLECTION_STAFF', 'TRANSPORT_PERSONNEL', 'TREATMENT_FACILITY_STAFF'].includes(user?.role || ''),
    canRegisterWaste: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN'].includes(user?.role || ''),
    canViewGovernmentData: ['GOVERNMENT_AUTHORITY', 'SUPER_ADMIN'].includes(user?.role || ''),
    canManageFacilities: user?.role === 'SUPER_ADMIN',
    dashboardPath: getDashboardPath(user?.role),
  };
}

function getDashboardPath(role?: string): string {
  switch (role) {
    case 'HOSPITAL_ADMIN':
    case 'HOSPITAL_STAFF':
      return '/hospital';
    case 'COLLECTION_STAFF':
      return '/collection';
    case 'TRANSPORT_PERSONNEL':
      return '/transport';
    case 'TREATMENT_FACILITY_STAFF':
      return '/facility';
    case 'GOVERNMENT_AUTHORITY':
      return '/government';
    case 'SUPER_ADMIN':
      return '/admin';
    default:
      return '/login';
  }
}
