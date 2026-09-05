'use client';

import * as React from 'react';
import { transportApi } from '@/lib/api';

interface UseGeolocationOptions {
  enabled?: boolean;
  transportAssignmentId?: string | null;
  pingIntervalMs?: number;
}

export type GeolocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useGeolocation({
  enabled = false,
  transportAssignmentId,
  pingIntervalMs = 30_000,
}: UseGeolocationOptions) {
  const [coords, setCoords] = React.useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [lastPingAt, setLastPingAt] = React.useState<string | null>(null);
  const [permissionState, setPermissionState] = React.useState<GeolocationPermissionState>('prompt');
  const [error, setError] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState<boolean>(false);

  const watchIdRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestCoordsRef = React.useRef<{ latitude: number; longitude: number } | null>(null);

  // Check initial browser permission status if supported
  React.useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setPermissionState('unsupported');
      setError('Geolocation is not supported by your browser or device hardware.');
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          setPermissionState(status.state as GeolocationPermissionState);
          status.onchange = () => {
            setPermissionState(status.state as GeolocationPermissionState);
          };
        })
        .catch(() => {
          // Fallback if permissions query fails
        });
    }
  }, []);

  // Send ping helper
  const sendGpsPing = React.useCallback(
    async (lat: number, lng: number) => {
      if (!transportAssignmentId || isSending) return;

      setIsSending(true);
      try {
        await transportApi.ingestGps({
          transportAssignmentId,
          latitude: lat,
          longitude: lng,
        });
        setLastPingAt(new Date().toISOString());
        setError(null);
      } catch (err) {
        console.error('Failed to dispatch GPS telemetry ping:', err);
        // Do not crash, keep trying on next cycle
      } finally {
        setIsSending(false);
      }
    },
    [transportAssignmentId, isSending]
  );

  // Primary tracking effect
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !navigator.geolocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setCoords(current);
      latestCoordsRef.current = { latitude: current.latitude, longitude: current.longitude };
      setPermissionState('granted');
      setError(null);
    };

    const handleError = (geoError: GeolocationPositionError) => {
      let msg = 'Failed to acquire device location.';
      if (geoError.code === geoError.PERMISSION_DENIED) {
        msg = 'Location permission denied. Please allow GPS access in browser settings.';
        setPermissionState('denied');
      } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
        msg = 'GPS signal lost or unavailable.';
      } else if (geoError.code === geoError.TIMEOUT) {
        msg = 'Location acquisition timed out.';
      }
      setError(msg);
    };

    // 1. Initial position lock
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 5_000,
    });

    // 2. Continuous position watcher
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 10_000,
    });

    // 3. Periodic telemetry sender (30s interval per design.md §18.6)
    if (transportAssignmentId) {
      // Send immediate first ping if coordinates are already available
      if (latestCoordsRef.current) {
        sendGpsPing(latestCoordsRef.current.latitude, latestCoordsRef.current.longitude);
      }

      timerRef.current = setInterval(() => {
        if (latestCoordsRef.current) {
          sendGpsPing(latestCoordsRef.current.latitude, latestCoordsRef.current.longitude);
        }
      }, pingIntervalMs);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, transportAssignmentId, pingIntervalMs, sendGpsPing]);

  return {
    coords,
    lastPingAt,
    permissionState,
    error,
    isSending,
    sendGpsPing,
  };
}
