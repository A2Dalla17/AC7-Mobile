import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react';

import { RideStatusBadge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { SkeletonList } from '@shared/components/ui/Skeleton';
import { useMyRides } from '@shared/hooks/queries';
import { cn, formatCurrency, formatDateTime, formatDistance } from '@shared/lib/utils';

type Filter = 'all' | 'active' | 'completed' | 'cancelled';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

/**
 * Trip history.
 *
 * Each row leads with the route, because that is how people remember a trip —
 * not by its date and not by its price. The vertical rail connecting pickup to
 * destination is the same visual grammar used on the booking sheet, so the two
 * screens read as one product.
 *
 * GET /api/v1/rides.
 */
export function TripsPage() {
  const { data, isLoading, isError, refetch } = useMyRides({ per_page: 25 });
  const [filter, setFilter] = useState<Filter>('all');

  const rides = data?.items ?? [];

  const visible = useMemo(() => {
    if (filter === 'all') return rides;
    if (filter === 'active')
      return rides.filter((r) => !['completed', 'cancelled'].includes(r.status));
    return rides.filter((r) => r.status === filter);
  }, [rides, filter]);

  return (
    <div className="min-h-full bg-surface pb-[calc(7rem+var(--safe-bottom))]">
      {/* ---- Header ---------------------------------------------------- */}
      <header className="px-5 pb-1 pt-[calc(0.75rem+var(--safe-top))] text-center">
        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Your trips</h1>
        <p className="mt-0.5 text-micro text-ink-subtle">
          {rides.length > 0 ? `${rides.length} journeys with AC7` : 'Your ride history'}
        </p>
      </header>

      {/* ---- Filters ---------------------------------------------------- */}
      <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={cn(
              'shrink-0 rounded-pill border px-4 py-2 text-caption font-semibold transition-all duration-200 ease-smooth',
              filter === option.id
                ? 'border-transparent brand-gradient text-white shadow-brand'
                : 'border-line bg-card text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* ---- List ------------------------------------------------------- */}
      <section className="mt-4 px-5">
        {isLoading && <SkeletonList count={4} />}

        {isError && (
          <EmptyState
            tone="error"
            icon={<AlertTriangle size={24} />}
            title="Couldn't load your trips"
            description="Check your connection and try again."
            action={<Button onClick={() => void refetch()}>Retry</Button>}
          />
        )}

        {!isLoading && !isError && visible.length === 0 && (
          <div className="rounded-card border border-line bg-card">
            <EmptyState
              icon={<Clock size={24} />}
              title={filter === 'all' ? 'No trips yet' : 'Nothing here'}
              description={
                filter === 'all'
                  ? 'Once you take your first ride it will appear here, with the route, fare and receipt.'
                  : 'No trips match this filter.'
              }
              action={
                filter === 'all' ? (
                  <Link to="/rider">
                    <Button>Book a ride</Button>
                  </Link>
                ) : (
                  <Button variant="ghost" onClick={() => setFilter('all')}>
                    Show all
                  </Button>
                )
              }
            />
          </div>
        )}

        <ul className="stagger space-y-2.5">
          {visible.map((ride) => (
            <li key={ride.id}>
              <Link
                to={`/rider/track/${ride.id}`}
                className="liftable group block rounded-card border border-line bg-card p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-micro font-medium text-ink-subtle">
                    {formatDateTime(ride.requested_at)}
                  </p>
                  <RideStatusBadge status={ride.status} />
                </div>

                {/* Route rail */}
                <div className="mt-3.5 flex gap-3">
                  <div
                    aria-hidden
                    className="flex shrink-0 flex-col items-center pt-[0.3125rem]"
                  >
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-brand bg-bg" />
                    <span className="my-1 w-px flex-1 bg-line-strong" />
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-ink" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <p className="truncate text-body-sm leading-tight text-ink-muted">
                      {ride.pickup_address}
                    </p>
                    <p className="truncate text-body font-semibold leading-tight text-ink">
                      {ride.dropoff_address}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3">
                  <p className="tabular text-micro text-ink-subtle">
                    {formatDistance(ride.actual_distance ?? ride.estimated_distance)}
                  </p>

                  <p className="flex items-center gap-1 text-body-lg font-bold tracking-[-0.02em] text-ink">
                    <span className="tabular">
                      {formatCurrency(ride.final_fare ?? ride.estimated_fare, ride.currency_code)}
                    </span>
                    <ChevronRight
                      size={16}
                      aria-hidden
                      className="text-ink-subtle transition-transform duration-200 ease-smooth group-hover:translate-x-0.5 group-hover:text-brand-ink"
                    />
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
