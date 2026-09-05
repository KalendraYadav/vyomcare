'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser, useAuthStore } from '@/lib/auth-store';
import { authApi } from '@/lib/api';
import {
  LayoutDashboard, Package, QrCode, Map, Building2, ShieldCheck,
  AlertTriangle, Users, Settings, LogOut, Activity, Truck, ClipboardList,
  FileBarChart, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }

function getNavItems(role: string | undefined): NavItem[] {
  switch (role) {
    case 'HOSPITAL_ADMIN':
    case 'HOSPITAL_STAFF':
      return [
        { label: 'Dashboard', href: '/hospital', icon: LayoutDashboard },
        { label: 'Register Waste', href: '/hospital/waste/new', icon: Package },
        { label: 'Waste Batches', href: '/hospital/waste', icon: ClipboardList },
        ...(role === 'HOSPITAL_ADMIN' ? [{ label: 'Users', href: '/hospital/users', icon: Users }] : []),
      ];
    case 'COLLECTION_STAFF':
      return [
        { label: 'Scan', href: '/scan', icon: QrCode },
        { label: 'My Pickups', href: '/collection/pickups', icon: ClipboardList },
      ];
    case 'TRANSPORT_PERSONNEL':
      return [
        { label: 'My Assignment', href: '/transport/active', icon: Truck },
        { label: 'Scan', href: '/scan', icon: QrCode },
      ];
    case 'TREATMENT_FACILITY_STAFF':
      return [
        { label: 'Dashboard', href: '/facility', icon: LayoutDashboard },
        { label: 'Scan to Verify', href: '/scan', icon: QrCode },
      ];
    case 'GOVERNMENT_AUTHORITY':
      return [
        { label: 'Dashboard', href: '/government', icon: LayoutDashboard },
        { label: 'Alerts', href: '/government/alerts', icon: AlertTriangle },
        { label: 'Facilities', href: '/government/facilities', icon: Building2 },
        { label: 'Live Transport', href: '/transport/live', icon: Map },
        { label: 'Analytics', href: '/government/analytics', icon: FileBarChart },
        { label: 'Compliance Rules', href: '/admin/compliance-rules', icon: ShieldCheck },
      ];
    case 'SUPER_ADMIN':
      return [
        { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { label: 'Facilities', href: '/admin/facilities', icon: Building2 },
        { label: 'Users', href: '/admin/users', icon: Users },
        { label: 'Waste Categories', href: '/admin/waste-categories', icon: Package },
        { label: 'Compliance Rules', href: '/admin/compliance-rules', icon: ShieldCheck },
        { label: 'Alerts', href: '/government/alerts', icon: AlertTriangle },
        { label: 'Live Transport', href: '/transport/live', icon: Map },
        { label: 'Audit Log', href: '/admin/audit-log', icon: Activity },
      ];
    default:
      return [];
  }
}

export function Sidebar() {
  const { user, dashboardPath } = useCurrentUser();
  const { clearAuth } = useAuthStore();
  const pathname = usePathname();

  const navItems = getNavItems(user?.role);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    window.location.href = '/login';
  };

  return (
    <nav
      className="sidebar flex-shrink-0"
      aria-label="Primary navigation"
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-neutral-800">
        <Link href={dashboardPath} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-heading-sm">BioTrack</span>
        </Link>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul role="list" className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn('sidebar-item', isActive && 'active')}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-neutral-800">
        <div className="mb-3">
          <p className="text-neutral-300 text-label font-medium truncate">{user?.name}</p>
          <p className="text-neutral-500 text-caption truncate">{user?.email}</p>
          <span className="inline-block mt-1 text-xs text-neutral-400 bg-neutral-800 rounded px-2 py-0.5">
            {user?.role?.replace(/_/g, ' ')}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-left text-neutral-400 hover:text-status-danger hover:bg-neutral-800"
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>
    </nav>
  );
}
