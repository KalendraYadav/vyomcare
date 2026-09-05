'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser, useAuthStore } from '@/stores/authStore';
import { usersApi } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { useSocket } from '@/hooks/useSocket';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useCurrentUser();
  const { setAuth } = useAuthStore();
  const { isConnected } = useSocket();

  // Attempt session hydration from HttpOnly cookie via /users/me if access token is not in memory
  const { isLoading: isResolvingMe, isError } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const authUser = await usersApi.me();
      // If user is deactivated by admin, reject session immediately
      if ((authUser as unknown as { status?: string }).status === 'DEACTIVATED') {
        throw new Error('Account deactivated by administrator');
      }
      // If /users/me returned successfully, token was refreshed or already valid
      if (authUser) {
        setAuth(authUser, ''); // Session verified
      }
      return authUser;
    },
    enabled: !isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (!isAuthenticated && !isResolvingMe && isError) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isResolvingMe, isError, router, pathname]);

  if (!isAuthenticated && isResolvingMe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Validating secure session...
          </p>
        </div>
      </div>
    );
  }

  // If user is not authenticated and resolution failed, render blank while redirecting
  if (!isAuthenticated && !isResolvingMe) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Desktop Sidebar (w-64) */}
      <Sidebar />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader isSocketConnected={isConnected} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Dock (h-16) */}
        <MobileNav />
      </div>
    </div>
  );
}
