'use client';

import * as React from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/stores/authStore';

// Socket server URL (same origin host as backend on port 3001)
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001/notifications`
    : 'http://localhost:3001/notifications');

let socketInstance: Socket | null = null;

export function useSocket() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useCurrentUser();
  const [isConnected, setIsConnected] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        setIsConnected(false);
      }
      return;
    }

    // Reuse or instantiate socket client
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });
    }

    const socket = socketInstance;

    const onConnect = () => {
      setIsConnected(true);
      // Join authenticated user and role channels per design.md §17
      socket.emit('join', { userId: user.id, role: user.role });
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = () => {
      setIsConnected(false);
    };

    // Real-Time Invalidation: Transport Updates (design.md §17.1)
    const onTransportUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['transport', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['transport', 'my-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    // Real-Time Invalidation: Alert Notifications (design.md §17.1)
    const onAlertNew = () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['waste-batches'] });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('transport:update', onTransportUpdate);
    socket.on('alert:new', onAlertNew);

    if (socket.connected) {
      setIsConnected(true);
      socket.emit('join', { userId: user.id, role: user.role });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('transport:update', onTransportUpdate);
      socket.off('alert:new', onAlertNew);
    };
  }, [isAuthenticated, user, queryClient]);

  return { isConnected, socket: socketInstance };
}
