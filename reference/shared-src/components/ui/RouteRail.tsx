import { cn } from '@shared/lib/utils';

/**
 * The pickup → destination rail.
 *
 * A ringed dot, a dashed spine and a square terminus. This exact grammar
 * appears on the booking sheet, every trip row, the driver's request card and
 * the receipt — which is the point. Once someone has read it on one screen
 * they read it everywhere else for free.
 *
 * `compact` tightens it for list rows; the default is for detail views.
 */
export function RouteRail({
  pickup,
  destination,
  pickupLabel = 'Pickup',
  destinationLabel = 'Destination',
  compact = false,
  showLabels = false,
  className,
}: {
  pickup: string;
  destination: string;
  pickupLabel?: string;
  destinationLabel?: string;
  compact?: boolean;
  showLabels?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-3', className)}>
      {/* Rail */}
      <div aria-hidden className="flex shrink-0 flex-col items-center pt-[0.3125rem]">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-brand-ink bg-bg" />
        <span
          className={cn(
            'my-1 w-px flex-1 bg-line-strong',
            compact ? 'min-h-[1.25rem]' : 'min-h-[1.75rem]',
          )}
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, currentColor 0 3px, transparent 3px 7px)',
            backgroundColor: 'transparent',
            color: 'rgb(var(--line-strong))',
          }}
        />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-ink" />
      </div>

      {/* Addresses */}
      <div className={cn('min-w-0 flex-1', compact ? 'space-y-3' : 'space-y-4')}>
        <div className="min-w-0">
          {showLabels && (
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {pickupLabel}
            </p>
          )}
          <p
            className={cn(
              'truncate leading-tight',
              compact ? 'text-body-sm text-ink-muted' : 'text-body text-ink-muted',
              showLabels && 'mt-0.5',
            )}
          >
            {pickup}
          </p>
        </div>

        <div className="min-w-0">
          {showLabels && (
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {destinationLabel}
            </p>
          )}
          <p
            className={cn(
              'truncate font-semibold leading-tight text-ink',
              compact ? 'text-body' : 'text-body-lg',
              showLabels && 'mt-0.5',
            )}
          >
            {destination}
          </p>
        </div>
      </div>
    </div>
  );
}
