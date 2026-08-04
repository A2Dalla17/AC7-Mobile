import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

/**
 * Badge.
 *
 * Always a soft tint with an ink-variant label, never a saturated fill —
 * saturated pills read as buttons and invite a tap that does nothing.
 */

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: 'bg-card text-ink border border-line',
  brand: 'bg-brand-soft text-brand-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  muted: 'bg-surface text-ink-muted',
};

export function Badge({
  tone = 'neutral',
  size = 'md',
  children,
  className,
  dot = false,
  pulse = false,
}: {
  tone?: Tone;
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
  /** Small leading status dot. */
  dot?: boolean;
  /** Animates the dot — for genuinely live states only. */
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-micro',
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full bg-current', pulse && 'animate-breathe')}
        />
      )}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/** Maps a backend RideStatus to a tone and a human label. */
export function RideStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string; live?: boolean }> = {
    requested: { tone: 'brand', label: 'Finding a driver', live: true },
    accepted: { tone: 'brand', label: 'Driver on the way', live: true },
    arrived: { tone: 'info', label: 'Driver arrived', live: true },
    in_progress: { tone: 'success', label: 'In progress', live: true },
    completed: { tone: 'success', label: 'Completed' },
    cancelled: { tone: 'danger', label: 'Cancelled' },
    expired: { tone: 'muted', label: 'Expired' },
  };

  const entry = map[status] ?? { tone: 'neutral' as Tone, label: status };

  return (
    <Badge tone={entry.tone} dot pulse={entry.live}>
      {entry.label}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Count badge for tab bars and bell icons.
 *
 * Caps at 99+ because a four-digit badge breaks the circle, and nobody reads
 * "1,247 unread" as anything more actionable than "a lot".
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        'grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full px-1',
        'bg-brand text-[0.625rem] font-bold leading-none text-white',
        'ring-[2.5px] ring-bg',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
