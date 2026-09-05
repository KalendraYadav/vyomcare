'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { Bell, CheckCheck, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import { Notification } from '@/types/models';

export interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: isOpen,
    staleTime: 10_000,
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      description={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
      footer={
        <div className="flex items-center justify-between w-full">
          {notifications.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllMutation.mutate()}
              isLoading={markAllMutation.isPending}
              disabled={unreadCount === 0}
              className="text-xs gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </Button>
          ) : (
            <div />
          )}
          <Link
            href="/alerts"
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Violation Desk</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 border border-neutral-100 rounded-lg space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Operational notifications and violation alerts will appear here in real time."
        />
      ) : (
        <div className="divide-y divide-neutral-100 -mx-2">
          {notifications.map((item) => {
            const isUnread = !item.readAt;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isUnread) markReadMutation.mutate(item.id);
                }}
                className={`p-3.5 rounded-lg transition-colors cursor-pointer flex items-start gap-3 ${
                  isUnread ? 'bg-primary-subtle/50 hover:bg-primary-subtle' : 'hover:bg-neutral-50'
                }`}
              >
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isUnread ? 'bg-primary' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                    <AlertCircle className="w-3 h-3 text-neutral-400" />
                    <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-600">
                      {item.type.replace(/_/g, ' ')}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelative(item.createdAt)}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isUnread ? 'font-medium text-neutral-900' : 'text-neutral-700'}`}>
                    {item.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
};
