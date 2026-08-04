import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Luggage, Plane, Users } from 'lucide-react';

import { ShiftTakenError, shiftsApi, type Shift } from '@shared/api/shifts';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState, ErrorState } from '@shared/components/ui/EmptyState';
import { NoTripsArt } from '@shared/components/ui/Illustration';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { RouteRail } from '@shared/components/ui/RouteRail';
import { SegmentedControl } from '@shared/components/ui/SegmentedControl';
import { SkeletonList } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { cn, formatCurrency, formatDistance, formatDuration } from '@shared/lib/utils';

/**
 * Booking Shifts — the driver's side.
 *
 * A pool of future jobs riders have booked in advance. Any online driver can
 * claim one; the moment they do it disappears for everyone else.
 *
 * ── The losing case is normal ──────────────────────────────────────────────
 * Two drivers will tap "Claim" on the same airport run at the same second.
 * The server resolves that with a conditional UPDATE and returns 409 to the
 * loser. That is not an error worth a red alert — it is just someone else
 * being faster. So a 409 gets a neutral message and an immediate refresh, and
 * anything else gets a real error.
 */

type Tab = 'available' | 'mine';

const TABS = [
  { id: 'available' as const, label: 'Available' },
  { id: 'mine' as const, label: 'My shifts' },
];

export function DriverShiftsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('available');

  const available = useQuery({
    queryKey: ['shifts', 'available'],
    queryFn: () => shiftsApi.available(),
    enabled: tab === 'available',
    /* Someone else may claim one while this list is open. */
    refetchInterval: 20_000,
    retry: 1,
  });

  const mine = useQuery({
    queryKey: ['shifts', 'claimed'],
    queryFn: () => shiftsApi.claimed(),
    enabled: tab === 'mine',
    retry: 1,
  });

  const claim = useMutation({
    mutationFn: (shiftId: string) => shiftsApi.claim(shiftId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift claimed', "It's yours. You'll get a reminder before pickup.");
    },
    onError: (error) => {
      if (error instanceof ShiftTakenError) {
        toast.info('Another driver got there first', 'That one is gone — here are the rest.');
        void queryClient.invalidateQueries({ queryKey: ['shifts', 'available'] });
        return;
      }
      toast.error('Could not claim that shift', (error as Error).message);
    },
  });

  const release = useMutation({
    mutationFn: (shiftId: string) => shiftsApi.release(shiftId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.info('Shift released', 'It is back in the pool for other drivers.');
    },
    onError: (error) => toast.error('Could not release it', (error as Error).message),
  });

  const active = tab === 'available' ? available : mine;
  const shifts = active.data ?? [];

  return (
    <div className="min-h-full bg-surface pb-tabbar">
      <ScreenHeader
        title="Booking shifts"
        subtitle={tab === 'available' ? 'Jobs booked in advance' : 'Shifts you have claimed'}
        onBack={false}
      />

      <div className="px-gutter pt-5">
        <SegmentedControl segments={TABS} value={tab} onChange={setTab} label="Shift list" />
      </div>

      <section className="mt-4 px-gutter">
        {active.isLoading && <SkeletonList count={3} />}

        {active.isError && (
          <ErrorState
            title="Couldn't load shifts"
            description="Booking Shifts needs its backend service running."
            onRetry={() => void active.refetch()}
          />
        )}

        {!active.isLoading && !active.isError && shifts.length === 0 && (
          <Card padded={false}>
            <EmptyState
              art={<NoTripsArt />}
              title={tab === 'available' ? 'No shifts available' : 'No claimed shifts'}
              description={
                tab === 'available'
                  ? 'Future bookings appear here as riders make them. Check back through the day.'
                  : 'Claim a shift from the Available tab and it will show here.'
              }
              action={
                tab === 'mine' ? (
                  <Button onClick={() => setTab('available')}>Browse available</Button>
                ) : undefined
              }
            />
          </Card>
        )}

        <ul className="stagger space-y-2.5">
          {shifts.map((shift) => (
            <li key={shift.id}>
              <ShiftCard
                shift={shift}
                mine={tab === 'mine'}
                busy={claim.isPending || release.isPending}
                onClaim={() => claim.mutate(shift.id)}
                onRelease={() => release.mutate(shift.id)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ShiftCard({
  shift,
  mine,
  busy,
  onClaim,
  onRelease,
}: {
  shift: Shift;
  mine: boolean;
  busy: boolean;
  onClaim: () => void;
  onRelease: () => void;
}) {
  const when = new Date(shift.scheduled_for);
  const now = new Date();
  const isToday = when.toDateString() === now.toDateString();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = when.toDateString() === tomorrow.toDateString();

  const dayLabel = isToday
    ? 'Today'
    : isTomorrow
      ? 'Tomorrow'
      : when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const timeLabel = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <article className="rounded-card border border-line bg-card p-4 shadow-card">
      {/* When */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
          >
            <CalendarClock size={17} />
          </span>
          <div>
            <p className="text-body font-semibold text-ink">
              {dayLabel} · <span className="tabular">{timeLabel}</span>
            </p>
            <p className="tabular text-micro text-ink-subtle">
              {formatDistance(shift.estimated_distance)} ·{' '}
              {formatDuration(shift.estimated_duration)}
            </p>
          </div>
        </div>

        <p className="tabular shrink-0 text-amount text-ink">
          {formatCurrency(shift.estimated_fare, shift.currency_code)}
        </p>
      </div>

      {/* Route */}
      <RouteRail
        compact
        className="mt-4"
        pickup={shift.pickup_address}
        destination={shift.dropoff_address}
      />

      {/* Flags */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        {shift.is_airport && (
          <Badge tone="info" size="sm">
            <Plane size={10} aria-hidden />
            Airport
          </Badge>
        )}
        <Badge tone="muted" size="sm">
          <Users size={10} aria-hidden />
          {shift.passenger_count}
        </Badge>
        {shift.luggage_count > 0 && (
          <Badge tone="muted" size="sm">
            <Luggage size={10} aria-hidden />
            {shift.luggage_count}
          </Badge>
        )}
      </div>

      {shift.notes && (
        <p className="mt-3 rounded-tile bg-surface px-3.5 py-2.5 text-caption leading-relaxed text-ink-muted">
          {shift.notes}
        </p>
      )}

      {/* Action */}
      <div className={cn('mt-4 border-t border-line pt-3.5')}>
        {mine ? (
          <Button variant="secondary" fullWidth disabled={busy} onClick={onRelease}>
            Release this shift
          </Button>
        ) : (
          <Button fullWidth loading={busy} onClick={onClaim}>
            Claim this shift
          </Button>
        )}
      </div>
    </article>
  );
}
