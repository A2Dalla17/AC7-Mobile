import { Crown, Trophy } from 'lucide-react';

import { TIER_BY_NAME, type Tier, type TierName } from '@shared/lib/ranking';
import { cn } from '@shared/lib/utils';

/**
 * Driver tier badge.
 *
 * Each tier gets its own metal colour rather than the brand red, because the
 * whole point is that they look different from each other at a glance. Ace
 * and Master are the exceptions — they take the AC7 red and near-black, so
 * the top two rungs read as "house colours earned" rather than another metal.
 */
export function TierBadge({
  tier,
  size = 'md',
  showLabel = true,
  className,
}: {
  tier: TierName | Tier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}) {
  const t = typeof tier === 'string' ? TIER_BY_NAME[tier] : tier;
  if (!t) return null;

  const isTop = t.name === 'ace' || t.name === 'master';

  const sizes = {
    sm: { box: 'h-5 px-2 gap-1', text: 'text-[0.625rem]', icon: 10 },
    md: { box: 'h-7 px-2.5 gap-1.5', text: 'text-micro', icon: 12 },
    lg: { box: 'h-9 px-3.5 gap-2', text: 'text-body-sm', icon: 15 },
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill font-bold tracking-wide',
        sizes.box,
        sizes.text,
        className,
      )}
      style={{
        /* 18% tint of the tier colour, with the colour itself as the text —
           readable on both themes without needing a per-tier dark variant. */
        backgroundColor: `${t.colour}2E`,
        color: t.colour,
        boxShadow: isTop ? `inset 0 0 0 1px ${t.colour}55` : undefined,
      }}
    >
      {t.name === 'master' ? (
        <Crown size={sizes.icon} aria-hidden className="fill-current" />
      ) : isTop ? (
        <Trophy size={sizes.icon} aria-hidden className="fill-current" />
      ) : null}
      {showLabel ? t.label : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The full ladder, with the driver's position marked.
 *
 * Shown on the rank screen so a driver can see not just where they are but
 * how far the next rung is — the thing that actually changes behaviour.
 */
export function TierLadder({
  current,
  className,
}: {
  current: TierName;
  className?: string;
}) {
  const currentRank = TIER_BY_NAME[current]?.rank ?? 0;
  const ladder = Object.values(TIER_BY_NAME)
    .filter((t) => t.name !== 'new')
    .sort((a, b) => a.rank - b.rank);

  return (
    <ol className={cn('flex items-end gap-1', className)}>
      {ladder.map((t) => {
        const reached = t.rank <= currentRank;
        const isCurrent = t.rank === currentRank;

        return (
          <li key={t.name} className="min-w-0 flex-1">
            <div
              className={cn(
                'rounded-t-chip transition-all duration-slow ease-smooth',
                isCurrent ? 'h-9' : reached ? 'h-6' : 'h-4',
              )}
              style={{
                backgroundColor: reached ? t.colour : 'rgb(var(--line))',
                opacity: reached ? 1 : 0.6,
              }}
              aria-hidden
            />
            <p
              className={cn(
                'mt-1.5 truncate text-center text-[0.5625rem] font-semibold uppercase tracking-wide',
                isCurrent ? 'text-ink' : 'text-ink-subtle',
              )}
            >
              {t.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
