/**
 * AC7 Ride — session store
 *
 * The Go auth service issues a single access token; there is no refresh
 * endpoint. So the rules are simple:
 *
 *   - persist the token and the user record
 *   - decode the JWT locally only to read `exp` and `role` for routing
 *   - never trust the local decode for authorisation — the backend enforces
 *     roles via middleware.RequireRole on every protected route
 *   - on 401, clear everything and bounce to /login
 *
 * Storage is localStorage. That is a deliberate trade-off: it survives a
 * refresh, which users expect, at the cost of XSS exposure. The mitigation is
 * that we never render un-escaped HTML anywhere in this app.
 */

import type { User, UserRole } from '@shared/api/types';

const TOKEN_KEY = 'ac7.token';
const USER_KEY = 'ac7.user';

/** Claims the Go backend puts in the JWT (pkg/middleware/auth.go). */
interface JwtClaims {
  user_id: string;
  email: string;
  role: UserRole;
  exp?: number;
  iat?: number;
}

type Listener = (session: Session | null) => void;

export interface Session {
  token: string;
  user: User;
}

const listeners = new Set<Listener>();

function notify(session: Session | null): void {
  for (const listener of listeners) listener(session);
}

/** Base64url-decode and parse the JWT payload. Returns null if malformed. */
function decodeClaims(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );

    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** True when the token is absent, malformed, or past its `exp`. */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  const claims = decodeClaims(token);
  if (!claims?.exp) return false; // no exp claim → let the server decide

  // 30s of clock skew tolerance.
  return claims.exp * 1000 <= Date.now() + 30_000;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return null;
  if (isTokenExpired(token)) return null;
  return { token, user };
}

export function setSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify({ token, user });
}

/** Update the cached user without touching the token (e.g. after profile edit). */
export function updateUser(user: User): void {
  const token = getToken();
  if (!token) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify({ token, user });
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notify(null);
}

/**
 * Role for routing decisions. Prefers the JWT claim over the cached user
 * record, because the token is what the backend will actually enforce.
 */
export function getRole(): UserRole | null {
  const token = getToken();
  if (token) {
    const claims = decodeClaims(token);
    if (claims?.role) return claims.role;
  }
  return getUser()?.role ?? null;
}

/** Subscribe to session changes. Returns an unsubscribe function. */
export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Keep tabs in sync: a logout in one tab logs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === USER_KEY) {
      notify(getSession());
    }
  });
}
