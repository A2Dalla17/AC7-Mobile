/**
 * AC7 Ride — realtime React bindings
 *
 * Thin hooks over the shared socket in lib/ws.ts. Every subscription is
 * cleaned up on unmount, which matters: leaked handlers on a long-lived socket
 * are how tracking screens end up updating stale state.
 */

import { useEffect, useRef, useState } from 'react';

import { realtime, type WsEventType, type WsMessage, type WsStatus } from '@shared/lib/ws';

/** Current connection status, re-rendering on change. */
export function useRealtimeStatus(): WsStatus {
  const [status, setStatus] = useState<WsStatus>(() => realtime.getStatus());

  useEffect(() => realtime.onStatus(setStatus), []);

  return status;
}

/**
 * Subscribe to a message type.
 *
 * The handler is held in a ref so callers can pass an inline closure without
 * resubscribing on every render.
 */
export function useRealtimeEvent<T = Record<string, unknown>>(
  type: WsEventType | '*',
  handler: (message: WsMessage<T>) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    return realtime.on(type, (message) => {
      handlerRef.current(message as WsMessage<T>);
    });
  }, [type, enabled]);
}

/**
 * Subscribe to events for one ride, ignoring traffic for any other.
 * Used by the rider tracking screen and the driver's active-trip screen.
 */
export function useRideEvents<T = Record<string, unknown>>(
  rideId: string | null | undefined,
  type: WsEventType,
  handler: (message: WsMessage<T>) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!rideId) return;

    return realtime.on(type, (message) => {
      if (message.ride_id && message.ride_id !== rideId) return;
      handlerRef.current(message as WsMessage<T>);
    });
  }, [rideId, type]);
}
