import { TrendingDown, TrendingUp } from 'lucide-react';

import type { UserRatingProfile } from '@shared/api/types';
import { RatingStars } from '@shared/components/ui/Rating';
import { cn } from '@shared/lib/utils';

/**
 * Rating summary with the 5→1 star histogram.
 *
 * The bars are proportional to the *largest* bucket, not to the total. With
 * a typical distribution — most drivers sit above 4.8 — scaling to the total
 * would render every bar below five stars as a hairline, which tells the
 * driver nothing about where their few low scores actually sit.
 *
 * Reads GET /driver/ratings/me or /ratings/me.
 */
export function RatingBreakdown({
  profile,
  className,
}: {
  profile: UserRatingProfile;
  className?: string;
}) {
  const dist = profile.rating_distribution ?? {};
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: dist[String(star)] ?? 0,
  }));

  const peak = Math.max(1, ...counts.map((c) => c.count));
  const trend = profile.rating_trend ?? 0;
  const hasTrend = Math.abs(trend) >= 0.01;

  return (
    <div className={cn('flex gap-6', className)}>
      {/* Headline */}
      <div className="shrink-0 text-center">
        <p className="tabular text-amount-lg text-ink">{profile.average_rating.toFixed(2)}</p>

        <RatingStars value={profile.average_rating} size="md" className="mt-1.5 justify-center" />

        <p className="mt-1.5 text-micro text-ink-subtle">
          {profile.total_ratings.toLocaleString()}{' '}
          {profile.total_ratings === 1 ? 'rating' : 'ratings'}
        </p>

        {hasTrend && (
          <p
            className={cn(
              'mt-2 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.6875rem] font-semibold',
              trend > 0 ? 'bg-success-soft text-success-ink' : 'bg-warning-soft text-warning-ink',
            )}
          >
            {trend > 0 ? (
              <TrendingUp size={11} aria-hidden />
            ) : (
              <TrendingDown size={11} aria-hidden />
            )}
            {trend > 0 ? '+' : ''}
            {trend.toFixed(2)}
          </p>
        )}
      </div>

      {/* Histogram */}
      <div className="min-w-0 flex-1 space-y-1.5 self-center">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="tabular w-3 shrink-0 text-right text-[0.6875rem] font-semibold text-ink-muted">
              {star}
            </span>

            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className={cn(
                  'block h-full rounded-full transition-all duration-slow ease-smooth',
                  star >= 4 ? 'bg-success' : star === 3 ? 'bg-warning' : 'bg-danger',
                )}
                style={{ width: `${(count / peak) * 100}%` }}
              />
            </span>

            <span className="tabular w-7 shrink-0 text-right text-[0.6875rem] text-ink-subtle">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The compliments riders leave most often, ordered by frequency.
 *
 * Capped at six: past that the list stops being a highlight and becomes a
 * data dump, and the tail is usually one-offs.
 */
export function RatingTags({
  tags,
  className,
}: {
  tags: UserRatingProfile['top_tags'];
  className?: string;
}) {
  if (!tags?.length) return null;

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {tags.slice(0, 6).map(({ tag, count }) => (
        <li
          key={tag}
          className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5"
        >
          <span className="text-caption font-medium text-ink">{tag}</span>
          <span className="tabular text-[0.6875rem] font-semibold text-brand-ink">×{count}</span>
        </li>
      ))}
    </ul>
  );
}
