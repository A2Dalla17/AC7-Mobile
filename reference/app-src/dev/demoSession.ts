/**
 * ⚠️  TEMPORARY — DELETE THIS FILE BEFORE LAUNCH  ⚠️
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A development-only "skip login" that fabricates a session so every screen
 * can be opened and reviewed without a working backend account.
 *
 * WHAT IT DOES NOT DO
 *   It does not grant access to anything. The token below is unsigned
 *   nonsense — the Go backend verifies HS256 against JWT_SECRET and will
 *   reject every request made with it. Screens will render with their empty
 *   and error states, which is exactly what you want for a design review.
 *   Nothing here weakens real authentication.
 *
 * SAFETY
 *   Every entry point is gated on `import.meta.env.DEV`, which Vite replaces
 *   with the literal `false` in `vite build`. The demo branches are then
 *   dead code and get dropped by the minifier, so this cannot reach a
 *   production bundle even if someone forgets to delete the file.
 *
 * TO REMOVE — three places, all marked with the string `DEMO_MODE`:
 *   1. delete `src/dev/`
 *   2. `src/providers/AuthProvider.tsx`  — two guarded blocks
 *   3. `src/routes/auth/LoginPage.tsx`   — the <DemoSkipPanel /> block
 *   Then run `npx tsc --noEmit`; it will point at anything missed.
 */

import type { User, UserRole } from '@shared/api/types';
import { setSession } from '@shared/lib/session';
import { PREVIEW_BUILD, getPreviewRole, setPreviewRole } from '@shared/preview/flag';

/** Marks a fabricated token so the real auth paths can recognise and skip it. */
const DEMO_ISSUER = 'ac7-demo-skip-login';

/**
 * Enabled in two situations, and only these two:
 *
 *   `vite dev`                   — local development
 *   VITE_PREVIEW_MODE=true       — the Vercel design-preview build
 *
 * Both are compile-time constants, so a real production build with a real
 * backend inlines this to `false` and the bundler drops everything below.
 */
export const DEMO_ENABLED = import.meta.env.DEV || PREVIEW_BUILD;

/* -------------------------------------------------------------------------- */
/* Fake identities                                                            */
/* -------------------------------------------------------------------------- */

const NOW = new Date().toISOString();

const PROFILES: Record<UserRole, Omit<User, 'role'>> = {
  rider: {
    id: 'demo-rider-0000-0000-000000000001',
    email: 'demo.rider@ac7ride.test',
    phone_number: '+447700900001',
    first_name: 'Amina',
    last_name: 'Yusuf',
    is_active: true,
    is_verified: true,
    profile_image: null,
    created_at: NOW,
    updated_at: NOW,
  },
  driver: {
    id: 'demo-driver-0000-0000-00000000002',
    email: 'demo.driver@ac7ride.test',
    phone_number: '+447700900002',
    first_name: 'Omar',
    last_name: 'Farah',
    is_active: true,
    is_verified: true,
    profile_image: null,
    created_at: NOW,
    updated_at: NOW,
  },
  admin: {
    id: 'demo-admin-0000-0000-000000000003',
    email: 'demo.admin@ac7ride.test',
    phone_number: '+447700900003',
    first_name: 'Abdullahi',
    last_name: 'Mohamud',
    is_active: true,
    is_verified: true,
    profile_image: null,
    created_at: NOW,
    updated_at: NOW,
  },
};

/* -------------------------------------------------------------------------- */
/* Token                                                                       */
/* -------------------------------------------------------------------------- */

/** Unicode-safe base64url, matching what `lib/session.ts` decodes. */
function base64url(value: object): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Builds a structurally valid but cryptographically worthless JWT.
 *
 * It has the shape `lib/session.ts` expects — three dot-separated segments
 * with `role` and `exp` in the payload — so `getRole()` and `isTokenExpired()`
 * work without special-casing. The signature segment is a literal string, not
 * an HMAC, so the backend rejects it on sight.
 */
function buildDemoToken(role: UserRole): string {
  const profile = PROFILES[role];

  const header = base64url({ alg: 'none', typ: 'JWT' });
  const payload = base64url({
    user_id: profile.id,
    email: profile.email,
    role,
    iss: DEMO_ISSUER,
    demo: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  });

  return `${header}.${payload}.not-a-real-signature`;
}

/* -------------------------------------------------------------------------- */
/* Public surface                                                              */
/* -------------------------------------------------------------------------- */

/** The fabricated user for a role, as the app's own `User` type. */
export function demoUser(role: UserRole): User {
  return { ...PROFILES[role], role };
}

/**
 * True when the stored token is one of ours.
 *
 * Read straight from localStorage rather than through `getSession()` so this
 * stays callable from anywhere without an import cycle.
 */
export function isDemoSession(): boolean {
  if (!DEMO_ENABLED) return false;

  try {
    const token = localStorage.getItem('ac7.token');
    if (!token) return false;

    const payload = token.split('.')[1];
    if (!payload) return false;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded)) as { iss?: string };

    return claims.iss === DEMO_ISSUER;
  } catch {
    return false;
  }
}

/** Writes the fabricated session. The caller navigates afterwards. */
export function startDemoSession(role: UserRole): User {
  if (!DEMO_ENABLED) {
    throw new Error('Demo sign-in is unavailable outside development.');
  }

  const user = demoUser(role);

  // Keep the fixture layer in step, so the mocked API answers as the same
  // person the session claims to be.
  setPreviewRole(role);
  setSession(buildDemoToken(role), user);

  return user;
}

/**
 * In a preview build there is no way to sign in — there is no backend to sign
 * in to — so the app bootstraps straight into a session. Called once from
 * AuthProvider before it decides whether to redirect to /login.
 */
export function ensurePreviewSession(): User | null {
  if (!PREVIEW_BUILD) return null;
  if (isDemoSession()) return demoUser(getPreviewRole());
  return startDemoSession(getPreviewRole());
}
