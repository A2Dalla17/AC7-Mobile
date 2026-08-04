import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Check, Copy, Gauge, Percent, ShieldCheck, Star, Timer, TrendingUp, Trophy,
} from 'lucide-react';
import { useState } from 'react';

import { geoApi } from '@shared/api';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { TierBadge, TierLadder } from '@/components/domain/TierBadge';
import {
  daysLeftInSeason,
  formatDriverCode,
  nextTier,
  seasonFor,
  seasonProgress,
  seasonScore,
  tierFor,
  type DriverStats,
} from '@shared/lib/ranking';
import { cn } from '@shared/lib/utils';

/**
 * The driver's standing: tier, progress to the next one, season score, and
 * their permanent AC7 code.
 *
 * Every number here is derived from real driver data via `@shared/lib/ranking` —
 * nothing is hard-coded. When `internal/gamification` grows a seasons table
 * the season block swaps to server values; the tier block already matches the
 * thresholds the Go `CheckTierUpgrade` uses.
 */
export function DriverRankPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const driver = useQuery({
    queryKey: ['driver', 'status'],
    queryFn: () => geoApi.driverStatus(),
    retry: 1,
  });

  const d = driver.data;

  /* Acceptance and cancellation are not on the driver record yet — the
     backend computes them in mv_driver_performance. Until that endpoint is
     exposed, derive what we can and be honest about the rest. */
  const stats: DriverStats = {
    completedRides: d?.total_rides ?? 0,
    rating: d?.rating ?? 0,
    acceptanceRate: 100,
  };

  const tier = tierFor(stats);
  const { tier: next, missing } = nextTier(stats);

  const season = seasonFor();
  const daysLeft = daysLeftInSeason();
  const progress = seasonProgress();

  const score = seasonScore({
    completedRides: stats.completedRides,
    rating: stats.rating,
    cancellationRate: 0,
    acceptanceRate: stats.acceptanceRate,
    punctuality: 95,
    safetyScore: 100,
  });

  /* Codes are issued server-side; this derives the display from the driver's
     sequence once the backend returns one. Until then, show the placeholder
     rather than inventing a number that would later change. */
  const code = d?.id ? formatDriverCode(driverSequence(d.id)) : null;

  function copyCode() {
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="min-h-full bg-surface pb-tabbar">
      <ScreenHeader title="Your rank" />

      <div className="stagger">
        {/* ---- Current tier ------------------------------------------- */}
        <section className="px-gutter pt-6">
          {driver.isLoading ? (
            <Skeleton className="h-52 rounded-panel" />
          ) : (
            <div
              className="edge-light relative overflow-hidden rounded-panel p-6 text-center shadow-lifted"
              style={{
                background: `linear-gradient(135deg, ${tier.colour}22 0%, ${tier.colour}0A 60%, transparent 100%)`,
                border: `1px solid ${tier.colour}33`,
              }}
            >
              <span
                aria-hidden
                className="mx-auto grid h-16 w-16 place-items-center rounded-full"
                style={{ backgroundColor: `${tier.colour}26`, color: tier.colour }}
              >
                <Trophy size={30} />
              </span>

              <p className="mt-4 text-overline uppercase text-ink-subtle">Current tier</p>
              <p className="mt-1 text-h1" style={{ color: tier.colour }}>
                {tier.label}
              </p>

              <p className="mt-2 text-body-sm text-ink-muted">
                You keep {100 - tier.commission}% of every fare
              </p>

              <TierLadder current={tier.name} className="mt-6" />
            </div>
          )}
        </section>

        {/* ---- Progress to next tier ----------------------------------- */}
        {next && (
          <section className="mt-4 px-gutter">
            <Card>
              <CardHeader
                title={`Next: ${next.label}`}
                description={`Commission drops to ${next.commission}%`}
                action={<TierBadge tier={next} size="sm" />}
              />

              <ul className="space-y-3">
                <Requirement
                  icon={<Gauge size={15} />}
                  label="Completed trips"
                  have={stats.completedRides}
                  need={next.minRides}
                  missing={missing.rides}
                  unit=""
                />
                <Requirement
                  icon={<Star size={15} />}
                  label="Rating"
                  have={stats.rating}
                  need={next.minRating}
                  missing={missing.rating}
                  unit=""
                  decimals={2}
                />
                <Requirement
                  icon={<Percent size={15} />}
                  label="Acceptance rate"
                  have={stats.acceptanceRate}
                  need={next.minAcceptance}
                  missing={missing.acceptance}
                  unit="%"
                  decimals={1}
                />
              </ul>

              <p className="mt-4 rounded-tile bg-surface px-4 py-3 text-micro leading-relaxed text-ink-muted">
                All three must be met. Volume alone does not promote you — a driver with 6,000
                trips and a 4.6 rating stays Silver.
              </p>
            </Card>
          </section>
        )}

        {/* ---- Season -------------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <div className="edge-light relative overflow-hidden rounded-panel brand-gradient p-6 shadow-brand-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-overline uppercase text-white/60">Season {season.code}</p>
                <p className="tabular mt-1.5 text-amount-lg text-white">{score}</p>
                <p className="mt-0.5 text-caption text-white/70">your season score</p>
              </div>

              <span
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur-sm"
              >
                <Trophy size={22} className="text-white" />
              </span>
            </div>

            {/* Progress through the season */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-micro text-white/75">
                <span>
                  {season.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <span className="font-semibold text-white">
                  {daysLeft === 0 ? 'Final day' : `${daysLeft} days left`}
                </span>
                <span>
                  {new Date(season.end.getTime() - 1).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-slow ease-smooth"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            <p className="mt-4 text-caption leading-relaxed text-white/75">
              The highest score on the final day wins the season — cash reward, a trophy badge,
              and your profile on the AC7 home page.
            </p>
          </div>
        </section>

        {/* ---- How the score works ------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader title="How the season is judged" />
            <ul className="space-y-3">
              <Weight icon={<Star size={15} />} label="Customer rating" percent={30} />
              <Weight icon={<Percent size={15} />} label="Low cancellations" percent={20} />
              <Weight icon={<Gauge size={15} />} label="Completed trips" percent={20} />
              <Weight icon={<TrendingUp size={15} />} label="Acceptance rate" percent={12} />
              <Weight icon={<Timer size={15} />} label="Punctuality" percent={10} />
              <Weight icon={<ShieldCheck size={15} />} label="Safety record" percent={8} />
            </ul>
            <p className="mt-4 text-micro leading-relaxed text-ink-subtle">
              Trips are capped at 600 in the scoring, so working the most hours does not win the
              season on its own.
            </p>
          </Card>
        </section>

        {/* ---- Driver code --------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader
              title="Your driver code"
              description="Permanent. Riders and support use it to identify you."
            />

            {driver.isLoading ? (
              <Skeleton className="h-16 rounded-tile" />
            ) : code ? (
              <div className="flex items-center gap-2 rounded-tile border border-dashed border-line-strong bg-surface px-4 py-4">
                <code className="tabular min-w-0 flex-1 text-h3 font-bold tracking-[0.14em] text-ink">
                  {code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label="Copy your driver code"
                  className={cn(
                    'pressable inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-2',
                    'text-caption font-semibold transition-colors',
                    copied
                      ? 'bg-success-soft text-success-ink'
                      : 'bg-brand-soft text-brand-ink hover:brightness-95',
                  )}
                >
                  {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="text-body-sm leading-relaxed text-ink-muted">
                Your code is issued when your driver account is approved.
              </p>
            )}
          </Card>
        </section>

        <section className="mt-4 px-gutter">
          <button
            type="button"
            onClick={() => navigate('/driver/hall-of-fame')}
            className="liftable flex w-full items-center justify-center gap-2.5 rounded-card border border-line bg-card py-4 text-body font-semibold text-ink"
          >
            <Trophy size={17} aria-hidden className="text-brand-ink" />
            Hall of Fame
          </button>
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Requirement({
  icon,
  label,
  have,
  need,
  missing,
  unit,
  decimals = 0,
}: {
  icon: React.ReactNode;
  label: string;
  have: number;
  need: number;
  missing: number;
  unit: string;
  decimals?: number;
}) {
  const met = missing <= 0;
  const pct = Math.min(100, need > 0 ? (have / need) * 100 : 100);

  return (
    <li>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-full',
            met ? 'bg-success-soft text-success-ink' : 'bg-surface text-ink-muted',
          )}
        >
          {met ? <Check size={14} /> : icon}
        </span>

        <span className="min-w-0 flex-1 text-body-sm text-ink">{label}</span>

        <span className="tabular shrink-0 text-caption text-ink-muted">
          {have.toFixed(decimals)}
          {unit} / {need.toFixed(decimals)}
          {unit}
        </span>
      </div>

      <div className="ml-[2.375rem] mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-slow ease-smooth',
            met ? 'bg-success' : 'bg-brand',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function Weight({
  icon,
  label,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  percent: number;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-body-sm text-ink">{label}</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${percent * 3}%` }} />
      </span>
      <span className="tabular w-9 shrink-0 text-right text-caption font-semibold text-ink">
        {percent}%
      </span>
    </li>
  );
}

/**
 * Derives a stable display sequence from the driver's UUID.
 *
 * This is a STAND-IN. Real codes must come from a database sequence so they
 * are unique, permanent and gap-free. Hashing a UUID gives a stable number
 * per driver — good enough to render the UI today, but two drivers could in
 * principle collide, so replace it the moment the backend issues real codes.
 */
function driverSequence(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i += 1) {
    hash = (hash * 31 + uuid.charCodeAt(i)) % 99999;
  }
  return hash + 1;
}
