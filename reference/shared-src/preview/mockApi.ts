/**
 * ⚠️  PREVIEW ONLY  ⚠️
 *
 * Answers API calls from fixtures when no backend is reachable.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The Go services are not deployed yet. Without this, a Vercel build shows a
 * login screen that cannot succeed and a set of screens stuck in their error
 * states — useless for judging the design on a phone.
 *
 * ── How it is switched on ──────────────────────────────────────────────────
 * Only when `VITE_PREVIEW_MODE=true` is set at build time. That variable is
 * set on the Vercel preview project and nowhere else, so a real production
 * build with a real backend never loads this path.
 *
 * ── What it deliberately does NOT do ───────────────────────────────────────
 * It does not touch authentication logic, it does not weaken any check, and
 * it never runs unless the flag is on. It is a display fixture, not a bypass:
 * with the flag off, every byte below is dead code and the bundler drops it.
 */

import * as fx from './fixtures';
import { getPreviewRole } from './flag';

/** Network feels instant otherwise, which hides the loading states. */
const LATENCY_MS = 260;

const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));


/* -------------------------------------------------------------------------- */
/* Routing table                                                              */
/* -------------------------------------------------------------------------- */

type Handler = (ctx: {
  path: string;
  method: string;
  body: unknown;
  params: URLSearchParams;
}) => unknown;

/**
 * Ordered longest-prefix-first so `/driver/ratings/me` is matched before
 * `/ratings/me` would ever be considered.
 */
