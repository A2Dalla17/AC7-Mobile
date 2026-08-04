/**
 * ACT — address search and reverse geocoding
 *
 * One interface, two providers underneath: Google Maps Platform when it is
 * configured and within budget, OpenStreetMap's Nominatim otherwise.
 *
 * ── Why both, rather than picking one ──────────────────────────────────────
 * Google is markedly better at what this app needs — UK postcodes, building
 * names, "T5", the way people actually type an address — and Nominatim is
 * weak at exactly that. But Google's free tier is 10,000 calls per SKU per
 * month with no pooling, and going over costs money on a business that has
 * not taken a fare yet.
 *
 * So Google is the front line and Nominatim is the floor. Every Google path
 * falls back rather than failing: no key configured, monthly budget reached,
 * daily quota hit, Google down, request refused. In each case the rider gets
 * a working address search from OpenStreetMap instead of an error message.
 * The product never depends on the bill being paid.
 *
 * ── Why the map is not part of this ────────────────────────────────────────
 * The map stays on Leaflet with raster tiles. Google bills per map load, and
 * the rider home screen is a map — putting it on Google would spend the entire
 * monthly allowance rendering tiles a raster provider serves for a flat fee or
 * nothing, and leave none for the search this file provides.
 *
 * Separately: the tile provider currently configured in MapView is CARTO,
 * whose terms do not cover commercial use. See docs/GOOGLE-MAPS-SETUP.md.
 * Unrelated to the code here, but recorded so it is not forgotten.
 */

import { env, hasGooglePlaces } from '@shared/config/env';

import * as google from './maps/google';
import { AutocompleteSession, MapsBudgetExhaustedError } from './maps/google';

export { AutocompleteSession };
export type { RouteResult } from './maps/google';

export interface PlaceSuggestion {
  id: string;
  /** Short name — "Heathrow Terminal 5". */
  label: string;
  /** Full address for the second line. */
  address: string;
  lat: number;
  lng: number;
  /**
   * Google place ID, when the suggestion came from Google.
   *
   * Present means coordinates have not been fetched yet — Autocomplete returns
   * a name and an ID, and resolving it to a position is a second, separate
   * call. `resolve()` below does that, and only when the rider actually picks
   * the suggestion, so scrolling a list of ten costs nothing.
   */
  placeId?: string;
}

/* -------------------------------------------------------------------------- */
/* Nominatim — the free floor                                                 */
/* -------------------------------------------------------------------------- */

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/**
 * Nominatim's minimum spacing between requests. Not negotiable, and it is why
 * the debounce is this long: the usage policy allows one request per second,
 * and exceeding it gets an application blocked outright.
 */
const NOMINATIM_MIN_INTERVAL_MS = 1100;

/**
 * Debounce before an address search fires.
 *
 * Held at Nominatim's rate limit even when Google is the active provider, and
 * that is a cost decision rather than a technical one. Session-token billing
 * groups a whole typing session into one charge, so a tighter debounce would
 * not raise the bill — but the provider can switch to Nominatim mid-session
 * the moment the budget runs out, and a debounce tuned for Google would then
 * breach OpenStreetMap's policy on the very next keystroke. One interval that
 * is safe for both is worth more than a few hundred milliseconds.
 */
export const SEARCH_DEBOUNCE_MS = NOMINATIM_MIN_INTERVAL_MS;

interface NominatimPlace {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

function fromNominatim(p: NominatimPlace): PlaceSuggestion {
  const parts = p.display_name.split(',').map((s) => s.trim());
  return {
    id: String(p.place_id),
    label: p.name?.trim() || parts[0] || p.display_name,
    address: parts.slice(1).join(', ') || p.display_name,
    lat: Number(p.lat),
    lng: Number(p.lon),
  };
}

async function nominatimSearch(
  query: string,
  signal?: AbortSignal | undefined,
): Promise<PlaceSuggestion[]> {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'gb');
  /* Viewbox around Greater London, weighted but not exclusive: a rider
     booking a run to Manchester should still find it. */
  url.searchParams.set('viewbox', '-0.51,51.69,0.33,51.28');
  url.searchParams.set('bounded', '0');

