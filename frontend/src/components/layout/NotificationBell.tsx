'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { Bell } from 'lucide-react';
import { NotificationDrawer } from './NotificationDrawer';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  const { data } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000, // Background poll every 30s as fallback to Socket.IO
  });

  const count = data?.count || 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
        aria-label={`Notifications (${count} unread)`}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <NotificationDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