const ROUTES: Array<[RegExp, Handler]> = [
  /* ---- Auth --------------------------------------------------------- */
  [/^\/auth\/profile$/, () => fx.PREVIEW_USERS[getPreviewRole()]],
  [
    /^\/auth\/login$/,
    () => ({ user: fx.PREVIEW_USERS[getPreviewRole()], token: 'preview-token' }),
  ],

  /* ---- Rides -------------------------------------------------------- */
  [/^\/rides\/[^/]+$/, ({ path }) => {
    const id = path.split('/').pop();
    return fx.PREVIEW_RIDES.find((r) => r.id === id) ?? fx.PREVIEW_RIDES[0];
  }],
  [/^\/rides$/, () => fx.PREVIEW_RIDES],

  /* ---- Driver ------------------------------------------------------- */
  [/^\/driver\/ratings\/me$/, () => fx.PREVIEW_DRIVER_RATING],
  [/^\/driver\/earnings\/history$/, () => fx.PREVIEW_EARNINGS_HISTORY],
  [/^\/driver\/earnings\/daily$/, () => fx.PREVIEW_DAILY_EARNINGS],
  [/^\/driver\/earnings\/balance$/, () => fx.PREVIEW_BALANCE],
  [/^\/driver\/earnings\/payouts$/, () => fx.PREVIEW_PAYOUTS],
  [/^\/driver\/bank-accounts$/, () => fx.PREVIEW_BANK_ACCOUNTS],
  [/^\/driver\/earnings/, ({ params }) => {
    const period = (params.get('period') ?? 'day') as keyof typeof fx.PREVIEW_EARNINGS;
    return fx.PREVIEW_EARNINGS[period] ?? fx.PREVIEW_EARNINGS.day;
  }],
  [/^\/driver\/rides\/available$/, () => fx.PREVIEW_RIDES.slice(1, 3)],
  [/^\/driver\/status$/, () => fx.PREVIEW_DRIVER],

  /* ---- Geo ---------------------------------------------------------- */
  [/^\/geo\/driver\/status$/, () => fx.PREVIEW_DRIVER],
  [/^\/geo\/drivers\/nearby$/, () => fx.PREVIEW_NEARBY],
  [/^\/geo\/location$/, () => ({ ok: true })],
  [/^\/geo\/geocode\/reverse$/, () => ({
    formatted_address: '42 Highbury Grove, London N5',
    latitude: 51.5462,
    longitude: -0.1058,
  })],
  [/^\/geo\/geocode\/autocomplete$/, ({ params }) => {
    const q = (params.get('query') ?? params.get('input') ?? '').toLowerCase();
    const all = [
      { description: "King's Cross Station, London N1C", place_id: 'p1', latitude: 51.5308, longitude: -0.1238 },
      { description: 'Canary Wharf, London E14', place_id: 'p2', latitude: 51.5054, longitude: -0.0235 },
      { description: 'Heathrow Terminal 5, London TW6', place_id: 'p3', latitude: 51.47, longitude: -0.4543 },
      { description: 'Shoreditch High St, London E1', place_id: 'p4', latitude: 51.5265, longitude: -0.0784 },
      { description: 'Camden Market, London NW1', place_id: 'p5', latitude: 51.5414, longitude: -0.1465 },
      { description: 'Westfield Stratford City, London E20', place_id: 'p6', latitude: 51.5416, longitude: -0.0034 },
      { description: 'Southbank Centre, London SE1', place_id: 'p7', latitude: 51.5055, longitude: -0.1165 },
    ];
    return q ? all.filter((p) => p.description.toLowerCase().includes(q)) : all.slice(0, 5);
  }],

  /* ---- Maps --------------------------------------------------------- */
  [/^\/maps\/route$/, () => ({
    polyline: null,
    distance_meters: 11200,
    duration_seconds: 2040,
    duration_in_traffic_seconds: 2280,
  })],

  /* ---- Money -------------------------------------------------------- */
  [/^\/wallet\/transactions$/, () => fx.PREVIEW_TRANSACTIONS],
  [/^\/wallet$/, () => fx.PREVIEW_WALLET],
  [/^\/payment-methods$/, () => fx.PREVIEW_PAYMENT_METHODS],

  /* ---- Ratings ------------------------------------------------------ */
  [/^\/ratings\/me$/, () => fx.PREVIEW_RIDER_RATING],
  [/^\/ratings\/users\/[^/]+$/, () => fx.PREVIEW_DRIVER_RATING],
  [/^\/ratings\/given$/, () => ({ ratings: [], total: 0 })],
  [/^\/ratings\/tags$/, () => ['Clean car', 'Safe driving', 'Great conversation', 'On time']],

  /* ---- Referrals ---------------------------------------------------- */
  [/^\/referrals\/my-code$/, () => fx.PREVIEW_REFERRAL_CODE],
  [/^\/referrals\/my-earnings$/, () => fx.PREVIEW_REFERRAL_EARNINGS],

  /* ---- Booking shifts ------------------------------------------------ */
  [/^\/shifts\/available$/, () => fx.PREVIEW_SHIFTS_AVAILABLE],
  [/^\/shifts\/claimed$/, () => fx.PREVIEW_SHIFTS_CLAIMED],
  [/^\/shifts\/mine$/, () => [...fx.PREVIEW_SHIFTS_CLAIMED, ...fx.PREVIEW_SHIFTS_AVAILABLE.slice(0, 2)]],
  [/^\/shifts\/[^/]+\/claim$/, () => fx.PREVIEW_SHIFTS_AVAILABLE[0]],
  [/^\/shifts\/[^/]+\/release$/, () => fx.PREVIEW_SHIFTS_CLAIMED[0]],
  [/^\/admin\/shifts$/, () => [...fx.PREVIEW_SHIFTS_AVAILABLE, ...fx.PREVIEW_SHIFTS_CLAIMED]],

  /* ---- Misc --------------------------------------------------------- */
  [/^\/favorites$/, () => fx.PREVIEW_FAVOURITES],
  [/^\/notifications$/, () => fx.PREVIEW_NOTIFICATIONS],
  [/^\/safety\/contacts$/, () => fx.PREVIEW_EMERGENCY_CONTACTS],
  [/^\/ride-types\/available$/, () => fx.PREVIEW_RIDE_TYPES],
  [/^\/pricing\/bulk-estimate$/, () => fx.PREVIEW_ESTIMATES],

  /* ---- Admin -------------------------------------------------------- */
  [/^\/admin\/(stats|dashboard|analytics)/, () => fx.PREVIEW_ADMIN_STATS],
  [/^\/admin\/users$/, () => Object.values(fx.PREVIEW_USERS)],
  [/^\/admin\/drivers$/, () => [fx.PREVIEW_DRIVER]],
  [/^\/admin\/rides$/, () => fx.PREVIEW_RIDES],
];

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a request from fixtures.
 *
 * Returns `undefined` when nothing matches, which the caller treats as "let
 * the real network attempt proceed" — so an unmocked endpoint degrades to the
 * screen's normal empty state rather than throwing something unexpected.
 */
export async function mockRequest(
  path: string,
  method: string,
  body: unknown,
): Promise<unknown | undefined> {
  const [rawPath, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const clean = (rawPath ?? '').replace(/\/+$/, '') || '/';

  /* Mutations acknowledge without changing anything. The preview is a
     read-only showcase; persisting edits across a reload would need a store
     and would make the fixtures inconsistent with each other. */
  if (method !== 'GET') {
    const match = ROUTES.find(([re]) => re.test(clean));
    if (match) return delay(match[1]({ path: clean, method, body, params }));
    return delay({ ok: true });
  }

  const match = ROUTES.find(([re]) => re.test(clean));
  if (!match) return undefined;

  return delay(match[1]({ path: clean, method, body, params }));
}
