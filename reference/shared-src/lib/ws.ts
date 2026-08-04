/**
 * AC7 Ride — realtime client
 *
 * Connects to the Go realtime service:
 *
 *   GET /api/v1/ws?token=<jwt>
 *
 * The token goes in the query string because browsers cannot set headers on a
 * WebSocket handshake. The backend explicitly supports this
 * (pkg/middleware/auth.go reads `c.Query("token")`).
 *
 * Wire format (pkg/websocket/client.go):
 *
 *   { type, ride_id?, user_id?, timestamp, data }
 *
 * Design notes:
 *   - one socket per app, shared by every subscriber
 *   - exponential backoff with jitter, capped, so a backend restart does not
 *     produce a thundering herd
 *   - heartbeat ping so proxies do not silently drop an idle connection
 *   - queues outbound frames while reconnecting instead of throwing
 */

import { env } from '@shared/config/env';
import { getToken } from '@shared/lib/session';

/* -------------------------------------------------------------------------- */
/* Message types                                                               */
/* -------------------------------------------------------------------------- */

/** Event names observed in the backend hub and broadcasters. */
export type WsEventType =
  | 'location_update'
  | 'driver_location'
  | 'ride_status_update'
  | 'ride_update'
  | 'driver_eta'
  | 'chat_message'
  | 'notification'
  | 'ping'
  | 'pong';

export interface WsMessage<T = Record<string, unknown>> {
  type: WsEventType | string;
  ride_id?: string;
  user_id?: string;
  timestamp: string;
  data: T;
}

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'reconnecting';

type MessageHandler = (message: WsMessage) => void;
type StatusHandler = (status: WsStatus) => void;

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private status: WsStatus = 'idle';
  private attempt = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** Frames queued while the socket is down. */
  private outbox: WsMessage[] = [];

  /** type → handlers. `*` receives everything. */
  private handlers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();

  /** Set when the caller explicitly disconnected; suppresses reconnection. */
  private intentionallyClosed = false;

  /* ---------------------------------------------------------------------- */

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = getToken();
    if (!token) {
      // Nothing to authenticate with — stay idle rather than looping on 401.
      this.setStatus('idle');
      return;
    }

    this.intentionallyClosed = false;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    const url = `${env.wsBaseUrl}${env.apiPrefix}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.attempt = 0;
      this.setStatus('open');
      this.startHeartbeat();
      this.flushOutbox();
    };

    this.socket.onmessage = (event: MessageEvent<string>) => {
      let message: WsMessage;
      try {
        message = JSON.parse(event.data) as WsMessage;
      } catch {
        return; // ignore unparseable frames
      }

      if (message.type === 'pong') return;

      this.dispatch(message);
    };

    this.socket.onerror = () => {
      // onclose always follows; reconnection is handled there.
    };

    this.socket.onclose = () => {
      this.stopHeartbeat();
      this.socket = null;

      if (this.intentionallyClosed) {
        this.setStatus('closed');
        return;
      }

      this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.intentionallyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();
    this.outbox = [];
    this.attempt = 0;

    this.socket?.close(1000, 'client disconnect');
    this.socket = null;
    this.setStatus('closed');
  }

  /** Drop and re-establish — call after login so the new token is used. */
  reconnectWithFreshToken(): void {
    this.disconnect();
    this.attempt = 0;
    this.connect();
  }

  /* ---------------------------------------------------------------------- */

  /**
   * Subscribe to a message type. Pass `*` for every message.
   * Returns an unsubscribe function — always call it on unmount.
   */
  on(type: WsEventType | '*', handler: MessageHandler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);

    return () => {
      set?.delete(handler);
      if (set?.size === 0) this.handlers.delete(type);
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status); // emit current value immediately
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): WsStatus {
    return this.status;
  }

  /** Send a frame. Queued if the socket is not open yet. */
  send(type: string, data: Record<string, unknown>, rideId?: string): void {
    const message: WsMessage = {
      type,
      timestamp: new Date().toISOString(),
      data,
      ...(rideId ? { ride_id: rideId } : {}),
    };

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    // Bound the queue so a long outage cannot exhaust memory.
    if (this.outbox.length < 50) this.outbox.push(message);
  }

  /* ---------------------------------------------------------------------- */

  private dispatch(message: WsMessage): void {
    for (const handler of this.handlers.get(message.type) ?? []) {
      try {
        handler(message);
      } catch (error) {
        if (env.isDev) console.error('[ws] handler threw', error);
      }
    }

    for (const handler of this.handlers.get('*') ?? []) {
      try {
        handler(message);
      } catch (error) {
        if (env.isDev) console.error('[ws] wildcard handler threw', error);
      }
    }
  }

  private setStatus(status: WsStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const handler of this.statusHandlers) handler(status);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    // Exponential backoff with full jitter.
    const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** this.attempt, MAX_BACKOFF_MS);
    const delay = Math.random() * ceiling;

    this.attempt += 1;
    this.setStatus('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({ type: 'ping', timestamp: new Date().toISOString(), data: {} }),
        );
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushOutbox(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const queued = this.outbox;
    this.outbox = [];
    for (const message of queued) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

/** Shared singleton. */
export const realtime = new RealtimeClient();

// Reconnect promptly when the tab comes back to the foreground — mobile
// browsers freeze sockets in background tabs.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && realtime.getStatus() === 'reconnecting') {
      realtime.connect();
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (realtime.getStatus() !== 'open') realtime.connect();
  });
}
