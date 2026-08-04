/**
 * ACT — London fare estimation
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Distance, duration and price were all fetched from the Go backend:
 * /maps/route and /pricing/bulk-estimate. That backend is deployed nowhere.
 * Every one of those requests resolved to the SPA's own index.html, failed on
 * a JSON parse, and left the booking screen with no miles, no minutes and no
 * price — permanently, and with nothing on screen to explain it.
 *
 * A minicab app that cannot quote a fare is not a minicab app. So the fare is
 * computed here, from the distance and duration Google Routes returns, using
 * the tariff below. No backend required.
 *
 * ── Why the numbers are here and not in the database ───────────────────────
 * They should end up in Supabase so the office can change a tariff without a
 * deploy — that work is tracked separately. Putting them in code first is
 * deliberate: it makes the product work today, and it puts every rate in one
 * reviewable place with its reasoning attached, which is a far better starting
 * point for a migration than rates scattered through a backend that nobody can
 * currently run.
 *
 * ── These are placeholder rates and MUST be checked ────────────────────────
 * They are modelled on typical London private-hire pricing, not on AC7's
 * actual tariff, which only you know. Every one of them is wrong until you say
 * otherwise. A quoted price is a promise to a rider, so read this table before
 * taking a single real booking.
 */

import type { FareEstimate, RideType } from '@shared/api/types';

/** Multiply metres by this for miles. UK riders think in miles. */
const METRES_PER_MILE = 1609.344;

export interface Tariff {
  id: string;
  name: string;
  description: string;
  /** Seats, excluding the driver. */
  capacity: number;
  /** Charged the moment the journey starts. */
  baseFare: number;
  perMile: number;
  perMinute: number;
  /** No journey is quoted below this, however short. */
  minimumFare: number;
}

/**
 * The tariff table.
 *
 * ── Why per-mile AND per-minute ────────────────────────────────────────────
 * Distance alone underpays a driver stuck on the Euston Road for forty
 * minutes; time alone underpays them on a clear run to Heathrow. Every
 * established operator charges both, and a driver who feels underpaid on
 * traffic-heavy jobs simply stops accepting them.
 *
 * ── Why there is a minimum fare ────────────────────────────────────────────
 * A half-mile job still costs a driver the approach, the wait and the fuel. At
 * pure per-mile rates it would earn under two pounds and no driver would take
 * it, so the rider gets no car at all. The minimum is what makes short local
 * journeys — which are most of a neighbourhood firm's work — worth accepting.
 */
export const TARIFFS: Tariff[] = [
  {
    id: 'standard',
    name: 'AC7 Standard',
    description: 'Saloon car, up to 4 passengers',
    capacity: 4,
    baseFare: 2.5,
    perMile: 1.95,
    perMinute: 0.25,
    minimumFare: 7.0,
  },
  {
    id: 'estate',
    name: 'AC7 Estate',
    description: 'Extra luggage space, up to 4 passengers',
    capacity: 4,
    baseFare: 3.5,
    perMile: 2.35,
    perMinute: 0.28,
    minimumFare: 9.0,
  },
  {
    id: 'mpv',
    name: 'AC7 MPV',
    description: 'Up to 6 passengers',
    capacity: 6,
    baseFare: 4.5,
    perMile: 2.75,
    perMinute: 0.32,
    minimumFare: 12.0,
  },
  {
    id: 'executive',
    name: 'AC7 Executive',
    description: 'Premium saloon, professional driver',
    capacity: 4,
    baseFare: 6.0,
    perMile: 3.25,
    perMinute: 0.4,
    minimumFare: 18.0,
  },
];

/**
 * Round a fare to something a rider can hand over.
 *
 * Prices are quoted to five pence. £12.4732 is arithmetic, not a price, and
 * showing it makes an estimate look machine-generated rather than considered.
 */
function roundFare(amount: number): number {
  return Math.round(amount * 20) / 20;
}

/**
 * Quote one tariff for a journey.
 *
 * `surge` multiplies the distance and time components but NOT the base fare —
 * the base covers dispatch, which does not become more expensive because it is
 * raining. Surging it too is how a £7 minimum becomes £21 in a thunderstorm
 * and how a firm loses its regulars.
 */
export function quote(
  tariff: Tariff,
  distanceMetres: number,
  durationSeconds: number,
  surge = 1,
): FareEstimate {
  const miles = distanceMetres / METRES_PER_MILE;
  const minutes = durationSeconds / 60;

  const distanceFare = miles * tariff.perMile * surge;
  const timeFare = minutes * tariff.perMinute * surge;

  const computed = tariff.baseFare + distanceFare + timeFare;
  const total = roundFare(Math.max(computed, tariff.minimumFare));

  return {
    ride_type_id: tariff.id,
    ride_type_name: tariff.name,
    base_fare: tariff.baseFare,
    distance_fare: roundFare(distanceFare),
    time_fare: roundFare(timeFare),
    surge_multiplier: surge,
    total_fare: total,
    currency_code: 'GBP',
    estimated_distance: distanceMetres,
    estimated_duration: durationSeconds,
  };
}

/** Quote every tariff for one journey — what the booking screen lists. */
export function quoteAll(
  distanceMetres: number,
  durationSeconds: number,
  surge = 1,
): FareEstimate[] {
  return TARIFFS.map((t) => quote(t, distanceMetres, durationSeconds, surge));
}

/** The tariff table shaped as ride types, for screens that list vehicles. */
export function tariffsAsRideTypes(): RideType[] {
  return TARIFFS.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    base_fare: t.baseFare,
    /* The API type is per_km; the tariff is per mile, because that is what a
       London rider understands. Converting here keeps the wire format honest
       rather than quietly relabelling miles as kilometres. */
    per_km_rate: t.perMile / 1.609344,
    per_minute_rate: t.perMinute,
    capacity: t.capacity,
    is_active: true,
  }));
}
