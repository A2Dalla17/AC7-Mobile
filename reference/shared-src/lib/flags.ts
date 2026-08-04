/**
 * AC7 Ride — feature flags (runtime)
 *
 * ── The distinction from env.features ──────────────────────────────────────
 * `env.features` in config/env.ts are BUILD-time constants. They are read from
 * import.meta.env, so the bundler can see them and delete the dead branch
 * entirely. That is the right tool when you want the code to not exist in the
 * shipped bundle at all.
 *
 * The flags in this file are RUNTIME. They are read from the database on every
 * load, so changing one takes effect without a rebuild and without a deploy —
 * which is the entire point of a kill switch. The cost is that both branches
 * are in the bundle.
 *
 * Use a build flag to hide something unfinished from the bundle.
 * Use a runtime flag for anything you might need to switch off in a hurry.
 *
 * ── Why the defaults are duplicated here ───────────────────────────────────
 * The database holds a `fallback` column, but that column is unreachable when
 * the database is the thing that is broken. So the safe answer for each flag
 * is also compiled into the client. If Supabase is down, the app still renders
 * — with every new feature absent, which is the correct failure direction: a
 * missing feature is an inconvenience, a half-initialised one is a bug report.
 */

import { supabase, isSupabaseConfigured } from '@shared/lib/supabase';

/* -------------------------------------------------------------------------- */
/* The flag set                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Every runtime flag, named exactly as in public.feature_flags.key.
 *
 * Declared as a literal tuple so FlagKey is a union of the actual strings.
 * useFlag('shcool_runs') is then a compile error rather than a silent false,
 * which matters: a typo in a flag name fails closed and looks identical to
 * "the feature is off", so it can survive review and reach production.
 */
export const FLAG_KEYS = [
  'school_runs',
  'act_bookings',
  'control_centre',
  'marketplace',
  'live_fares',
  'driver_shifts',
  'realtime_chat',
  'community_showcase',
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

export type FlagMap = Record<FlagKey, boolean>;

/**
 * What each flag is when nothing can be loaded.
 *
 * Everything is false except community_showcase, which is already live on the
 * public site: a visitor arriving mid-outage should still see the page they
 * saw yesterday rather than a hole where the showcase was.
 */
export const FLAG_DEFAULTS: FlagMap = {
  school_runs: false,
  act_bookings: false,
  control_centre: false,
  marketplace: false,
  live_fares: false,
  driver_shifts: false,
  realtime_chat: false,
  community_showcase: true,
};

/* -------------------------------------------------------------------------- */
/* Device identity for signed-out traffic                                     */
/* -------------------------------------------------------------------------- */

const DEVICE_KEY = 'ac7.device';

/**
 * A stable id for a browser with nobody signed in.
 *
 * Needed because a percentage rollout has to bucket on *something*, and for
 * anonymous traffic there is no user id. Clearing site data produces a new id
 * and therefore a new bucket — a visitor could in principle keep clearing
 * until they land inside a canary. That is accepted: the prize is early access
 * to a feature that is about to ship to everyone anyway, so nobody will bother,
 * and the flags that gate anything sensitive are not anonymous-eligible.
 */
export function deviceId(): string {
  if (typeof window === 'undefined') return '';

  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;

    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing with storage disabled. A per-session id still buckets
    // consistently for the length of the visit, which is enough.
    return `ephemeral-${Math.random().toString(36).slice(2)}`;
  }
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

const CACHE_KEY = 'ac7.flags';

/**
 * How long a cached evaluation may be trusted for the first paint.
 *
 * This number is a safety limit, not a performance tuning knob. A cached
 * `true` for a flag that has since been killed is precisely the state the kill
 * switch exists to prevent, so the cache is only ever allowed to paint the
 * first frame, and only if it is recent. A live fetch starts immediately
 * regardless and overwrites it.
 */
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  flags: Partial<FlagMap>;
}

function readCache(): Partial<FlagMap> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed?.at !== 'number') return null;
    if (Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null;

    return parsed.flags ?? null;
  } catch {
    return null;
  }
}

function writeCache(flags: FlagMap): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { at: Date.now(), flags };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* Storage full or blocked — the cache is an optimisation, never required. */
  }
}

export function clearFlagCache(): void {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Defaults merged with whatever the cache can offer, for the first frame. */
export function initialFlags(): FlagMap {
  return { ...FLAG_DEFAULTS, ...(readCache() ?? {}) };
}

/* -------------------------------------------------------------------------- */
/* Evaluation                                                                 */
/* -------------------------------------------------------------------------- */

interface FlagRow {
  key: string;
  enabled: boolean;
}

/**
 * Ask the database which flags are on for the caller.
 *
 * Returns a complete FlagMap, always. Unknown keys coming back from the server
 * are dropped and known keys missing from the response fall back to their
 * default, so a flag added to the database before the client knows about it
 * cannot produce `undefined` in a boolean position.
 */
export async function fetchFlags(): Promise<FlagMap> {
  if (!isSupabaseConfigured) return { ...FLAG_DEFAULTS };

  const { data, error } = await supabase.rpc('evaluate_flags', {
    p_anon_id: deviceId(),
  });

  if (error || !Array.isArray(data)) {
    // Deliberately not thrown. A flag service that takes the app down with it
    // is worse than no flag service.
    if (import.meta.env.DEV) {
      console.warn('[AC7] flag evaluation failed, using defaults', error);
    }
    return { ...FLAG_DEFAULTS };
  }

  const resolved: FlagMap = { ...FLAG_DEFAULTS };
  const known = new Set<string>(FLAG_KEYS);

  for (const row of data as FlagRow[]) {
    if (known.has(row.key)) {
      resolved[row.key as FlagKey] = Boolean(row.enabled);
    }
  }

  writeCache(resolved);
  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Release health reporting                                                   */
/* -------------------------------------------------------------------------- */

export type ReleaseEventKind = 'error' | 'crash' | 'api_failure' | 'journey_failure';

/**
 * Report a failure against the current release, optionally attributed to a flag.
 *
 * Attribution is what makes the circuit breaker possible: an error with no
 * flag_key tells you something is wrong, an error with one tells you what to
 * switch off. Pass the flag whenever the failing code path is behind one.
 *
 * Never throws and never awaits anything the caller depends on — this runs on
 * the error path, and an error reporter that can itself fail loudly turns one
 * bug into two.
 */
export async function reportReleaseEvent(
  kind: ReleaseEventKind,
  detail: string,
  flagKey?: FlagKey,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    await supabase.rpc('report_release_event', {
      p_kind: kind,
      p_release_id: RELEASE_ID,
      p_flag_key: flagKey ?? null,
      p_detail: detail.slice(0, 500),
      p_anon_id: deviceId(),
    });
  } catch {
    /* swallowed on purpose */
  }
}

/**
 * Which build this is.
 *
 * Injected at build time (see vite.config.ts). Without it every error in the
 * table says "unknown" and you lose the ability to answer the first question
 * of any incident: did this start with the last deploy?
 */
export const RELEASE_ID: string =
  (import.meta.env['VITE_RELEASE_ID'] as string | undefined)?.trim() || 'dev';
