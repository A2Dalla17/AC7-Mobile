import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import type { Ride } from '@shared/api/types';
import { RideStatusBadge } from '@shared/components/ui/Badge';
import { RouteRail } from '@shared/components/ui/RouteRail';
import { cn, formatCurrency, formatDateTime, formatDistance } from '@shared/lib/utils';

/**
 * A trip in a list.
 *
 * The route leads, because that is how people recall a trip — not by its date
 * and not by its price. Date and status sit above it as metadata; fare sits
 * below, separated by a rule, so the eye lands on "where" before "how much".
 */
export function TripCard({
  ride,
  to,
  className,
}: {
  ride: Ride;
  to?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-micro font-medium text-ink-subtle">
          {formatDateTime(ride.requested_at)}
        </p>
        <RideStatusBadge status={ride.status} />
      </div>

      <RouteRail
        compact
        className="mt-3.5"
        pickup={ride.pickup_address}
        destination={ride.dropoff_address}
      />

      <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3">
        <p className="tabular text-micro text-ink-subtle">
          {formatDistance(ride.actual_distance ?? ride.estimated_distance)}
        </p>

        <p className="flex items-center gap-1 text-amount text-ink">
          <span className="tabular">
            {formatCurrency(ride.final_fare ?? ride.estimated_fare, ride.currency_code)}
          </span>
          {to && (
            <ChevronRight
              size={16}
              aria-hidden
              className="text-ink-subtle transition-transform duration-quick ease-smooth group-hover:translate-x-0.5 group-hover:text-brand-ink"
            />
          )}
        </p>
      </div>
    </>
  );

  const classes = cn(
    'block rounded-card border border-line bg-card p-4',
    to && 'liftable group',
    className,
  );

  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <article className={classes}>{body}</article>
  );
}
