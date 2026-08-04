/**
 * AC7 driver ranking — tiers, seasons and driver codes.
 *
 * ── Where this sits ────────────────────────────────────────────────────────
 * `internal/gamification` already models tiers, quests, achievements and
 * leaderboards in Go, and already promotes drivers automatically
 * (`CheckTierUpgrade`). Its seed data stops at Diamond and has no concept of
 * a season.
 *
 * This module holds the two things the backend does not have yet:
 *
 *   1. the AC7 tier ladder, extended past Diamond to Ace and Master
 *   2. the 3-month season calendar and scoring weights
 *
 * It is deliberately pure — no fetching, no React. That means the season a
 * date falls in, and the score a driver earns, are computed identically on
 * every screen, and can be unit-tested without a browser.
 *
 * When the Go side grows a `seasons` table, this becomes the client mirror of
 * it rather than the source of truth. The shapes are chosen to make that swap
 * a rename, not a rewrite.
 */

/* -------------------------------------------------------------------------- */
/* Tiers                                                                      */
/* -------------------------------------------------------------------------- */

export type TierName =
  | 'new'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'diamond'
  | 'platinum'
  | 'ace'
  | 'master';

export interface Tier {
  name: TierName;
  label: string;
  /** Ladder position. Higher beats lower. */
  rank: number;
  minRides: number;
  minRating: number;
  minAcceptance: number;
  /** Percentage AC7 takes. Falls as the driver climbs — the real reward. */
  commission: number;
  colour: string;
  perks: string[];
}

/**
 * The ladder.
 *
 * Note the order: Diamond sits BELOW Platinum here, matching how AC7 ranks
 * them. That is the reverse of the existing Go seed data, which follows the
 * more common gold → platinum → diamond convention. If you change one, change
 * the other, or a driver's tier will appear to move backwards when the
 * backend recalculates it.
 */
export const TIERS: readonly Tier[] = [
  {
    name: 'new',
    label: 'New Driver',
    rank: 0,
    minRides: 0,
    minRating: 0,
    minAcceptance: 0,
    commission: 25,
    colour: '#8E8E94',
    perks: ['Welcome bonus', 'Onboarding support'],
  },
  {
    name: 'bronze',
    label: 'Bronze',
    rank: 1,
    minRides: 50,
    minRating: 4.5,
    minAcceptance: 70,
    commission: 23,
    colour: '#CD7F32',
    perks: ['Weekly bonus eligible', '2% lower commission'],
  },
  {
    name: 'silver',
    label: 'Silver',
    rank: 2,
    minRides: 200,
    minRating: 4.6,
    minAcceptance: 75,
    commission: 21,
    colour: '#C0C0C0',
    perks: ['5% surge bonus', '4% lower commission', 'Priority support'],
  },
  {
    name: 'gold',
    label: 'Gold',
    rank: 3,
    minRides: 500,
    minRating: 4.7,
    minAcceptance: 80,
    commission: 19,
    colour: '#D4A017',
    perks: ['Priority dispatch', '10% surge bonus', 'Instant payout'],
  },
  {
    name: 'diamond',
    label: 'Diamond',
    rank: 4,
    minRides: 1000,
    minRating: 4.8,
    minAcceptance: 85,
    commission: 17,
    colour: '#4FB3D9',
    perks: ['Higher priority dispatch', '15% surge bonus', 'Exclusive quests'],
  },
  {
    name: 'platinum',
    label: 'Platinum',
    rank: 5,
    minRides: 2500,
    minRating: 4.85,
    minAcceptance: 88,
    commission: 15,
    colour: '#9AA5B1',
    perks: ['Top-tier dispatch', '20% surge bonus', 'Airport queue priority'],
  },
  {
    name: 'ace',
    label: 'Ace',
    rank: 6,
    minRides: 5000,
    minRating: 4.9,
    minAcceptance: 92,
    commission: 13,
    colour: '#8B0000',
    perks: ['Elite dispatch', '25% surge bonus', 'Dedicated account manager'],
  },
  {
    name: 'master',
    label: 'Master',
    rank: 7,
    minRides: 10000,
    minRating: 4.95,
    minAcceptance: 95,
    commission: 10,
    colour: '#111111',
    perks: [
      'Highest dispatch priority',
      '30% surge bonus',
      'Lowest commission on the platform',
      'Season judging panel',
    ],
  },
] as const;

export const TIER_BY_NAME: Record<TierName, Tier> = Object.fromEntries(
  TIERS.map((t) => [t.name, t]),
) as Record<TierName, Tier>;

export interface DriverStats {
  completedRides: number;
  rating: number;
  acceptanceRate: number;
}

/**
 * Highest tier a driver qualifies for on ALL three thresholds.
 *
 * Deliberately conservative: a driver with 6,000 rides but a 4.6 rating is
 * Silver, not Ace. Volume alone should not buy the top of the ladder, or the
 * tier stops meaning anything to riders.
 */
export function tierFor(stats: DriverStats): Tier {
  let earned = TIERS[0]!;
  for (const tier of TIERS) {
    if (
      stats.completedRides >= tier.minRides &&
      stats.rating >= tier.minRating &&
      stats.acceptanceRate >= tier.minAcceptance
    ) {
      earned = tier;
    }
  }
  return earned;
}

