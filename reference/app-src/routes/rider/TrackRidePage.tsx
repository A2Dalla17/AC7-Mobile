import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Phone, Share2, ShieldAlert, Star } from 'lucide-react';

import { safetyApi } from '@shared/api';
import type { LatLng, NearbyDriver } from '@shared/api/types';
import { MapView } from '@/components/map/MapView';
import { Avatar } from '@shared/components/ui/Avatar';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Modal } from '@shared/components/ui/Modal';
import { RideStatusBadge } from '@shared/components/ui/Badge';
import { Sheet } from '@shared/components/ui/Sheet';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { useCancelRide, useRateRide, useRide, useRoute, useTriggerSos } from '@shared/hooks/queries';
import { useRideEvents } from '@shared/hooks/useRealtime';
import { ApiError } from '@shared/lib/http';
import { cn, formatCurrency, formatDuration, initials, secondsToMinutes } from '@shared/lib/utils';

/**
 * Live ride tracking.
 *
 * Two data paths, deliberately:
 *   - WebSocket for driver position and status transitions (instant)
 *   - React Query polling every 10 s as a safety net (survives a socket drop)
 *
 * The socket updates local state directly rather than invalidating the query,
 * because a position frame arriving twice a second must not trigger a refetch.
 */
export function TrackRidePage() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: ride, isLoading, isError } = useRide(rideId ?? null);

  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [rating, setRating] = useState(0);

  const cancelRide = useCancelRide();
  const rateRide = useRateRide();
  const triggerSos = useTriggerSos();

  /* -- Realtime ------------------------------------------------------------ */

  useRideEvents<{ latitude: number; longitude: number; heading?: number }>(
    rideId,
    'driver_location',
    (message) => {
      setDriverPosition({ lat: message.data.latitude, lng: message.data.longitude });
      if (typeof message.data.heading === 'number') setDriverHeading(message.data.heading);
    },
  );

  useRideEvents<{ eta_seconds?: number; duration_seconds?: number }>(
    rideId,
    'driver_eta',
    (message) => {
      const seconds = message.data.eta_seconds ?? message.data.duration_seconds;
      setEtaMinutes(secondsToMinutes(seconds ?? null));
    },
  );

  useRideEvents<{ status?: string }>(rideId, 'ride_status_update', (message) => {
    const status = message.data.status;
    if (status === 'accepted') toast.success('Driver assigned', 'Your driver is on the way.');
    if (status === 'in_progress') toast.info('Trip started', 'Enjoy your ride.');
    if (status === 'completed') toast.success('Trip complete');
  });

  /* -- Route from the driver to the rider, then rider to destination ------- */
  const pickup: LatLng | null = ride
    ? { lat: ride.pickup_latitude, lng: ride.pickup_longitude }
    : null;
  const dropoff: LatLng | null = ride
    ? { lat: ride.dropoff_latitude, lng: ride.dropoff_longitude }
    : null;

  const enRouteToPickup = ride?.status === 'accepted';
  const routeFrom = enRouteToPickup ? driverPosition : pickup;
  const routeTo = enRouteToPickup ? pickup : dropoff;

  const { data: route } = useRoute(routeFrom, routeTo);

  /* -- Fall back to route ETA when no driver_eta frame has arrived --------- */
  useEffect(() => {
    if (etaMinutes !== null || !route) return;
    setEtaMinutes(
      secondsToMinutes(route.duration_in_traffic_seconds ?? route.duration_seconds),
    );
  }, [route, etaMinutes]);

  /* -- Actions ------------------------------------------------------------- */

  async function handleCancel() {
    if (!rideId) return;
    try {
      await cancelRide.mutateAsync({ rideId, reason: 'Cancelled by rider' });
      setCancelOpen(false);
      toast.info('Ride cancelled');
      navigate('/rider');
    } catch (error) {
      toast.error(
        'Could not cancel',
        error instanceof ApiError ? error.userMessage : 'Please try again.',
      );
    }
  }

  async function handleSos() {
    if (!driverPosition && !pickup) return;
    try {
      await triggerSos.mutateAsync({
        position: driverPosition ?? pickup!,
        ...(rideId ? { rideId } : {}),
      });
      setSosOpen(false);
      toast.success('Emergency alert sent', 'Our safety team and your contacts have been notified.');
    } catch (error) {
      toast.error(
        'Alert could not be sent',
        error instanceof ApiError ? error.userMessage : 'Call local emergency services directly.',
      );
    }
  }

  async function handleShare() {
    if (!rideId) return;
    try {
      const link = await safetyApi.shareTrip(rideId);
      const url = `${window.location.origin}/share/${link.token}`;

      if (navigator.share) {
        await navigator.share({ title: 'Follow my AC7 Ride', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied', 'Share it with whoever is expecting you.');
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error('Could not create a share link', error.userMessage);
    }
  }

  async function handleRate(value: number) {
    if (!rideId) return;
    setRating(value);
    try {
      await rateRide.mutateAsync({ rideId, rating: value });
      toast.success('Thanks for the feedback');
      navigate('/rider');
    } catch (error) {
      toast.error(
        'Could not submit your rating',
        error instanceof ApiError ? error.userMessage : undefined,
      );
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
        title="We couldn't load this trip"
        description="It may have been removed, or you may not have access to it."
        action={<Button onClick={() => navigate('/rider')}>Back to booking</Button>}
      />
    );
  }

  const driverMarkers: NearbyDriver[] = driverPosition
    ? [
        {
          driver_id: ride.driver_id ?? 'assigned',
          latitude: driverPosition.lat,
          longitude: driverPosition.lng,
          heading: driverHeading,
        },
      ]
    : [];

  const isFinished = ride.status === 'completed' || ride.status === 'cancelled';

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <MapView
        pickup={pickup}
        destination={dropoff}
        drivers={driverMarkers}
        routePolyline={route?.polyline ?? null}
        className="absolute inset-0"
      />

      {/* Safety controls */}
      {!isFinished && (
        <div className="absolute right-4 top-4 z-20 flex flex-col gap-2 lg:right-6 lg:top-6">
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Share this trip"
            className="grid h-11 w-11 place-items-center rounded-xl bg-bg text-ink shadow-card transition-colors hover:bg-surface"
          >
            <Share2 size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSosOpen(true)}
            aria-label="Emergency SOS"
            className="grid h-11 w-11 place-items-center rounded-xl bg-danger text-white shadow-card transition-transform hover:scale-105"
          >
            <ShieldAlert size={18} aria-hidden />
          </button>
        </div>
      )}

      <Sheet label="Trip status">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <RideStatusBadge status={ride.status} />
              <p className="mt-2 text-h3 text-ink">
                {ride.status === 'requested' && 'Finding your driver'}
                {ride.status === 'accepted' &&
                  (etaMinutes !== null
                    ? `Arriving in ${formatDuration(etaMinutes)}`
                    : 'Driver on the way')}
                {ride.status === 'in_progress' &&
                  (etaMinutes !== null
                    ? `${formatDuration(etaMinutes)} to destination`
                    : 'On your way')}
                {ride.status === 'completed' && 'You have arrived'}
                {ride.status === 'cancelled' && 'Trip cancelled'}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="tabular text-h4 text-ink">
                {formatCurrency(ride.final_fare ?? ride.estimated_fare, ride.currency_code)}
              </p>
              <p className="text-xs text-ink-muted">
                {ride.final_fare ? 'Final fare' : 'Estimated'}
              </p>
            </div>
          </div>

          {/* Driver card */}
          {ride.driver && (
            <div className="flex items-center gap-4 rounded-xl bg-surface p-4">
              <Avatar initials={initials(ride.rider ?? null) || 'DR'} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {ride.driver.vehicle_model} · {ride.driver.vehicle_color}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {ride.driver.vehicle_plate} · {ride.driver.rating.toFixed(2)} ★
                </p>
              </div>
              <a
                href="tel:"
                aria-label="Call your driver"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bg text-ink shadow-xs transition-colors hover:bg-card"
              >
                <Phone size={18} aria-hidden />
              </a>
            </div>
          )}

          {/* Addresses */}
          <div className="space-y-3">
            <AddressRow kind="pickup" label="Pickup" value={ride.pickup_address} />
            <AddressRow kind="destination" label="Destination" value={ride.dropoff_address} />
          </div>

          {/* Rating, once complete */}
          {ride.status === 'completed' && !ride.rating && (
            <div className="rounded-xl bg-surface p-4">
              <p className="text-center font-semibold text-ink">How was your trip?</p>
              <div className="mt-3 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void handleRate(value)}
                    disabled={rateRide.isPending}
                    aria-label={`${value} star${value > 1 ? 's' : ''}`}
                    className="rounded-lg p-1.5 transition-transform hover:scale-110"
                  >
                    <Star
                      size={28}
                      className={cn(
                        value <= rating ? 'fill-brand text-brand-ink' : 'text-line-strong',
                      )}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary action */}
          {isFinished ? (
            <Button size="lg" fullWidth onClick={() => navigate('/rider')}>
              Book another ride
            </Button>
          ) : (
            <Button size="lg" variant="secondary" fullWidth onClick={() => setCancelOpen(true)}>
              Cancel ride
            </Button>
          )}
        </div>
      </Sheet>

      {/* Cancel confirmation */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this ride?"
        description={
          ride.status === 'accepted'
            ? 'Your driver is already on the way. A cancellation fee may apply.'
            : 'You can request another ride at any time.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep ride
            </Button>
            <Button variant="danger" loading={cancelRide.isPending} onClick={() => void handleCancel()}>
              Cancel ride
            </Button>
          </>
        }
      />

      {/* SOS confirmation */}
      <Modal
        open={sosOpen}
        onClose={() => setSosOpen(false)}
        title="Send an emergency alert?"
        description="Your location and trip details will be sent to the AC7 safety team and your emergency contacts immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSosOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={triggerSos.isPending} onClick={() => void handleSos()}>
              Send alert
            </Button>
          </>
        }
      />
    </div>
  );
}

function AddressRow({
  kind,
  label,
  value,
}: {
  kind: 'pickup' | 'destination';
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="mt-1.5 grid h-3 w-3 shrink-0 place-items-center">
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            kind === 'pickup' ? 'border-[2.5px] border-brand bg-bg' : 'bg-ink',
          )}
        />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="text-body text-ink">{value}</p>
      </div>
    </div>
  );
}
