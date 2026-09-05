'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCurrentUser, useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import {
  LayoutDashboard,
  QrCode,
  PlusCircle,
  Package,
  Truck,
  AlertTriangle,
  Users,
  Building2,
  Map,
  ShieldCheck,
  Activity,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

function getNavItems(role?: string): { section?: string; items: NavItem[] }[] {
  switch (role) {
    case 'HOSPITAL_ADMIN':
      return [
        {
          section: 'OPERATIONS',
          items: [
            { label: 'Hospital Dashboard', href: '/hospital/dashboard', icon: LayoutDashboard },
            { label: 'Quick Scan', href: '/scan', icon: QrCode },
            { label: 'New Waste Batch', href: '/waste-batches/new', icon: PlusCircle },
            { label: 'Waste Directory', href: '/waste-batches', icon: Package },
          ],
        },
        {
          section: 'LOGISTICS & COMPLIANCE',
          items: [
            { label: 'Active Transport', href: '/transport/active', icon: Truck },
            { label: 'Alerts & Tickets', href: '/alerts', icon: AlertTriangle },
          ],
        },
        {
          section: 'ADMINISTRATION',
          items: [{ label: 'Hospital Staff', href: '/admin/users', icon: Users }],
        },
      ];

    case 'HOSPITAL_STAFF':
      return [
        {
          section: 'OPERATIONS',
          items: [
            { label: 'Hospital Dashboard', href: '/hospital/dashboard', icon: LayoutDashboard },
            { label: 'Quick Scan', href: '/scan', icon: QrCode },
            { label: 'New Waste Batch', href: '/waste-batches/new', icon: PlusCircle },
            { label: 'Waste Directory', href: '/waste-batches', icon: Package },
          ],
        },
      ];

    case 'COLLECTION_STAFF':
      return [
        {
          section: 'FIELD WORKFLOW',
          items: [
            { label: 'Universal Scanner', href: '/scan', icon: QrCode },
            { label: 'Waste Directory', href: '/waste-batches', icon: Package },
          ],
        },
      ];

    case 'TRANSPORT_PERSONNEL':
      return [
        {
          section: 'DRIVER WORKFLOW',
          items: [
            { label: 'Driver Console', href: '/transport/driver-mode', icon: Truck },
            { label: 'Universal Scanner', href: '/scan', icon: QrCode },
            { label: 'Fleet Overview', href: '/transport/active', icon: Map },
          ],
        },
      ];

    case 'TREATMENT_FACILITY_STAFF':
      return [
        {
          section: 'FACILITY OPERATIONS',
          items: [
            { label: 'CBWTF Desk', href: '/treatment/dashboard', icon: LayoutDashboard },
            { label: 'Verify & Confirm', href: '/scan', icon: QrCode },
            { label: 'Inbound Batches', href: '/waste-batches', icon: Package },
            { label: 'Facility Alerts', href: '/alerts', icon: AlertTriangle },
          ],
        },
      ];

    case 'GOVERNMENT_AUTHORITY':
      return [
        {
          section: 'REGULATORY OVERSIGHT',
          items: [
            { label: 'Compliance Radar', href: '/government/dashboard', icon: LayoutDashboard },
            { label: 'Live GIS Fleet Map', href: '/government/map', icon: Map },
            { label: 'Statewide Batches', href: '/waste-batches', icon: Package },
            { label: 'Alerts & Violations', href: '/alerts', icon: AlertTriangle },
          ],
        },
        {
          section: 'REGULATORY SETTINGS',
          items: [
            { label: 'Facilities Directory', href: '/admin/facilities', icon: Building2 },
            { label: 'SLA Thresholds', href: '/admin/compliance-rules', icon: ShieldCheck },
          ],
        },
      ];

    case 'SUPER_ADMIN':
      return [
        {
          section: 'PLATFORM MONITORING',
          items: [
            { label: 'System Overview', href: '/government/dashboard', icon: LayoutDashboard },
            { label: 'Live GIS Fleet Map', href: '/government/map', icon: Map },
            { label: 'All Waste Batches', href: '/waste-batches', icon: Package },
            { label: 'Alerts & Violations', href: '/alerts', icon: AlertTriangle },
          ],
        },
        {
          section: 'GOVERNANCE & ADMIN',
          items: [
            { label: 'Admin Hub', href: '/admin', icon: LayoutDashboard },
            { label: 'Facilities Desk', href: '/admin/facilities', icon: Building2 },
            { label: 'User Directory', href: '/admin/users', icon: Users },
            { label: 'Waste Categories', href: '/admin/waste-categories', icon: Package },
            { label: 'Compliance SLAs', href: '/admin/compliance-rules', icon: ShieldCheck },
            { label: 'Immutable Audit Log', href: '/admin/audit-log', icon: Activity },
          ],
        },
      ];

    default:
      return [];
  }
}

export const Sidebar: React.FC = () => {
  const router = useRouter();
  const { user, dashboardPath } = useCurrentUser();
  const { clearAuth } = useAuthStore();
  const pathname = usePathname();

  const navSections = getNavItems(user?.role);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  return (
    <aside
      className="hidden lg:flex flex-col w-64 bg-neutral-900 border-r border-neutral-800 text-white flex-shrink-0 h-screen sticky top-0"
      aria-label="Primary sidebar navigation"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-800 flex-shrink-0">
        <Link href={dashboardPath} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white shadow-sm group-hover:bg-primary-hover transition-colors">
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white leading-tight">
              BioTrack
            </span>
            <span className="text-[10px] text-neutral-400 font-medium tracking-wider uppercase">
              VyomCare Enterprise
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.section && (
              <p className="px-3 text-[10px] font-bold text-neutral-500 tracking-wider uppercase mb-2">
                {section.section}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-white font-semibold shadow-xs'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-neutral-400')} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-75" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Card & Logout Footer */}
      <div className="p-3 border-t border-neutral-800 flex-shrink-0 bg-neutral-950/40">
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-200 truncate">{user?.name}</p>
            <p className="text-[10px] text-neutral-400 truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 rounded-md text-neutral-400 hover:text-status-danger hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
