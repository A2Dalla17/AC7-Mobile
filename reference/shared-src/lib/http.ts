/**
 * AC7 Ride — HTTP client
 *
 * Speaks the exact envelope the Go backend returns (pkg/common/response.go):
 *
 *   { success, data, meta?, error?: { code, error_code, message }, correlation_id? }
 *
 * Responsibilities:
 *   - unwrap `.data` so callers get the payload, not the envelope
 *   - surface `.error.message` as a typed ApiError, with correlation_id kept
 *     for support tickets
 *   - attach `Authorization: Bearer <token>` from the session
 *   - send `Idempotency-Key` on POST/PUT/PATCH (the backend honours it)
 *   - on 401, clear the session and hand control to the auth listener
 *   - expose rate-limit headers so the UI can back off instead of hammering
 */

import { env } from '@shared/config/env';
import { PREVIEW_BUILD } from '@shared/preview/flag';
import { clearSession, getToken } from '@shared/lib/session';

/* -------------------------------------------------------------------------- */
/* Envelope                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApiMeta {
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: ApiMeta;
  error?: {
    code?: number;
    error_code?: string;
    message?: string;
    details?: unknown;
  };
  correlation_id?: string;
}

/** Result carrying pagination metadata alongside the payload. */
export interface Paged<T> {
  items: T;
  meta: ApiMeta;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string | undefined;
  readonly correlationId: string | undefined;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    errorCode?: string,
    correlationId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.correlationId = correlationId;
    this.details = details;
  }

  /** 401/403 — the user needs to sign in again or lacks the role. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** 429 — caller should back off. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Network failure or 5xx — worth retrying. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  /** Copy suitable for showing a user. Never leaks internals. */
  get userMessage(): string {
    if (this.status === 0) return 'Cannot reach AC7 Ride. Check your connection and try again.';
    if (this.status === 401) return 'Your session has expired. Please sign in again.';
    if (this.status === 403) return "You don't have permission to do that.";
    if (this.status === 404) return 'We could not find what you were looking for.';
    if (this.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (this.status >= 500) return 'Something went wrong on our side. Please try again shortly.';
    return this.message || 'Something went wrong.';
  }
}

/* -------------------------------------------------------------------------- */
/* Auth failure hook                                                           */
/* -------------------------------------------------------------------------- */

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registered once by the app shell. Called after the session is cleared so the
 * router can redirect to /login. Kept as a hook rather than importing the
 * router here, which would create a cycle.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                               */
/* -------------------------------------------------------------------------- */

export interface RateLimitState {
  limit: number;
  remaining: number;
  resetAt: number | null;
}

let lastRateLimit: RateLimitState | null = null;

/** Most recent X-RateLimit-* values seen. Useful for a debug panel. */
export function getRateLimitState(): RateLimitState | null {
  return lastRateLimit;
}

