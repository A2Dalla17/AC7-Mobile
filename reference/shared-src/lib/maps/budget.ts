/**
 * ACT — Google Maps Platform call budget
 *
 * Counts what this browser has spent against each Google SKU this month and
 * refuses to spend past a self-imposed ceiling, so the app falls back to the
 * free OpenStreetMap path instead of running up a bill.
 *
 * ── Free tiers do not pool, which is the whole reason this is per SKU ───────
 * Since March 2025 there is no shared monthly credit. Each Essentials SKU
 * carries its own 10,000 free calls: Geocoding has ten thousand, Autocomplete
 * Session Usage has a separate ten thousand, Compute Routes another. A single
 * combined counter would either stop everything the moment one API got busy,
 * or let a quiet API's headroom mask a busy one running into charges. Neither
 * is what the number means, so the counter is keyed by SKU.
 *
 * ── What this is NOT ───────────────────────────────────────────────────────
 * This is not the spending limit. It cannot be: it lives in localStorage on
 * one device, so ten riders each get their own counter and the true total is
 * the sum of all of them. Anyone can clear it, and nothing here is enforced by
 * Google.
 *
 * The enforceable limit is the per-API daily quota cap set in Cloud Console
 * (docs/GOOGLE-MAPS-SETUP.md). That one is server-side, global, and returns a
 * hard error when exceeded. This layer sits above it and serves a different
 * purpose: a quota rejection is an error the rider sees, whereas predicting
 * the rejection lets the app quietly use the free provider instead. One
 * protects the wallet; this protects the experience while saving money on the
 * way.
 *
 * ── Why the month key is UTC ───────────────────────────────────────────────
 * Google bills on UTC months. A counter that rolled over at local midnight
 * would reset a day early for a rider in Auckland and hand out a month's
 * allowance twice.
 */

import { env } from '@shared/config/env';

/**
 * The Google SKUs this app can spend against.
 *
 * Named after the billing SKUs rather than after the functions that call them,
 * because the SKU is the thing with the 10,000 limit. Two functions hitting
 * the same SKU must share one counter, and one function that could hit either
 * of two SKUs must be counted against whichever it actually used.
 */
export type MapsSku =
  /** Places Autocomplete (New) driven by a session token, closed by Place Details. */
  | 'autocomplete-session'
  /** Places Autocomplete (New) with no session token — billed per request. */
  | 'autocomplete-request'
  /** Places API Place Details Essentials. */
  | 'place-details'
  /** Geocoding API, forward and reverse. */
  | 'geocoding'
  /** Routes API — Compute Routes Essentials. */
  | 'routes'
  /**
   * Maps JavaScript API — Dynamic Maps.
   *
   * Billed per map CONSTRUCTION, not per tile, per pan or per minute. This is
   * why components/map/googleMapInstance.ts keeps one map alive for the whole
   * session: without that, one rider moving between home, booking and tracking
   * is four billable loads instead of one.
   */
  | 'dynamic-maps';

const STORAGE_KEY = 'act.maps.budget.v1';

interface BudgetState {
  /** UTC month this tally belongs to, as YYYY-MM. */
  month: string;
  counts: Partial<Record<MapsSku, number>>;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function emptyState(): BudgetState {
  return { month: currentMonth(), counts: {} };
}

/**
 * Read the tally, resetting it when the month has turned.
 *
 * Every storage failure returns a fresh state rather than throwing. Private
 * browsing modes and storage-disabled setups make localStorage throw on
 * access, and a cost optimisation that breaks address search when it cannot
 * save a counter has done more harm than the counter was worth. Failing this
 * way means the budget silently stops applying, which is the safe direction:
 * the Cloud Console quota is still there underneath.
 */
function read(): BudgetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();

    const parsed = JSON.parse(raw) as Partial<BudgetState>;
    if (typeof parsed?.month !== 'string' || parsed.month !== currentMonth()) {
      return emptyState();
    }
    return {
      month: parsed.month,
      counts: typeof parsed.counts === 'object' && parsed.counts ? parsed.counts : {},
    };
  } catch {
    return emptyState();
  }
}

function write(state: BudgetState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Quota exceeded or storage unavailable. See read(). */
  }
}

/** How many calls this browser has made against a SKU this month. */
export function spent(sku: MapsSku): number {
  return read().counts[sku] ?? 0;
}

/**
 * Whether one more call to this SKU is within budget.
 *
 * `cost` is the number of billable events the call will produce — normally 1,
 * but a caller that knows it is about to make several can reserve them
 * together rather than discovering halfway through that it has run out.
 */
export function canSpend(sku: MapsSku, cost = 1): boolean {
  return spent(sku) + cost <= env.googleMapsMonthlyBudget;
}

/**
 * Record billable events against a SKU.
 *
 * Called after the request succeeds, never before. Recording on dispatch would
 * charge the budget for calls that failed on the network and were never billed
 * by Google, which over a bad connection could exhaust the allowance without a
 * single billable event actually occurring.
 */
export function record(sku: MapsSku, cost = 1): void {
  const state = read();
  state.counts[sku] = (state.counts[sku] ?? 0) + cost;
  write(state);
}

/**
 * The whole month's tally, for the admin usage panel.
 *
 * Returned as a plain snapshot rather than a live view: this is displayed, not
 * decided on, and a caller holding a mutable reference to the internal counts
 * could corrupt the budget by writing to what it thought was a copy.
 */
export function snapshot(): { month: string; limit: number; counts: Record<MapsSku, number> } {
  const state = read();
  const skus: MapsSku[] = [
    'autocomplete-session',
    'autocomplete-request',
    'place-details',
    'geocoding',
    'routes',
    'dynamic-maps',
  ];

  const counts = Object.fromEntries(skus.map((s) => [s, state.counts[s] ?? 0])) as Record<
    MapsSku,
    number
  >;

  return { month: state.month, limit: env.googleMapsMonthlyBudget, counts };
}

/** Clear the tally. Test seam and an admin escape hatch; not used in normal flow. */
export function reset(): void {
  write(emptyState());
}
