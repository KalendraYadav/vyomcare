'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentUser, useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import { NotificationBell } from './NotificationBell';
import { QrCode, LogOut, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AppHeaderProps {
  isSocketConnected?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isSocketConnected = true }) => {
  const router = useRouter();
  const { user, canScan } = useCurrentUser();
  const { clearAuth } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

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

  const roleDisplay = user?.role?.replace(/_/g, ' ') || 'USER';
  const facilityName = user?.facility?.name || (user?.role === 'SUPER_ADMIN' ? 'Statewide System Console' : 'BioTrack Network');

  return (
    <header className="h-16 border-b border-neutral-200 bg-white sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-2xs">
      {/* Left: Facility Name & Role Tag */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 truncate">
          <Building2 className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <span className="text-sm font-bold text-neutral-800 truncate max-w-[200px] sm:max-w-[320px]">
            {facilityName}
          </span>
        </div>
        <span className="hidden sm:inline-flex items-center text-[11px] font-semibold tracking-wider text-primary bg-primary-subtle border border-primary/20 px-2 py-0.5 rounded uppercase">
          {roleDisplay}
        </span>
      </div>

      {/* Center: WebSocket Real-Time Connection Indicator (design.md §10.3) */}
      <div className="hidden md:flex items-center gap-2 text-xs text-neutral-500 font-medium">
        <div className="relative flex items-center justify-center">
          {isSocketConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-status-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success" />
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-pending" />
          )}
        </div>
        <span>{isSocketConnected ? 'Real-time Gateway Active' : 'Connecting to Gateway...'}</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {canScan && (
          <Link href="/scan">
            <Button size="sm" variant="outline" className="hidden sm:inline-flex gap-1.5 font-semibold">
              <QrCode className="w-4 h-4 text-primary" />
              <span>Quick Scan</span>
            </Button>
          </Link>
        )}

        <NotificationBell />

        {/* User Profile / Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-700 cursor-pointer"
            aria-label="User profile menu"
            aria-expanded={userMenuOpen}
          >
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
              {user?.name ? user.name.slice(0, 2) : <User className="w-4 h-4" />}
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-modal border border-neutral-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{user?.name}</p>
                  <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                  <div className="mt-1.5">
                    <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded uppercase">
                      {roleDisplay}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-xs font-medium text-status-danger hover:bg-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