function captureRateLimit(headers: Headers): void {
  const limit = headers.get('X-RateLimit-Limit');
  if (!limit) return;

  const reset = headers.get('X-RateLimit-Reset');
  lastRateLimit = {
    limit: Number(limit),
    remaining: Number(headers.get('X-RateLimit-Remaining') ?? 0),
    resetAt: reset ? Number(reset) * 1000 : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Request                                                                     */
/* -------------------------------------------------------------------------- */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON body. Omit for GET/DELETE. */
  body?: unknown;
  /** Appended as a query string. `undefined` and `null` values are dropped. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the Authorization header (login, register, public share links). */
  anonymous?: boolean;
  /** Abort signal, wired to React Query cancellation. */
  signal?: AbortSignal;
  /**
   * Path is absolute and should not be prefixed with /api/v1.
   * The maps service mounts at /maps, so it needs this.
   */
  rawPath?: boolean;
  /** Request timeout in ms. Default 20s. */
  timeoutMs?: number;
}

function buildUrl(path: string, options: RequestOptions): string {
  const prefix = options.rawPath ? '' : env.apiPrefix;
  const url = new URL(
    `${env.apiBaseUrl}${prefix}${path}`,
    // Base is only used when apiBaseUrl is empty (dev proxy).
    window.location.origin,
  );

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/** RFC 4122 v4, via crypto when available. Used for Idempotency-Key. */
function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Core request. Returns the unwrapped `data` payload.
 * Throws ApiError on any non-2xx or on `success: false`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal, timeoutMs = 20_000 } = options;

  // PREVIEW_MODE — design-preview builds answer from fixtures. `env.previewMode`
  // is false everywhere except the Vercel preview project, so this branch is
  // dead code in a real build and the bundler drops it. See src/preview/.
  if (PREVIEW_BUILD) {
    const { mockRequest } = await import('@shared/preview/mockApi');
    const mocked = await mockRequest(path, method, body);
    if (mocked !== undefined) return mocked as T;
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!anonymous) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // The backend de-duplicates mutations keyed on this header.
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    headers['Idempotency-Key'] = idempotencyKey();
  }

  // Compose the caller's signal with our own timeout.
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const onCallerAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutController.signal,
      credentials: 'same-origin',
    });
  } catch (cause) {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);

    // A caller-initiated abort is not an error worth surfacing.
    if (signal?.aborted) throw cause;

    throw new ApiError('Network request failed', 0, 'NETWORK_ERROR', undefined, cause);
  }

  clearTimeout(timer);
  signal?.removeEventListener('abort', onCallerAbort);

  captureRateLimit(response.headers);

  // 204 and other empty bodies.
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    if (!response.ok) {
      throw new ApiError(`Request failed (${response.status})`, response.status);
    }
    return undefined as T;
  }

  let envelope: Envelope<T> | null = null;
  const rawText = await response.text();

  if (rawText) {
    try {
      envelope = JSON.parse(rawText) as Envelope<T>;
    } catch {
      // Gateway errors (Kong, nginx) can be HTML rather than JSON.
      if (!response.ok) {
        throw new ApiError(
          `Unexpected response from server (${response.status})`,
          response.status,
          'BAD_GATEWAY_RESPONSE',
        );
      }
      throw new ApiError('Malformed response from server', response.status, 'PARSE_ERROR');
    }
  }

  if (!response.ok || envelope?.success === false) {
    const message = envelope?.error?.message || `Request failed (${response.status})`;

    if (response.status === 401) {
      clearSession();
      onUnauthorized?.();
    }

    throw new ApiError(
      message,
      response.status,
      envelope?.error?.error_code,
      envelope?.correlation_id,
      envelope?.error?.details,
    );
  }

  return (envelope?.data ?? (undefined as T)) as T;
}

/**
 * Like `request`, but also returns pagination metadata.
 * Use for any list endpoint that sets `meta`.
 */
export async function requestPaged<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Paged<T>> {
  // PREVIEW_MODE — see the note in `request`.
  if (PREVIEW_BUILD) {
    const { mockRequest } = await import('@shared/preview/mockApi');
    const mocked = await mockRequest(path, options.method ?? 'GET', options.body);
    if (mocked !== undefined) {
      const items = mocked as T;
      const total = Array.isArray(items) ? items.length : 0;
      return { items, meta: { page: 1, per_page: total, total, total_pages: 1 } };
    }
  }

  // Re-implemented rather than wrapping `request` because we need the envelope.
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (!options.anonymous) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, options), {
    method,
    headers,
    signal: options.signal ?? null,
    credentials: 'same-origin',
  }).catch((cause) => {
    throw new ApiError('Network request failed', 0, 'NETWORK_ERROR', undefined, cause);
  });

  captureRateLimit(response.headers);

  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;

  if (!response.ok || envelope?.success === false) {
    if (response.status === 401) {
      clearSession();
      onUnauthorized?.();
    }
    throw new ApiError(
      envelope?.error?.message || `Request failed (${response.status})`,
      response.status,
      envelope?.error?.error_code,
      envelope?.correlation_id,
    );
  }

  return {
    items: (envelope?.data ?? []) as T,
    meta: envelope?.meta ?? {},
  };
}

/* -------------------------------------------------------------------------- */
/* Verb helpers                                                                */
/* -------------------------------------------------------------------------- */

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),

  paged: requestPaged,
};
