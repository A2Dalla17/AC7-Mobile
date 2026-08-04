/**
 * ACT — cache for Google Maps Platform responses
 *
 * The cheapest call is the one never made. This is the layer that stops the
 * app paying twice for the same answer.
 *
 * ── The 30-day limit is a licence term, not a tuning choice ────────────────
 * Google's Maps Platform terms permit caching geocoding results — the
 * latitude/longitude for an address — for up to 30 days, and permit storing
 * place IDs indefinitely. Everything else is not to be cached.
 *
 * That distinction is enforced here rather than left to callers, because a
 * caller reaching for a longer TTL to save money would be committing a licence
 * breach that no test would catch and no error would surface. MAX_TTL_MS is a
 * ceiling applied to every write: asking for 90 days silently gets 30. It is
 * deliberately not a parameter that can be raised.
 *
 * ── Why reverse geocoding is keyed on rounded coordinates ─────────────────
 * This is the single biggest saving available to a ride-hailing app. The rider
 * home screen resolves "where am I" to a street name on every open. GPS
 * returns a slightly different fix each time, so an exact-coordinate key never
 * hits and every open is a paid call. Rounding to four decimal places — about
 * eleven metres — means a rider opening the app twenty times from their own
 * front door pays for one lookup, not twenty.
 *
 * Eleven metres is the right amount of blur for the job: it is well inside the
 * accuracy a phone GPS actually delivers in a city, so the cached street name
 * is as correct as the fresh one would have been.
 */

const STORAGE_PREFIX = 'act.maps.cache.';

/** Google's terms allow 30 days for geocoding results. This is the hard ceiling. */
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Entry<T> {
  value: T;
  /** Epoch ms after which this must not be served. */
  expires: number;
}

/**
 * Round a coordinate to a cache-friendly precision.
 *
 * Four decimal places is roughly 11 m of latitude. Exported because the same
 * rounding has to be applied by anything building a key from a position, and
 * two slightly different rounding rules would mean two caches that never agree.
 */
export function roundCoord(n: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

/** Cache key for a reverse-geocode lookup at a position. */
export function positionKey(lat: number, lng: number): string {
  return `rev:${roundCoord(lat)},${roundCoord(lng)}`;
}

/**
 * Cache key for an address search.
 *
 * Lower-cased and whitespace-collapsed so "Heathrow  T5" and "heathrow t5" are
 * one entry rather than two. Users retype the same query with different casing
 * constantly, and each variant would otherwise be a separate paid call.
 */
export function queryKey(query: string): string {
  return `q:${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/**
 * Read a cached value, or null when absent or expired.
 *
 * Expired entries are deleted on read rather than by a sweep. There is no good
 * moment to run a sweep in a browser tab, and an entry nobody reads costs
 * nothing but a few bytes; one that IS read is exactly the one worth removing.
 */
export function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as Entry<T>;
    if (typeof entry?.expires !== 'number' || Date.now() > entry.expires) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

/**
 * Store a value.
 *
 * `ttlMs` is clamped to MAX_TTL_MS — see the note at the top of this file. A
 * caller cannot opt out of that, and should not try to.
 *
 * A full localStorage quota is swallowed: failing to cache means the next
 * lookup costs a call, which is a cost problem, not a correctness one. Throwing
 * here would turn a full cache into a broken address search.
 */
export function set<T>(key: string, value: T, ttlMs: number): void {
  const expires = Date.now() + Math.min(ttlMs, MAX_TTL_MS);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ value, expires } satisfies Entry<T>));
  } catch {
    /* Storage full or unavailable — see above. */
  }
}

/** Standard TTLs, named so call sites read as intent rather than arithmetic. */
export const TTL = {
  /** The licence ceiling. For addresses, which effectively never move. */
  geocode: MAX_TTL_MS,
  /**
   * Autocomplete predictions.
   *
   * Short on purpose. Predictions are ranked partly by what is popular and
   * nearby right now, and a stale list is a visibly worse suggestion list. Ten
   * minutes covers the case this is actually for — a rider typing, deleting and
   * retyping the same query inside one sitting — without freezing the results.
   */
  predictions: 10 * 60 * 1000,
  /**
   * Routes.
   *
   * Two minutes, because a route's duration is a live traffic estimate and
   * quoting a fare from a stale one is quoting the wrong fare. This exists to
   * stop a re-render re-requesting the identical route, not to avoid asking
   * again later.
   */
  route: 2 * 60 * 1000,
} as const;

/** Drop every cached Maps response. Used when signing out. */
export function clear(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) doomed.push(key);
    }
    /* Collected first, then removed. Removing during the walk shifts every
       subsequent index and silently skips half the entries. */
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* Nothing to clear if storage is unavailable. */
  }
}
