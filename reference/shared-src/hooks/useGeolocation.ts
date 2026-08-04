import { useCallback, useEffect, useRef, useState } from 'react';

import type { LatLng } from '@shared/api/types';
import { env } from '@shared/config/env';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface GeolocationState {
  position: LatLng | null;
  heading: number | null;
  accuracy: number | null;
  permission: PermissionState;
  error: string | null;
  /** True until the first fix arrives or the request fails. */
  isLocating: boolean;
}

/**
 * Browser geolocation.
 *
 * `watch` keeps a live subscription — used by the driver app, which pushes
 * position to /geo/location. The rider app takes a single fix, since polling
 * the rider's GPS drains battery for no benefit once pickup is set.
 *
 * Falls back to the configured default centre so the map always has somewhere
 * sensible to sit.
 */
export function useGeolocation({ watch = false }: { watch?: boolean } = {}): GeolocationState & {
  request: () => void;
} {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    heading: null,
    accuracy: null,
    permission: 'prompt',
    error: null,
    isLocating: false,
  });

  const watchId = useRef<number | null>(null);

  const handleSuccess = useCallback((fix: GeolocationPosition) => {
    setState({
      position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
      heading: fix.coords.heading,
      accuracy: fix.coords.accuracy,
      permission: 'granted',
      error: null,
      isLocating: false,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      permission: error.code === error.PERMISSION_DENIED ? 'denied' : prev.permission,
      isLocating: false,
      error:
        error.code === error.PERMISSION_DENIED
          ? 'Location access was denied. You can still search for a pickup address.'
          : error.code === error.TIMEOUT
            ? 'Finding your location took too long.'
            : 'Could not determine your location.',
    }));
  }, []);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({
        ...prev,
        permission: 'unsupported',
        error: 'This browser does not support location services.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLocating: true, error: null }));

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: watch ? 0 : 30_000,
    };

    if (watch) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
    }
  }, [watch, handleSuccess, handleError]);

  useEffect(() => {
    request();

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [request]);

  return { ...state, request };
}

/** Position with the configured default substituted when unavailable. */
export function usePositionOrDefault(): LatLng {
  const { position } = useGeolocation();
  return position ?? env.defaultMapCenter;
}
