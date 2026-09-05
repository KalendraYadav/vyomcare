'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/stores/authStore';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, dashboardPath } = useCurrentUser();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(dashboardPath);
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, dashboardPath, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-label text-neutral-500 font-medium">Initializing BioTrack session...</p>
      </div>
    </div>
  );
}
