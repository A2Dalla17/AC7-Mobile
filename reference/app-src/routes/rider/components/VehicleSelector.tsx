import { Car, Users } from 'lucide-react';

import type { FareEstimate, RideType } from '@shared/api/types';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { cn, formatCurrency, formatDuration } from '@shared/lib/utils';

/**
 * Vehicle tier picker.
 *
 * Tiers come from `/ride-types/available`; prices come from
 * `/pricing/bulk-estimate`. Both are live backend data — a tier with no
 * estimate shows "Price unavailable" rather than an invented number.
 */
export function VehicleSelector({
  rideTypes,
  estimates,
  selectedId,
  onSelect,
  loading,
}: {
  rideTypes: RideType[];
  estimates: FareEstimate[] | undefined;
  selectedId: string | null;
  onSelect: (rideTypeId: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading vehicle options">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
        ))}
      </div>
    );
  }

  const estimateFor = (rideTypeId: string) =>
    estimates?.find((estimate) => estimate.ride_type_id === rideTypeId);

  return (
    <div role="radiogroup" aria-label="Choose a vehicle" className="space-y-2">
      {rideTypes.map((rideType) => {
        const estimate = estimateFor(rideType.id);
        const selected = selectedId === rideType.id;
        const surging = (estimate?.surge_multiplier ?? 1) > 1;

        return (
          <button
            key={rideType.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(rideType.id)}
            className={cn(
              'flex w-full items-center gap-4 rounded-xl border p-4 text-left',
              'transition-all duration-200 ease-smooth',
              selected
                ? 'border-brand bg-brand-soft shadow-xs'
                : 'border-line bg-bg hover:border-line-strong hover:bg-surface',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
                selected ? 'bg-brand text-white' : 'bg-card text-ink-muted',
              )}
            >
              <Car size={20} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate font-semibold text-ink">{rideType.name}</span>
                {rideType.capacity && (
                  <span className="flex shrink-0 items-center gap-0.5 text-xs text-ink-muted">
                    <Users size={12} aria-hidden />
                    {rideType.capacity}
                  </span>
                )}
              </span>

              <span className="mt-0.5 block truncate text-sm text-ink-muted">
                {estimate?.estimated_duration
                  ? formatDuration(estimate.estimated_duration)
                  : (rideType.description ?? 'Standard comfort')}
              </span>
            </span>

            <span className="shrink-0 text-right">
              {estimate ? (
                <>
                  <span className="tabular block font-semibold text-ink">
                    {formatCurrency(estimate.total_fare, estimate.currency_code)}
                  </span>
                  {surging && (
                    <span className="mt-0.5 block text-xs font-medium text-brand-ink">
                      {estimate.surge_multiplier?.toFixed(1)}× busy
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-ink-subtle">Price unavailable</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
