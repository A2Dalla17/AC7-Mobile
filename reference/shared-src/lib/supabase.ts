import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * AC7 Ride — Supabase client
 *
 * ── What this key is, and why it being public is fine ──────────────────────
 * The publishable key below ships inside the JavaScript bundle. Anyone can read
 * it. That is by design: it identifies the project, it does not authorise
 * anything. Every table has row level security enabled, so a request carrying
 * only this key is the `anon` role and can reach exactly two things — the
 * active ride-type price list, and lookup_driver_by_code(). Everything else
 * returns zero rows.
 *
 * What must NEVER appear in this file, or anywhere under src/, is the service
 * role key. That one bypasses RLS entirely and belongs only on a server.
 *
 * ── Identity ───────────────────────────────────────────────────────────────
 * Sessions are Supabase Auth JWTs. public.users rows are linked to auth.users
 * through users.auth_id, and every RLS policy resolves the caller through
 * current_user_id(). So the app's own user id and Supabase's auth id are two
 * different uuids, deliberately: the former is referenced by twenty foreign
 * keys and could not be replaced without rewriting the schema.
 */

const url = import.meta.env['VITE_SUPABASE_URL']?.trim() ?? '';
const publishableKey = import.meta.env['VITE_SUPABASE_ANON_KEY']?.trim() ?? '';

/** False when the project is not configured — screens degrade rather than crash. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[AC7] Supabase is not configured. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.development.local — see .env.frontend.example.',
  );
}

/**
 * A single client for the whole app.
 *
 * More than one instance with `persistSession` on means two objects racing to
 * write the same localStorage key, which shows up as users being signed out at
 * random when a refresh token is rotated by one instance and not seen by the
 * other.
 */
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  publishableKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The app is a normal SPA, not an OAuth callback host. Parsing the URL
      // fragment on every load would strip query strings the router needs.
      detectSessionInUrl: false,
      storageKey: 'ac7.auth',
    },
    realtime: {
      // Chat is conversational, not telemetry. Ten messages a second is far
      // more than a person can type and keeps a slow phone responsive.
      params: { eventsPerSecond: 10 },
    },
    global: {
      headers: { 'x-application-name': 'ac7-ride-web' },
    },
  },
);

/* -------------------------------------------------------------------------- */
/* Error handling                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Postgres error codes that mean something specific to a person, not a bug.
 *
 * Surfacing "duplicate key value violates unique constraint" to a rider is a
 * failure of care. These map the few codes we deliberately raise into sentences
 * someone can act on.
 */
const FRIENDLY: Record<string, string> = {
  '40001': 'Another driver claimed that first.',
  '23505': 'That already exists.',
  '42501': 'You do not have permission to do that.',
  'PGRST116': 'Not found.',
};

export interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/** Turn a Supabase error into something worth showing a person. */
export function friendlyError(error: PostgrestLikeError | null | undefined): string {
  if (!error) return 'Something went wrong.';
  if (error.code && FRIENDLY[error.code]) return FRIENDLY[error.code] as string;

  // Errors raised by our own RPCs carry a written message; database plumbing
  // errors do not, and should not be shown raw.
  const message = error.message ?? '';
  if (message && !/violates|constraint|relation|syntax|permission denied for/i.test(message)) {
    return message;
  }
  return 'Something went wrong. Try again.';
}

/** Throw on a Supabase error, otherwise return the data narrowed to non-null. */
export function unwrap<T>(result: { data: T | null; error: PostgrestLikeError | null }): T {
  if (result.error) {
    const err = new Error(friendlyError(result.error));
    (err as Error & { code?: string }).code = result.error.code;
    throw err;
  }
  return result.data as T;
}
