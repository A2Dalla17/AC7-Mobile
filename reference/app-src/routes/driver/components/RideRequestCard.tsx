import { Clock } from 'lucide-react';

import type { Ride } from '@shared/api/types';
import { NavigateButton } from '@/components/map/NavigateButton';
import { Avatar } from '@shared/components/ui/Avatar';
import { Button } from '@shared/components/ui/Button';
import { cn, formatCurrency, formatDistance } from '@shared/lib/utils';

/**
 * Incoming ride request.
 *
 * This is the most time-critical surface in the product — a driver may be at a
 * junction with seconds to decide. Fare and distance are therefore the largest
 * elements, and Accept is visually dominant over Decline.
 */
export function RideRequestCard({
  ride,
  riderName,
  riderRating,
  distanceKm,
  etaMinutes,
  onAccept,
  onDecline,
  accepting = false,
  isNew = true,
}: {
  ride: Ride;
  riderName?: string;
  riderRating?: number;
  distanceKm?: number;
  etaMinutes?: number;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
  isNew?: boolean;
}) {
  return (
    <article className="animate-scale-in rounded-card bg-card p-4 shadow-lifted">
      {/* Proximity + badge */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-caption text-ink-muted">
          <span aria-hidden className="relative grid h-3 w-3 place-items-center">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand/50" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          {etaMinutes !== undefined ? `${etaMinutes} min` : 'Nearby'}
          {distanceKm !== undefined && ` (${formatDistance(distanceKm)}) away`}
        </span>

        {isNew && (
          <span className="rounded-pill brand-gradient px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wide text-white">
            New request
          </span>
        )}
      </div>

      {/* Rider + fare */}
      <div className="mt-3.5 flex items-start gap-3">
        <Avatar
          initials={initialsFrom(riderName)}
          size="lg"
          className="ring-2 ring-brand-ink/40"
          alt={riderName ? `${riderName}'s photo` : 'Rider'}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-body-lg font-bold text-ink">{riderName ?? 'Rider'}</p>
          {riderRating !== undefined && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
              <Star />
              <span className="tabular font-medium text-ink">{riderRating.toFixed(1)}</span>
            </p>
          )}
        </div>

        <div className="shrink-0 rounded-tile bg-surface px-4 py-2.5 text-right">
          <p className="tabular text-h3 font-bold text-ink">
            {formatCurrency(ride.estimated_fare, ride.currency_code)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-ink-muted">Cash</p>
        </div>
      </div>

      {/* Route */}
      <div className="mt-4 flex gap-3">
        <div aria-hidden className="flex flex-col items-center pt-1.5">
          <span className="h-3 w-3 rounded-full border-[3px] border-brand" />
          <span className="my-1 w-px flex-1 bg-line-strong" />
          <span className="h-3 w-3 rounded-full border-[3px] border-ink-subtle" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="truncate text-body text-ink">{ride.pickup_address}</p>
          <p className="truncate text-body text-ink">{ride.dropoff_address}</p>
        </div>

        {/*
          Navigation before accepting, not only after.

          An address means little on its own — a driver needs to know whether
          the pickup is two streets away or the wrong side of a river, and
          they have seconds to decide. Being able to see the route first is
          the difference between an informed accept and a guess, and a guess
          is what produces a cancellation five minutes later.

          Compact and outlined so it never competes with Accept, which is
          still the action this card is asking for.
        */}
        {ride.pickup_latitude != null && ride.pickup_longitude != null && (
          <NavigateButton
            destination={{ lat: ride.pickup_latitude, lng: ride.pickup_longitude }}
            label="Navigate to pickup"
            compact
            className="self-start"
          />
        )}
      </div>

      {/* Trip facts */}
      <div className="mt-4 flex items-center gap-4 rounded-tile bg-surface px-4 py-2.5 text-caption">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <Clock size={14} aria-hidden />
          <span className="tabular font-medium text-ink">{ride.estimated_duration} min</span>
        </span>
        <span aria-hidden className="h-3.5 w-px bg-line-strong" />
        <span className="text-ink-muted">
          <span className="tabular font-medium text-ink">
            {formatDistance(ride.estimated_distance)}
          </span>{' '}
          trip
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={onDecline}
          disabled={accepting}
        >
          Decline
        </Button>
        <Button size="lg" className="flex-[1.4]" onClick={onAccept} loading={accepting}>
          Accept
        </Button>
      </div>
    </article>
  );
}

function Star() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-brand-ink" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function initialsFrom(name?: string): string {
  if (!name) return 'R';
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export const rideRequestClassNames = cn;
