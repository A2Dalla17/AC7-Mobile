/**
 * ACT — Google Maps Platform web services
 *
 * Autocomplete, Place Details, Geocoding and Routes. Every call in this file
 * passes the cache first and the budget second, and only then reaches Google.
 *
 * ── Why the REST endpoints and not the Maps JavaScript API ────────────────
 * Loading the Maps JS library to use its Places service pulls in the whole
 * mapping runtime — hundreds of kilobytes — to make what are ordinary HTTPS
 * requests. The map here is Leaflet, so that runtime would be dead weight
 * downloaded by every rider. These are fetch calls.
 *
 * ── Session tokens are the main cost control ──────────────────────────────
 * Without a token, every Autocomplete request is billed separately: a rider
 * typing "Heathrow Terminal 5" produces a charge for each debounced keystroke
 * that reaches Google. With a token, the whole typing session plus the final
 * selection is grouped into one billable session, however many characters were
 * typed on the way. Same result on screen, a fraction of the cost.
 *
 * The token has to be handled precisely to work at all:
 *   - one fresh token per search the rider starts;
 *   - the same token on every Autocomplete call within that search;
 *   - the token passed to the closing Place Details call, which ends it;
 *   - never reused afterwards.
 * Google's terms are explicit that a reused or omitted token is billed as
 * though no token were given, so a subtly wrong lifecycle costs full price
 * while appearing to work. That is why the token is owned by a small class
 * below rather than passed around as a loose string.
 */

import { env } from '@shared/config/env';

import { canSpend, record } from './budget';
import * as cache from './cache';

/** A place suggestion, shaped identically to the OpenStreetMap provider's. */
export interface PlaceSuggestion {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * An autocomplete prediction, which has no coordinates yet.
 *
 * Deliberately a different type from PlaceSuggestion. Autocomplete returns
 * names and a place ID; turning one into coordinates costs a second call.
 * Modelling both as the same type invites code that reads `.lat` off a
 * prediction and silently gets a placeholder — so the type system refuses.
 */
export interface PlacePrediction {
  placeId: string;
  label: string;
  address: string;
}

export class MapsBudgetExhaustedError extends Error {
  constructor(readonly sku: string) {
    super(`Monthly self-imposed budget reached for ${sku}.`);
    this.name = 'MapsBudgetExhaustedError';
  }
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a Google endpoint, routing through the proxy when one is configured.
 *
 * Every request goes through here so that moving the key server-side later is
 * a configuration change and not a rewrite. With a proxy set, the key is never
 * attached client-side — it is the proxy's job, and sending one anyway would
 * put a browser key in a request that had successfully avoided needing one.
 */
function resolveEndpoint(path: string): { url: string; useProxy: boolean } {
  if (env.googleMapsProxyUrl) {
    return { url: `${env.googleMapsProxyUrl}${path}`, useProxy: true };
  }

  const host = path.startsWith('/v1/places')
    ? 'https://places.googleapis.com'
    : path.startsWith('/directions')
      ? 'https://routes.googleapis.com'
      : 'https://maps.googleapis.com';

  return { url: `${host}${path}`, useProxy: false };
}

interface CallOptions {
  path: string;
  /** Field mask. Google bills Places by which fields are asked for, so this is a price. */
  fieldMask?: string;
  body?: unknown;
  signal?: AbortSignal | undefined;
}

async function call<T>({ path, fieldMask, body, signal }: CallOptions): Promise<T> {
  const { url, useProxy } = resolveEndpoint(path);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (fieldMask) headers['X-Goog-FieldMask'] = fieldMask;
  /* The key travels as a header, never as a query parameter. Query strings end
     up in server logs, browser history and Referer headers on any outbound
     link, all of which are places a credential should never be. */
  if (!useProxy) headers['X-Goog-Api-Key'] = env.googlePlacesKey;

  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal ?? null,
  });