/** The next rung, and what is still missing from it. */
export function nextTier(stats: DriverStats): {
  tier: Tier | null;
  missing: { rides: number; rating: number; acceptance: number };
} {
  const current = tierFor(stats);
  const next = TIERS.find((t) => t.rank === current.rank + 1) ?? null;

  if (!next) return { tier: null, missing: { rides: 0, rating: 0, acceptance: 0 } };

  return {
    tier: next,
    missing: {
      rides: Math.max(0, next.minRides - stats.completedRides),
      rating: Math.max(0, Number((next.minRating - stats.rating).toFixed(2))),
      acceptance: Math.max(0, Number((next.minAcceptance - stats.acceptanceRate).toFixed(1))),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Seasons                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Seasons are exactly three calendar months, labelled A1, A2, A3, A4, then
 * B1… and so on.
 *
 * Anchored to a fixed epoch rather than "three months from whenever the app
 * launched", so every client agrees on which season it is without asking the
 * server. Quarter boundaries are calendar-aligned, which also means a season
 * never ends mid-week — drivers can see the finish line coming.
 */
const SEASON_EPOCH_YEAR = 2026;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface Season {
  /** e.g. "A3" */
  code: string;
  start: Date;
  /** Exclusive — the instant the next season begins. */
  end: Date;
}

export function seasonFor(date: Date = new Date()): Season {
  const quarter = Math.floor(date.getMonth() / 3); // 0..3
  const yearOffset = date.getFullYear() - SEASON_EPOCH_YEAR;

  /* Four seasons a year, so the letter advances once per year. */
  const letterIndex = ((yearOffset % LETTERS.length) + LETTERS.length) % LETTERS.length;
  const code = `${LETTERS[letterIndex]}${quarter + 1}`;

  const start = new Date(date.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), quarter * 3 + 3, 1, 0, 0, 0, 0);

  return { code, start, end };
}

/** Whole days left, floored. 0 on the final day. */
export function daysLeftInSeason(now: Date = new Date()): number {
  const { end } = seasonFor(now);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 86_400_000));
}

/** 0–1 through the current season, for a progress bar. */
export function seasonProgress(now: Date = new Date()): number {
  const { start, end } = seasonFor(now);
  const span = end.getTime() - start.getTime();
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / span));
}

/** True on the last day — when the winner is announced. */
export function isFinalDayOfSeason(now: Date = new Date()): boolean {
  return daysLeftInSeason(now) === 0;
}

/* -------------------------------------------------------------------------- */
/* Season scoring                                                             */
/* -------------------------------------------------------------------------- */

export interface SeasonPerformance {
  completedRides: number;
  rating: number;
  /** Percent of accepted jobs the driver then cancelled. Lower is better. */
  cancellationRate: number;
  acceptanceRate: number;
  /** Percent of pickups made on time. */
  punctuality: number;
  /** 0–100, from complaints and incidents. Higher is better. */
  safetyScore: number;
}

/**
 * Weights for Best Driver of the Season.
 *
 * Rides are capped in the normaliser below so that one driver working eighty
 * hours a week cannot simply out-grind everyone on volume — the season is
 * meant to reward the best driver, not the most available one. Cancellation
 * carries real weight because it is the thing riders feel most.
 */
export const SEASON_WEIGHTS = {
  rating: 0.30,
  cancellation: 0.20,
  rides: 0.20,
  acceptance: 0.12,
  punctuality: 0.10,
  safety: 0.08,
} as const;

/** Rides above this stop adding to the score. */
const RIDE_SCORE_CAP = 600;

/**
 * Season score, 0–100.
 *
 * Every input is normalised to 0–1 first so the weights above mean what they
 * say. A driver cannot win on volume alone, and a single bad month of
 * cancellations costs more than it gains in rides.
 */
export function seasonScore(p: SeasonPerformance): number {
  const rating = clamp01((p.rating - 4.0) / 1.0); // 4.0 → 0, 5.0 → 1
  const cancellation = clamp01(1 - p.cancellationRate / 20); // 20%+ → 0
  const rides = clamp01(p.completedRides / RIDE_SCORE_CAP);
  const acceptance = clamp01(p.acceptanceRate / 100);
  const punctuality = clamp01(p.punctuality / 100);
  const safety = clamp01(p.safetyScore / 100);

  const score =
    rating * SEASON_WEIGHTS.rating +
    cancellation * SEASON_WEIGHTS.cancellation +
    rides * SEASON_WEIGHTS.rides +
    acceptance * SEASON_WEIGHTS.acceptance +
    punctuality * SEASON_WEIGHTS.punctuality +
    safety * SEASON_WEIGHTS.safety;

  return Number((score * 100).toFixed(1));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

/* -------------------------------------------------------------------------- */
/* Driver codes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Permanent public identifier: AC7 + five digits, e.g. AC700001.
 *
 * Riders read it aloud to support, admins search by it, and it appears on the
 * driver's profile. It must never change once issued, so it is derived from a
 * sequence, not from anything mutable like a name or a phone number.
 *
 * Generating it belongs on the server — two drivers registering in the same
 * second must not collide. This helper only FORMATS a sequence number, so the
 * display is identical wherever it appears.
 */
export function formatDriverCode(sequence: number): string {
  return `AC7${String(sequence).padStart(5, '0')}`;
}

/** True for a well-formed code. Used to validate admin search input. */
export function isDriverCode(value: string): boolean {
  return /^AC7\d{5}$/.test(value.trim().toUpperCase());
}
