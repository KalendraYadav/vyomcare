'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/stores/authStore';
import { UserRole } from '@/types/models';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

/**
 * Role-Based Access Guard (design.md §20.4)
 * Renders an accessible 403 Forbidden screen if user's role is unauthorized.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, role, isLoading, dashboardPath } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-neutral-500 font-medium mt-3">Verifying permissions...</p>
      </div>
    );
  }

  const isAuthorized = role ? allowedRoles.includes(role as UserRole) : false;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="card p-8 max-w-md w-full flex flex-col items-center gap-4 shadow-raised border-neutral-200">
          <div className="w-14 h-14 rounded-full bg-status-danger-bg flex items-center justify-center text-status-danger">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[11px] font-bold text-status-danger uppercase tracking-wider bg-status-danger-bg px-2.5 py-0.5 rounded-full border border-status-danger/20">
              403 Forbidden
            </span>
            <h2 className="text-xl font-bold text-neutral-900 mt-2 tracking-tight">
              Access Restricted
            </h2>
            <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
              Your certified role ({user?.role?.replace(/_/g, ' ') || 'Guest'}) does not have authorization to access this operational view.
            </p>
          </div>

          <div className="w-full pt-2">
            <Link href={dashboardPath} className="w-full block">
              <Button variant="primary" size="md" className="w-full justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Your Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
