'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/stores/authStore';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { usersApi, facilitiesApi, categoriesApi, complianceApi } from '@/lib/api';
import {
  Shield,
  Users,
  Building2,
  Package,
  ShieldCheck,
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminHubPage() {
  const { isSuperAdmin, isHospitalAdmin, isGovernmentAuthority } = useCurrentUser();

  // Load authoritative platform counts where authorized
  const { data: users = [] } = useQuery({
    queryKey: ['admin-hub-users'],
    queryFn: () => usersApi.list(),
    enabled: isSuperAdmin || isHospitalAdmin,
    staleTime: 60_000,
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ['admin-hub-facilities'],
    queryFn: () => facilitiesApi.list(),
    enabled: isSuperAdmin || isGovernmentAuthority,
    staleTime: 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-hub-categories'],
    queryFn: () => categoriesApi.list(),
    staleTime: 60_000,
  });

  const { data: complianceRules = [] } = useQuery({
    queryKey: ['admin-hub-rules'],
    queryFn: () => complianceApi.list(),
    enabled: isSuperAdmin || isGovernmentAuthority,
    staleTime: 60_000,
  });

  // Calculate high-level summary indicators
  const activeUsersCount = users.filter((u) => u.status === 'ACTIVE').length;
  const approvedFacilitiesCount = facilities.filter((f) => f.status === 'APPROVED').length;
  const pendingFacilitiesCount = facilities.filter((f) => f.status === 'PENDING').length;

  return (
    <RoleGuard allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'GOVERNMENT_AUTHORITY']}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Administration & System Control
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {isSuperAdmin ? 'Super Admin' : isHospitalAdmin ? 'Hospital Admin' : 'Government Oversight'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Authoritative governance desk for user accounts, licensed facilities, waste categories, compliance thresholds, and audit trails.
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(isSuperAdmin || isHospitalAdmin) && (
            <Card className="border-neutral-200 shadow-subtle">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {isHospitalAdmin ? 'Hospital Staff' : 'Registered Users'}
                  </p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{users.length}</p>
                  <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    {activeUsersCount} Active
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          )}

          {(isSuperAdmin || isGovernmentAuthority) && (
            <Card className="border-neutral-200 shadow-subtle">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Facilities</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{facilities.length}</p>
                  <p className="text-[11px] text-neutral-500 font-medium flex items-center gap-1 mt-0.5">
                    {pendingFacilitiesCount > 0 ? (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {pendingFacilitiesCount} Pending Approval
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {approvedFacilitiesCount} Approved
                      </span>
                    )}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-neutral-200 shadow-subtle">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Categories</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{categories.length}</p>
                <p className="text-[11px] text-neutral-500 font-medium mt-0.5">CPCB Classified Streams</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          {(isSuperAdmin || isGovernmentAuthority) && (
            <Card className="border-neutral-200 shadow-subtle">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Compliance SLAs</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{complianceRules.length}</p>
                  <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Active Rules Enforced</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Administrative Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* User Management Card */}
          {(isSuperAdmin || isHospitalAdmin) && (
            <Card className="border-neutral-200 hover:border-neutral-300 transition-all shadow-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                    {isHospitalAdmin ? 'Hospital Scoped' : 'System Wide'}
                  </span>
                </div>
                <CardTitle className="text-base font-semibold text-neutral-900 mt-3">
                  {isHospitalAdmin ? 'Hospital Staff Management' : 'User Accounts & Roles'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-neutral-600">
                <p>
                  {isHospitalAdmin
                    ? 'Provision and manage hospital staff and admin accounts for your facility.'
                    : 'Manage all accounts across 7 system roles, configure permissions, and toggle user active states.'}
                </p>
                <div className="pt-2">
                  <Link href="/admin/users">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span>Open User Directory</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Facilities Management Card */}
          {(isSuperAdmin || isGovernmentAuthority) && (
            <Card className="border-neutral-200 hover:border-neutral-300 transition-all shadow-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  {pendingFacilitiesCount > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {pendingFacilitiesCount} Pending
                    </span>
                  )}
                </div>
                <CardTitle className="text-base font-semibold text-neutral-900 mt-3">
                  Facilities & Authorizations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-neutral-600">
                <p>
                  Register hospitals and CBWTF treatment facilities, inspect geofence radii, and grant regulatory waste category approvals.
                </p>
                <div className="pt-2">
                  <Link href="/admin/facilities">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span>Open Facilities Desk</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Waste Categories Card */}
          <Card className="border-neutral-200 hover:border-neutral-300 transition-all shadow-subtle">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                  CPCB Standard
                </span>
              </div>
              <CardTitle className="text-base font-semibold text-neutral-900 mt-3">
                Waste Category Streams
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-neutral-600">
              <p>
                Review and maintain CPCB-compliant biomedical waste categories, stream codes, and visual color assignments.
              </p>
              <div className="pt-2">
                <Link href="/admin/waste-categories">
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span>Manage Categories</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Compliance SLAs Card */}
          {(isSuperAdmin || isGovernmentAuthority) && (
            <Card className="border-neutral-200 hover:border-neutral-300 transition-all shadow-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                    Rule Engine
                  </span>
                </div>
                <CardTitle className="text-base font-semibold text-neutral-900 mt-3">
                  SLA Compliance Thresholds
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-neutral-600">
                <p>
                  Configure statutory maximum duration hours for Collection, Transport, and Treatment across waste categories.
                </p>
                <div className="pt-2">
                  <Link href="/admin/compliance-rules">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span>Review SLA Rules</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Immutable Audit Log Card */}
          {isSuperAdmin && (
            <Card className="border-neutral-200 hover:border-neutral-300 transition-all shadow-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                    Tamper Proof
                  </span>
                </div>
                <CardTitle className="text-base font-semibold text-neutral-900 mt-3">
                  Immutable Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-neutral-600">
                <p>
                  Inspect complete administrative audit trail: actor identity, IP address, timestamps, and JSON operation payloads.
                </p>
                <div className="pt-2">
                  <Link href="/admin/audit-log">
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span>View Audit Trail</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
