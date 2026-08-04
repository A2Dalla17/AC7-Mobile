/**
 * AC7 Ride — runtime configuration
 *
 * Every environment-dependent value in the app resolves here. No component,
 * hook or API module may hard-code a URL or a key.
 *
 * Copy `.env.example` to `.env.development.local` and fill in the blanks.
 */

function readString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
}

/**
 * Base URL for the REST API.
 *
 * Left empty in development: Vite proxies `/api` straight to the Kong gateway
 * (see vite.config.ts), so requests are same-origin and CORS never applies.
 * In production set `VITE_API_BASE_URL` to the gateway origin.
 */
const API_BASE_URL = readString(import.meta.env['VITE_API_BASE_URL'], '');

/**
 * WebSocket origin. When empty we derive it from the current page origin,
 * upgrading http→ws and https→wss, which is correct behind the dev proxy and
 * behind any sane production reverse proxy.
 */
function resolveWsBase(): string {
  const explicit = import.meta.env['VITE_WS_BASE_URL']?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
}

export const env = {
  /** REST base, e.g. "" (proxied) or "https://api.ac7ride.com". No trailing slash. */
  apiBaseUrl: API_BASE_URL.replace(/\/+$/, ''),

  /** API version prefix used by every service behind Kong. */
  apiPrefix: '/api/v1',

  /** WebSocket origin, resolved lazily so it can read window.location. */
  get wsBaseUrl(): string {
    return resolveWsBase();
  },

  /**
   * Browser-side Google Maps key (Maps JavaScript API).
   *
   * This is SEPARATE from the backend's GOOGLE_MAPS_API_KEY, which stays
   * server-side and powers /maps/* routing, ETA and traffic. This key only
   * renders tiles and MUST be restricted by HTTP referrer in Google Cloud
   * Console — a browser key is public by definition.
   *
   * When unset the app degrades to a static map placeholder rather than
   * crashing, so the whole product remains usable without a key.
   */
  googleMapsBrowserKey: readString(
    import.meta.env['VITE_GOOGLE_MAPS_BROWSER_KEY'],
    /* One key configured for everything is the common case, and requiring a
       second variable to be filled with the same value would only produce a
       map that silently refuses to load. Whichever is set, wins.

       What this does NOT do is grant permission: the key must still have Maps
       JavaScript API enabled on the project and ticked under its API
       restrictions, or the script 403s and the app falls back to Leaflet. */
    readString(import.meta.env['VITE_GOOGLE_PLACES_KEY'], ''),
  ),

  /** Map libraries to load. `places` powers destination autocomplete fallback. */
  googleMapsLibraries: ['places', 'geometry'] as const,

  /**
   * Google Maps Platform — Places, Geocoding and Routes.
   *
   * ── Why this is a different key from googleMapsBrowserKey ─────────────────
   * That one is for the Maps JavaScript API and is currently unused: the map
   * itself renders with Leaflet against OpenStreetMap tiles, which cost
   * nothing however many times they load. This key is for the web-service
   * REST endpoints — Autocomplete, Place Details, Geocoding, Routes — which
   * are the calls actually worth paying for.
   *
   * Separating them is what lets each be restricted to only the APIs it
   * needs in Cloud Console. A single key allowed to call everything is one
   * stolen key away from a bill on every product at once.
   *
   * ── Why the map deliberately stays off Google ─────────────────────────────
   * Google's Dynamic Maps SKU bills per map load with 10,000 free per month,
   * roughly 330 a day. The rider home screen IS a map, and one ride touches
   * home, booking and tracking. Putting the map on Google would spend the
   * entire free allowance on tiles, leaving nothing for address search — which
   * is the part Google is genuinely better at, and the part Nominatim is worst
   * at for UK postcodes.
   *
   * The tiles come from a raster provider instead (see MapView). Note the open
   * licensing item recorded in docs/GOOGLE-MAPS-SETUP.md: the current CARTO
   * tiles are not licensed for commercial use and need swapping before launch.
   * That is a tile decision and does not affect anything below.
   */
  googlePlacesKey: readString(
    import.meta.env['VITE_GOOGLE_PLACES_KEY'],
    /* Falls back to the older variable name.
     *
     * VITE_GOOGLE_MAPS_BROWSER_KEY predates this integration and is what an
     * existing setup — or anyone following an older guide — will already have
     * filled in. Without this fallback, putting a perfectly good key in the
     * obvious-looking variable does nothing at all: no error, no warning, the
     * app just quietly keeps using the free geocoder. That already happened
     * once, and a silent no-op is the worst possible failure for a config
     * value somebody has just gone to the trouble of obtaining.
     *
     * Using one key for both is acceptable but not ideal: it means the same
     * key must be allowed to call every API in use, so a leak exposes all of
     * them rather than one. Two separately restricted keys are better. This
     * fallback exists so the app works either way, not to recommend it. */
    readString(import.meta.env['VITE_GOOGLE_MAPS_BROWSER_KEY'], ''),
  ),

  /**
   * Optional server-side proxy for every Google call.
   *
   * ── The upgrade path, wired in from the start ─────────────────────────────
   * A browser key is public by definition. HTTP referrer restrictions raise
   * the effort required to misuse one but do not eliminate it: a referrer
   * header is set by the caller and can simply be forged. That is tolerable
   * while a daily quota cap bounds the damage to a known number.
   *
   * When volume makes that ceiling too expensive to leave exposed, set this
   * to a Supabase Edge Function holding an unrestricted key server-side. Every
   * request in src/lib/maps/google.ts is routed through resolveEndpoint(), so
   * moving to a proxy is this one variable and no code change — which is the
   * whole reason it exists before it is needed.
   */
  googleMapsProxyUrl: readString(import.meta.env['VITE_GOOGLE_MAPS_PROXY_URL'], '').replace(
    /\/+$/,
    '',
  ),

  /**
   * Monthly ceiling this app will impose on itself, per Google SKU.
   *
   * ── Why below 10,000, and why a client-side number at all ─────────────────
   * Each Essentials SKU gets 10,000 free calls a month and they do NOT pool:
   * ten thousand for Geocoding, a separate ten thousand for Autocomplete
   * sessions, and so on. Going one call over starts a charge.
   *
   * The real, unbypassable stop is the per-API daily quota set in Cloud
   * Console — see docs/GOOGLE-MAPS-SETUP.md. This is the layer above it, and
   * it exists for a reason the quota cannot serve: a quota rejects the call
   * with an error, whereas this predicts the rejection and takes the free
   * OpenStreetMap path instead, so the rider sees a working address search
   * rather than a failure.
   *
   * The default leaves a deliberate 15% margin. Two clients can each believe
   * they are under the cap — this counter is per browser, not global — so the
   * margin absorbs that drift. It is a cost optimisation, not a guarantee;
   * the guarantee is the Cloud Console quota.
   */
  googleMapsMonthlyBudget: Number(import.meta.env['VITE_GOOGLE_MAPS_MONTHLY_BUDGET'] ?? 8500),

  /**
   * Where the map opens before the user's location is known — Charing Cross,
   * the point all distances from London are officially measured from.
   *
   * This is a starting view, not a boundary. The tile layer is the whole
   * world, so a rider can pan to anywhere and search anywhere; London is
   * simply where the camera begins when there is no GPS fix yet.
   */
  defaultMapCenter: {
    lat: Number(import.meta.env['VITE_DEFAULT_MAP_LAT'] ?? 51.5074),
    lng: Number(import.meta.env['VITE_DEFAULT_MAP_LNG'] ?? -0.1278),
  },

  /** Zoom for that opening view — close enough to read street names. */
  defaultMapZoom: Number(import.meta.env['VITE_DEFAULT_MAP_ZOOM'] ?? 13),

  /** ISO 4217 code used when the backend does not return one on a record. */
  defaultCurrency: readString(import.meta.env['VITE_DEFAULT_CURRENCY'], 'GBP'),

  /**
   * Control centre — the number on the landing page for people who would rather
   * ring than install anything. Stored in E.164 so it can be used as a tel:
   * href directly; formatted for display separately.
   */
  controlCentre: {
    tel: readString(import.meta.env['VITE_CONTROL_CENTRE_TEL'], '+447833172989'),
    display: readString(import.meta.env['VITE_CONTROL_CENTRE_DISPLAY'], '+44 7833 172989'),
    email: readString(import.meta.env['VITE_CONTROL_CENTRE_EMAIL'], 'support@ac7group.co.uk'),
    hours: readString(import.meta.env['VITE_CONTROL_CENTRE_HOURS'], 'Open 24 hours, every day'),
  },

  /**
   * Who we are. Used by the landing site, the legal pages and the document
   * title. Not environment-dependent — it lives here so the name appears once
   * rather than in thirty JSX strings.
   */
  company: {
    name: 'AC7 GROUP',
    meaning: 'Aragti Cad',
    product: 'ACT',
    productLong: 'AC7 Transport',
    city: 'London',
  },

  /**
   * Where each module lives.
   *
   * -- Why these are paths and not URLs -----------------------------------
   * `taxi` used to be VITE_TAXI_URL: an absolute link to a separate Vercel
   * deployment at a2-taxi.vercel.app. Pressing Book Taxi left the site, loaded
   * a second application, and landed on that application's own marketing page.
   * Two deployments, two builds, two front doors, and a user journey with a
   * dead end in the middle.
   *
   * They are now routes inside this single application. A route cannot drift
   * out of sync with the deployment it points at, cannot be left pointing at a
   * stale build, and costs no second full page load. If one of these ever
   * becomes an absolute URL again, the platform has quietly been split back
   * into two.
   */
  services: {
    taxi: '/taxi',
    schoolRuns: '/school-runs',
    bookings: '/bookings',
    /** Phase 2. Empty means the card renders as Coming Soon. */
    marketplace: '',
  },

  /**
   * Native app store listings.
   *
   * Empty until the apps are actually published. The landing page checks for
   * that and offers the web app instead, rather than sending someone to a
   * store page that does not exist — a dead download button is worse than
   * no download button.
   */
  appStores: {
    ios: readString(import.meta.env['VITE_APP_STORE_URL'], ''),
    android: readString(import.meta.env['VITE_PLAY_STORE_URL'], ''),
  },

  /** BCP 47 locale — drives number, date and currency formatting. */
  locale: readString(import.meta.env['VITE_LOCALE'], 'en-GB'),

  /** Dialling prefix used in phone-number placeholders and hints. */
  phonePrefix: readString(import.meta.env['VITE_PHONE_PREFIX'], '+44'),

  /** How often the driver app pushes its position to /geo/location, in ms. */
  driverLocationPingMs: Number(import.meta.env['VITE_DRIVER_PING_MS'] ?? 5000),

  /** Feature flags — let unfinished surfaces ship dark rather than broken. */
  features: {
    waze: readBool(import.meta.env['VITE_FEATURE_WAZE'], true),
    negotiation: readBool(import.meta.env['VITE_FEATURE_NEGOTIATION'], false),
    pooling: readBool(import.meta.env['VITE_FEATURE_POOLING'], false),
    corporate: readBool(import.meta.env['VITE_FEATURE_CORPORATE'], false),
  },

  /**
   * Design-preview build: serve every screen from fixtures instead of the API.
   *
   * Set ONLY on the Vercel preview project, so the design can be reviewed on a
   * real phone before the Go services are deployed. With it unset — which is
   * the default everywhere, including any real production build — the preview
   * module is dead code and the bundler removes it entirely.
   *
   * This is a display fixture. It changes no authentication logic and relaxes
   * no check; see src/preview/README.md.
   */
  previewMode: readBool(import.meta.env['VITE_PREVIEW_MODE'], false),

  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

/** True when a browser Maps key is configured; drives the map fallback. */
export const hasGoogleMapsKey = (): boolean => env.googleMapsBrowserKey.length > 0;

/**
 * True when Google can serve address search and routing.
 *
 * A proxy URL counts on its own: in that setup the key lives on the server and
 * the browser is never given one, which is the point of a proxy. Checking only
 * for a key would disable Google in exactly the deployment that is most
 * correctly configured.
 */
export const hasGooglePlaces = (): boolean =>
  env.googlePlacesKey.length > 0 || env.googleMapsProxyUrl.length > 0;