  if (!response.ok) {
    /* 403 from Google here almost always means the key restrictions do not
       match where the app is running, or the API is not enabled on the
       project. Saying so saves an hour of looking in the wrong place. */
    if (response.status === 403) {
      throw new Error(
        'Google refused the request. Check the key restrictions and that the API is enabled — see docs/GOOGLE-MAPS-SETUP.md.',
      );
    }
    /* 429 is the daily quota cap doing its job. Not an error to fix. */
    if (response.status === 429) {
      throw new MapsBudgetExhaustedError('daily quota');
    }
    throw new Error(`Google Maps request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Session tokens                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One autocomplete session: the typing, then the selection.
 *
 * Owning the token in an object rather than passing a string around is what
 * makes the lifecycle enforceable. `token()` returns null once the session has
 * closed, so a stale session cannot quietly attach a spent token to a new
 * search and get billed per request while looking correct.
 */
export class AutocompleteSession {
  #token: string | null;

  constructor() {
    this.#token = crypto.randomUUID();
  }

  /** The token, or null once this session has been closed. */
  token(): string | null {
    return this.#token;
  }

  /** Mark the session finished. Called after the closing Place Details request. */
  close(): void {
    this.#token = null;
  }
}

/* -------------------------------------------------------------------------- */
/* Autocomplete                                                               */
/* -------------------------------------------------------------------------- */

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

/**
 * Suggest places for what the rider has typed.
 *
 * Biased to London and restricted to the UK. Without the country restriction
 * "Richmond" offers Virginia above Surrey, and a rider tapping the first
 * result books a car to the wrong continent.
 */
export async function autocomplete(
  query: string,
  session: AutocompleteSession,
  origin?: { lat: number; lng: number } | undefined,
  signal?: AbortSignal | undefined,
): Promise<PlacePrediction[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const cached = cache.get<PlacePrediction[]>(cache.queryKey(q));
  if (cached) return cached;

  const token = session.token();

  /* Which SKU this lands on depends on whether a token is attached, so the
     budget check has to ask about the one actually being used. */
  const sku = token ? 'autocomplete-session' : 'autocomplete-request';
  if (!canSpend(sku)) throw new MapsBudgetExhaustedError(sku);

  const body: Record<string, unknown> = {
    input: q,
    includedRegionCodes: ['gb'],
    /* Bias, not a boundary: a rider booking a long run to Manchester must
       still be able to find it. */
    locationBias: {
      circle: {
        center: {
          latitude: origin?.lat ?? env.defaultMapCenter.lat,
          longitude: origin?.lng ?? env.defaultMapCenter.lng,
        },
        radius: 30000,
      },
    },
  };
  if (token) body['sessionToken'] = token;

  const data = await call<AutocompleteResponse>({
    path: '/v1/places:autocomplete',
    body,
    signal,
  });

  const predictions: PlacePrediction[] = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map((p) => ({
      placeId: p.placeId,
      label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      address: p.structuredFormat?.secondaryText?.text ?? '',
    }));

  /* Recorded only on success — a request that failed on the network was never
     billed, and charging the budget for it would exhaust the allowance over a
     bad connection without a single billable event occurring.

     Counted once per session rather than per request: within a session, the
     second and subsequent keystrokes do not add a billable session. Counting
     each request would show ten times the real usage and trip the budget for
     no reason. */
  if (!token || cache.get<true>(`sess:${token}`) === null) {
    record(sku);
    if (token) cache.set(`sess:${token}`, true, cache.TTL.predictions);
  }

  cache.set(cache.queryKey(q), predictions, cache.TTL.predictions);
  return predictions;
}

/* -------------------------------------------------------------------------- */
/* Place Details                                                              */
/* -------------------------------------------------------------------------- */

interface PlaceDetailsResponse {
  id?: string;
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  displayName?: { text?: string };
}

/**
 * Turn a chosen prediction into coordinates, closing the session.
 *
 * ── The field mask is the price ────────────────────────────────────────────
 * Places bills by field tier. Asking only for id, location, formattedAddress
 * and displayName keeps this on Place Details Essentials. Adding one field
 * from a higher tier — opening hours, ratings, photos — silently moves the
 * whole call to the Pro or Enterprise SKU, which has a smaller free allowance
 * and a higher rate. Nothing warns you; the bill just changes. Do not widen
 * this mask without checking which tier the new field belongs to.
 */
export async function placeDetails(
  placeId: string,
  session: AutocompleteSession,
  signal?: AbortSignal | undefined,
): Promise<PlaceSuggestion | null> {
  /* Place IDs are stable and Google's terms permit storing them without
     expiry, so a place the rider has chosen before costs nothing to resolve
     again. The coordinates stored alongside are still bound by the 30-day
     ceiling the cache enforces. */
  const cached = cache.get<PlaceSuggestion>(`place:${placeId}`);
  if (cached) {
    session.close();
    return cached;
  }

  if (!canSpend('place-details')) throw new MapsBudgetExhaustedError('place-details');

  const token = session.token();
  const query = token ? `?sessionToken=${encodeURIComponent(token)}` : '';

  try {
    const data = await call<PlaceDetailsResponse>({
      path: `/v1/places/${encodeURIComponent(placeId)}${query}`,
      fieldMask: 'id,location,formattedAddress,displayName',
      signal,
    });

    if (!data.location) return null;

    const suggestion: PlaceSuggestion = {
      id: data.id ?? placeId,
      label: data.displayName?.text ?? data.formattedAddress ?? '',
      address: data.formattedAddress ?? '',
      lat: data.location.latitude,
      lng: data.location.longitude,
    };

    record('place-details');
    cache.set(`place:${placeId}`, suggestion, cache.TTL.geocode);
    return suggestion;
  } finally {
    /* Closed even when the request throws. A token that has reached Google is
       spent whether or not the response arrived; keeping it alive would attach
       a used token to the next search, which Google bills as though no token
       were supplied at all. */
    session.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Geocoding                                                                  */
/* -------------------------------------------------------------------------- */

interface GeocodeResponse {
  status: string;
  results?: Array<{
    place_id?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  }>;
}

/**
 * Name the place at a position — "where am I" on the rider home screen.
 *
 * The rounded-coordinate cache key is what makes this affordable: see the note
 * in cache.ts. Without it this is a paid call on every single app open.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal | undefined,
): Promise<PlaceSuggestion | null> {
  const key = cache.positionKey(lat, lng);
  const cached = cache.get<PlaceSuggestion>(key);
  if (cached) return cached;

  if (!canSpend('geocoding')) throw new MapsBudgetExhaustedError('geocoding');

  const params = new URLSearchParams({
    latlng: `${cache.roundCoord(lat)},${cache.roundCoord(lng)}`,
    region: 'gb',
    /* One result is all that is displayed. Asking for fewer does not change
       the price, but it does keep the response small on a phone connection. */
    result_type: 'street_address|premise|route',
  });

  const data = await call<GeocodeResponse>({
    path: `/maps/api/geocode/json?${params.toString()}`,
    signal,
  });

  record('geocoding');

  if (data.status === 'ZERO_RESULTS') {
    /* A genuine "nowhere near an address" — mid-ocean, a field. Caching the
       null stops the app asking again every few seconds while the rider sits
       in the same spot. */
    cache.set(key, null, cache.TTL.geocode);
    return null;
  }

  const first = data.results?.[0];
  const location = first?.geometry?.location;
  if (!first || !location) return null;

  const parts = (first.formatted_address ?? '').split(',').map((s) => s.trim());
  const suggestion: PlaceSuggestion = {
    id: first.place_id ?? key,
    label: parts[0] ?? first.formatted_address ?? '',
    address: parts.slice(1).join(', '),
    lat: location.lat,
    lng: location.lng,
  };

  cache.set(key, suggestion, cache.TTL.geocode);
  return suggestion;
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

export interface RouteResult {
  /** Metres. */
  distance: number;
  /** Seconds, including live traffic. */
  duration: number;
  /** Encoded polyline, ready for MapView. */
  polyline: string;
}

interface RoutesResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }>;
}

/**
 * Distance, time and shape between two points — the basis of the fare.
 *
 * ── Why TRAFFIC_AWARE and not TRAFFIC_AWARE_OPTIMAL ────────────────────────
 * The optimal preference is a higher-priced SKU with a smaller free tier. For
 * quoting a London fare, the difference in the answer is small and the
 * difference in the bill is not.
 *
 * ── Why the field mask is this narrow ──────────────────────────────────────
 * Routes bills by response content in the same way Places does. Distance,
 * duration and the polyline keep this on Compute Routes Essentials. Asking for
 * per-step navigation instructions or toll information moves it up a tier.
 */
export async function computeRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  signal?: AbortSignal | undefined,
): Promise<RouteResult | null> {
  const key = `route:${cache.positionKey(origin.lat, origin.lng)}>${cache.positionKey(
    destination.lat,
    destination.lng,
  )}`;

  const cached = cache.get<RouteResult>(key);
  if (cached) return cached;

  if (!canSpend('routes')) throw new MapsBudgetExhaustedError('routes');

  const data = await call<RoutesResponse>({
    path: '/directions/v2:computeRoutes',
    fieldMask: 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    body: {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      polylineQuality: 'OVERVIEW',
      regionCode: 'GB',
      units: 'METRIC',
    },
    signal,
  });

  record('routes');

  const route = data.routes?.[0];
  if (!route?.polyline?.encodedPolyline) return null;

  const result: RouteResult = {
    distance: route.distanceMeters ?? 0,
    /* Google returns durations as a protobuf Duration string — "834s". */
    duration: Number.parseInt(route.duration ?? '0', 10) || 0,
    polyline: route.polyline.encodedPolyline,
  };

  cache.set(key, result, cache.TTL.route);
  return result;
}
