'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser, useAuthStore } from '@/stores/authStore';
import { usersApi, authApi, getAccessToken, setAccessToken } from '@/lib/api';
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

  // Attempt session hydration from HttpOnly cookie via /auth/refresh & /users/me if access token is not in memory
  const { isLoading: isResolvingMe, isError, data: meUser } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      let token = getAccessToken();
      if (!token) {
        const refreshData = await authApi.refresh();
        token = refreshData?.accessToken || null;
        if (token) {
          setAccessToken(token);
        }
      }
      const authUser = await usersApi.me();
      // If user is deactivated by admin, reject session immediately
      if ((authUser as unknown as { status?: string }).status === 'DEACTIVATED') {
        throw new Error('Account deactivated by administrator');
      }
      // If /users/me returned successfully, session is valid
      if (authUser) {
        setAuth(authUser, token || getAccessToken() || '');
      }
      return authUser;
    },
    enabled: !isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const isAuthed = isAuthenticated || Boolean(meUser);

  React.useEffect(() => {
    if (!isAuthed && !isResolvingMe && isError) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthed, isResolvingMe, isError, router, pathname]);

  if (!isAuthed && isResolvingMe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070B13]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">
            Validating Sovereign Security Clearance...
          </p>
        </div>
      </div>
    );
  }

  // If user is not authenticated and resolution failed, render blank while redirecting
  if (!isAuthed && !isResolvingMe) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-[#070B13] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Desktop Sidebar (w-64) */}
      <Sidebar />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader isSocketConnected={isConnected} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-[1720px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Dock (h-16) */}
        <MobileNav />
      </div>
    </div>
  );
}