  const response = await fetch(url, {
    signal: signal ?? null,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Address search is unavailable right now.');

  return ((await response.json()) as NominatimPlace[]).map(fromNominatim);
}

async function nominatimReverse(
  lat: number,
  lng: number,
  signal?: AbortSignal | undefined,
): Promise<PlaceSuggestion | null> {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'jsonv2');

  const response = await fetch(url, {
    signal: signal ?? null,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;

  return fromNominatim((await response.json()) as NominatimPlace);
}

/* -------------------------------------------------------------------------- */
/* Provider selection                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Should this failure send us to the free provider, or is it the caller's?
 *
 * An abort is the caller's — the rider typed another character and this
 * request is obsolete. Retrying it on Nominatim would fire a request nobody
 * wants and, worse, could deliver stale results over newer ones.
 *
 * Everything else falls back. Budget reached, quota hit, key rejected, Google
 * unreachable: none of those are the rider's problem, and all of them have the
 * same right answer, which is to use the provider that still works.
 */
function shouldFallBack(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  return true;
}

/** Whether Google is configured at all. Exported for the admin usage panel. */
export const googleEnabled = hasGooglePlaces;

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Search for an address.
 *
 * `session` groups a rider's keystrokes into one billable Google session. Pass
 * the same instance for every call while they are typing, then hand it to
 * `resolve()` when they pick something. Omitting it still works and still
 * returns results — it just costs per request instead of per session, so it
 * should only be omitted where there is no selection step to close.
 *
 * `origin` biases results toward where the rider is. Someone in Croydon typing
 * "high street" means their own, not one forty minutes away.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  session?: AutocompleteSession,
  origin?: { lat: number; lng: number },
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  if (hasGooglePlaces()) {
    try {
      const predictions = await google.autocomplete(
        q,
        session ?? new AutocompleteSession(),
        origin,
        signal,
      );

      /* Predictions carry no coordinates, and fetching them for all six would
         be six Place Details calls to display a list the rider will take one
         item from. The placeholder zeroes are never read: `resolve()` is what
         turns the chosen one into a position, and PlaceSuggestion.placeId
         being present is the signal that it must be called. */
      return predictions.map((p) => ({
        id: p.placeId,
        placeId: p.placeId,
        label: p.label,
        address: p.address,
        lat: 0,
        lng: 0,
      }));
    } catch (error) {
      if (!shouldFallBack(error)) throw error;
      /* Fall through to Nominatim. The budget being spent is the system
         working as designed, not a fault, so it is not logged as one. */
      if (env.isDev && !(error instanceof MapsBudgetExhaustedError)) {
        console.warn('[maps] Google search failed, using OpenStreetMap:', error);
      }
    }
  }

  return nominatimSearch(q, signal);
}

/**
 * Turn a chosen suggestion into one with real coordinates.
 *
 * A Nominatim suggestion already has them and is returned untouched — no call,
 * no charge. Only a Google prediction needs resolving, and only at the moment
 * the rider commits to it.
 */
export async function resolve(
  suggestion: PlaceSuggestion,
  session?: AutocompleteSession,
  signal?: AbortSignal,
): Promise<PlaceSuggestion | null> {
  if (!suggestion.placeId) return suggestion;

  try {
    const detailed = await google.placeDetails(
      suggestion.placeId,
      session ?? new AutocompleteSession(),
      signal,
    );
    if (detailed) return { ...detailed, placeId: suggestion.placeId };
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
  }

  /* Google could not resolve it, so find the same place by name on Nominatim.
     Worth the extra request: the rider has already chosen, and returning
     nothing at this point would look like the tap did not register. */
  const [fallback] = await nominatimSearch(
    [suggestion.label, suggestion.address].filter(Boolean).join(', '),
    signal,
  );
  return fallback ?? null;
}

/**
 * Turn a position into an address — "where am I" on the rider home screen.
 *
 * Never throws. A failed reverse lookup is cosmetic: the coordinates are still
 * a perfectly good pickup point, they just display as "Your current location"
 * instead of a street name. Letting this break a booking would be absurd.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<PlaceSuggestion | null> {
  if (hasGooglePlaces()) {
    try {
      return await google.reverseGeocode(lat, lng, signal);
    } catch (error) {
      if (!shouldFallBack(error)) return null;
    }
  }

  try {
    return await nominatimReverse(lat, lng, signal);
  } catch {
    /* A failed reverse lookup is cosmetic — the coordinates are still usable
       for a pickup, they just show as "Current location" instead of a street
       name. Never let it break the booking flow. */
    return null;
  }
}

/**
 * Distance, duration and route shape between two points.
 *
 * Google only — there is no free equivalent fit to quote a fare from. Returns
 * null rather than falling back, and the caller must handle that: showing a
 * made-up price is worse than showing none, because a rider quoted £12 and
 * charged £19 does not come back.
 */
export async function computeRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<google.RouteResult | null> {
  if (!hasGooglePlaces()) return null;

  try {
    return await google.computeRoute(origin, destination, signal);
  } catch (error) {
    if (!shouldFallBack(error)) throw error;
    return null;
  }
}
