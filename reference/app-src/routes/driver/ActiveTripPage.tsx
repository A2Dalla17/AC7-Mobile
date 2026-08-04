import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Check, ChevronRight, MessageCircle, Phone, ShieldAlert,
} from 'lucide-react';

import { driverRidesApi, ridesApi } from '@shared/api';
import type { LatLng, Ride } from '@shared/api/types';
import { Avatar } from '@shared/components/ui/Avatar';
import { Button, IconButton } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { MapView } from '@/components/map/MapView';
import { NavigateButton } from '@/components/map/NavigateButton';
import { RouteRail } from '@shared/components/ui/RouteRail';
import { Sheet } from '@shared/components/ui/Sheet';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { useGeolocation } from '@shared/hooks/useGeolocation';
import { ApiError } from '@shared/lib/http';
import { cn, formatCurrency, formatDistance, formatDuration } from '@shared/lib/utils';

/**
 * The driver's active job.
 *
 * ── Why navigation is a handoff, not built in ───────────────────────────────
 * Drivers already trust Waze and Google Maps, know their voice prompts, and
 * have them set up how they like. Rebuilding that badly would be worse than
 * handing off. So each leg of the trip offers both apps, with the coordinates
 * already in the deep link — the driver never types an address.
 *
 * The destination changes with the stage, which is the part that matters:
 *
 *   accepted / arriving  →  navigate to the PICKUP
 *   in progress          →  navigate to the DESTINATION
 *
 * Both are plain URL schemes. No API key, no SDK, no billing.
 *
 * ── Stages ─────────────────────────────────────────────────────────────────
 * Backend status drives the stage, so a refresh or a dispatcher action lands
 * everyone in the same place. `internal/rides` has three transitions —
 * accept, start, complete — and NO "arrived" endpoint.
 *
 * So "I've arrived" is a local flag only. It does not call the API. Its job
 * is purely to move the driver from the pickup leg to the pre-trip state
 * without inventing a status the backend does not have. If an /arrived
 * endpoint is added later, promote it to server state here.
 */

type Stage = 'heading_to_pickup' | 'at_pickup' | 'in_progress' | 'completed';

function stageFrom(ride: Ride | undefined, arrivedLocally: boolean): Stage {
  if (!ride) return 'heading_to_pickup';
  if (ride.status === 'completed' || ride.status === 'cancelled') return 'completed';
  if (ride.status === 'in_progress') return 'in_progress';
  return arrivedLocally ? 'at_pickup' : 'heading_to_pickup';
}

