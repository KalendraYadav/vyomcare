'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/stores/authStore';
import { LayoutDashboard, Package, QrCode, AlertTriangle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const { dashboardPath, canScan } = useCurrentUser();

  const isHomeActive = pathname === dashboardPath;
  const isBatchesActive = pathname.startsWith('/waste-batches');
  const isScanActive = pathname === '/scan';
  const isAlertsActive = pathname.startsWith('/alerts');

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-neutral-200 z-40 px-3 flex items-center justify-around shadow-lg">
      {/* Home / Dashboard */}
      <Link
        href={dashboardPath}
        className={cn(
          'flex flex-col items-center justify-center min-w-[60px] h-full transition-colors',
          isHomeActive ? 'text-primary' : 'text-neutral-500 hover:text-neutral-800',
        )}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-1">Home</span>
      </Link>

      {/* Waste Batches */}
      <Link
        href="/waste-batches"
        className={cn(
          'flex flex-col items-center justify-center min-w-[60px] h-full transition-colors',
          isBatchesActive ? 'text-primary' : 'text-neutral-500 hover:text-neutral-800',
        )}
      >
        <Package className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-1">Batches</span>
      </Link>

      {/* Center Elevated Floating Action Button (FAB) for QR Scan (design.md §10.2) */}
      {canScan ? (
        <Link
          href="/scan"
          className="relative -top-5 flex flex-col items-center justify-center"
          aria-label="Universal QR Scanner"
        >
          <div
            className={cn(
              'w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-xl border-4 border-white transition-transform active:scale-95',
              isScanActive && 'ring-2 ring-primary ring-offset-2',
            )}
          >
            <QrCode className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-neutral-800 mt-0.5">SCAN</span>
        </Link>
      ) : (
        <div className="w-14" />
      )}

      {/* Alerts */}
      <Link
        href="/alerts"
        className={cn(
          'flex flex-col items-center justify-center min-w-[60px] h-full transition-colors',
          isAlertsActive ? 'text-primary' : 'text-neutral-500 hover:text-neutral-800',
        )}
      >
        <AlertTriangle className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-1">Alerts</span>
      </Link>

      {/* Quick Menu / Profile */}
      <Link
        href={dashboardPath}
        className="flex flex-col items-center justify-center min-w-[60px] h-full text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-1">Menu</span>
      </Link>
    </div>
  );
};