export function DriverActiveTripPage() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { position } = useGeolocation({ watch: true });
  const [busy, setBusy] = useState(false);
  const [arrivedLocally, setArrivedLocally] = useState(false);

  const {
    data: ride,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['driver', 'active-trip', rideId],
    queryFn: () => ridesApi.get(rideId!),
    enabled: Boolean(rideId),
    /* The dispatcher or the rider can change this out from under the driver
       (a cancellation, for instance), so keep it fresh without being noisy. */
    refetchInterval: 15_000,
    retry: 1,
  });

  const stage = stageFrom(ride, arrivedLocally);

  const pickup: LatLng | null = ride
    ? { lat: ride.pickup_latitude, lng: ride.pickup_longitude }
    : null;
  const dropoff: LatLng | null = ride
    ? { lat: ride.dropoff_latitude, lng: ride.dropoff_longitude }
    : null;

  /* This is the whole point of the screen: which leg are we on? */
  const navTarget = stage === 'in_progress' ? dropoff : pickup;
  const navLabel = stage === 'in_progress' ? 'Navigate to destination' : 'Navigate to pickup';

  const legAddress = useMemo(() => {
    if (!ride) return '';
    return stage === 'in_progress' ? ride.dropoff_address : ride.pickup_address;
  }, [ride, stage]);

  /* -- Stage transitions --------------------------------------------------- */

  async function advance(action: 'start' | 'complete') {
    if (!rideId) return;
    setBusy(true);

    try {
      if (action === 'start') {
        await driverRidesApi.start(rideId);
        toast.success('Trip started');
      } else {
        await driverRidesApi.complete(rideId);
        toast.success('Trip complete', 'Payment is being taken now.');
      }
      await refetch();
    } catch (error) {
      toast.error(
        'Could not update the trip',
        error instanceof ApiError ? error.userMessage : 'Check your signal and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  /* -- States -------------------------------------------------------------- */

  if (isLoading) {
    return (
      <div className="relative h-[calc(100vh-4rem)]">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
    );
  }

  if (isError || !ride) {
    return (
      <EmptyState
        tone="error"
        icon={<AlertTriangle size={24} />}
        title="Couldn't load this job"
        description="It may have been reassigned or cancelled."
        action={<Button onClick={() => navigate('/driver')}>Back to dashboard</Button>}
      />
    );
  }

  if (stage === 'completed') {
    return <TripCompleted ride={ride} onDone={() => navigate('/driver')} />;
  }

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <MapView
        center={position ?? pickup ?? undefined}
        pickup={pickup}
        destination={stage === 'in_progress' ? dropoff : null}
        drivers={
          position
            ? [{ driver_id: 'me', latitude: position.lat, longitude: position.lng, heading: 0 }]
            : []
        }
        className="absolute inset-0"
      />

      {/* Stage strip — always visible above the sheet */}
      <div className="absolute inset-x-0 top-0 z-20 px-gutter pt-[calc(0.75rem+var(--safe-top))]">
        <div className="glass flex items-center gap-3 rounded-pill border border-line px-4 py-2.5 shadow-card">
          <span
            aria-hidden
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              stage === 'in_progress' ? 'animate-breathe bg-success' : 'animate-breathe bg-brand',
            )}
          />
          <p className="min-w-0 flex-1 truncate text-caption font-semibold text-ink">
            {stage === 'heading_to_pickup' && 'Heading to pickup'}
            {stage === 'at_pickup' && 'Waiting for the rider'}
            {stage === 'in_progress' && 'Trip in progress'}
          </p>
          <p className="tabular shrink-0 text-caption text-ink-muted">
            {formatCurrency(ride.final_fare ?? ride.estimated_fare, ride.currency_code)}
          </p>
        </div>
      </div>

      <Sheet label="Active trip" height="auto">
        <div className="space-y-4">
          {/* ---- Where to go now ---------------------------------------- */}
          <div>
            <p className="text-overline uppercase text-ink-subtle">
              {stage === 'in_progress' ? 'Drop off at' : 'Pick up from'}
            </p>
            <p className="mt-1 text-h4 leading-snug text-ink">{legAddress}</p>
          </div>

          {/* ---- Navigation — the deep links ---------------------------- */}
          {navTarget && (
            <NavigateButton destination={navTarget} label={navLabel} className="w-full" />
          )}

          {/* ---- Rider ---------------------------------------------------- */}
          <div className="flex items-center gap-3 rounded-tile bg-surface px-4 py-3">
            <Avatar initials="R" size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-ink">Your rider</p>
              <p className="tabular text-caption text-ink-muted">
                {formatDistance(ride.estimated_distance)} · {formatDuration(ride.estimated_duration)}
              </p>
            </div>
            <IconButton label="Message the rider">
              <MessageCircle size={17} />
            </IconButton>
            <IconButton label="Call the rider" tone="brand">
              <Phone size={17} />
            </IconButton>
          </div>

          {/* ---- Full route ------------------------------------------------ */}
          <RouteRail
            compact
            showLabels
            pickup={ride.pickup_address}
            destination={ride.dropoff_address}
            className="rounded-tile border border-line bg-card p-4"
          />

          {/* ---- Stage action --------------------------------------------- */}
          {stage === 'heading_to_pickup' && (
            <Button
              size="lg"
              fullWidth
              variant="secondary"
              onClick={() => setArrivedLocally(true)}
            >
              I've arrived
            </Button>
          )}

          {stage === 'at_pickup' && (
            <Button size="lg" fullWidth loading={busy} onClick={() => void advance('start')}>
              Start trip
            </Button>
          )}

          {stage === 'in_progress' && (
            <Button
              size="lg"
              fullWidth
              variant="success"
              loading={busy}
              leadingIcon={<Check size={18} />}
              onClick={() => void advance('complete')}
            >
              Complete trip
            </Button>
          )}

          <button
            type="button"
            onClick={() => navigate('/driver/safety')}
            className="flex w-full items-center justify-center gap-2 py-2 text-caption font-semibold text-danger-ink"
          >
            <ShieldAlert size={15} aria-hidden />
            Emergency
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TripCompleted({ ride, onDone }: { ride: Ride; onDone: () => void }) {
  const fare = ride.final_fare ?? ride.estimated_fare;

  return (
    <div className="min-h-full bg-surface pb-tabbar">
      <div className="stagger px-gutter pt-[calc(3rem+var(--safe-top))]">
        <div className="text-center">
          <span
            aria-hidden
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success-soft text-success-ink"
          >
            <Check size={38} strokeWidth={2.5} />
          </span>
          <h1 className="mt-5 text-h2 text-ink">Trip complete</h1>
          <p className="mt-1.5 text-body text-ink-muted">Payment is being taken now.</p>
        </div>

        <div className="mt-8 rounded-panel border border-line bg-card p-5 shadow-card">
          <p className="text-overline uppercase text-ink-subtle">You earned</p>
          <p className="tabular mt-1.5 text-amount-xl text-ink">
            {formatCurrency(fare * 0.8, ride.currency_code)}
          </p>
          <p className="mt-1 text-caption text-ink-subtle">
            {formatCurrency(fare, ride.currency_code)} fare, less 20% commission
          </p>

          <RouteRail
            compact
            className="mt-5 border-t border-line pt-4"
            pickup={ride.pickup_address}
            destination={ride.dropoff_address}
          />
        </div>

        <Button size="lg" fullWidth className="mt-5" trailingIcon={<ChevronRight size={17} />} onClick={onDone}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
