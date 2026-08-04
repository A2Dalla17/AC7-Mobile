import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crosshair, Loader2, TrendingUp } from 'lucide-react';

import { geoApi } from '@shared/api';
import type { LatLng } from '@shared/api/types';
import type { EstimateRequest } from '@shared/api';
import { MapView } from '@/components/map/MapView';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Sheet } from '@shared/components/ui/Sheet';
import { useToast } from '@shared/components/ui/Toast';
import { useGeolocation } from '@shared/hooks/useGeolocation';
import {
  useFareEstimates,
  useNearbyDrivers,
  useRequestRide,
  useRideTypes,
  useRoute,
} from '@shared/hooks/queries';
import { ApiError } from '@shared/lib/http';
import { formatDistance, formatDuration } from '@shared/lib/utils';

import { PlaceSearch, type SelectedPlace } from './components/PlaceSearch';
import { VehicleSelector } from './components/VehicleSelector';

/**
 * Booking screen.
 *
 * Flow: pickup (auto from GPS, editable) → destination → live estimates per
 * tier → request. Every step hits the real backend:
 *
 *   /geo/geocode/reverse       resolve the GPS fix to an address
 *   destination search now uses OpenStreetMap directly — see lib/geocode.ts
 *   /geo/drivers/nearby        the cars moving on the map
 *   /ride-types/available      vehicle tiers
 *   /pricing/bulk-estimate     a real price for each tier
 *   /maps/route                the route line and distance
 *   POST /rides                the booking itself
 */
export function BookRidePage() {
  const navigate = useNavigate();
  const toast = useToast();

  const { position: gpsPosition, isLocating, error: gpsError, request: locate } = useGeolocation();

  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [rideTypeId, setRideTypeId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');

  /* -- Seed pickup from the GPS fix --------------------------------------- */
  useEffect(() => {
    if (!gpsPosition || pickup) return;

    let cancelled = false;

    geoApi
      .reverseGeocode(gpsPosition)
      .then((result) => {
        if (cancelled) return;
        setPickup({
          address: result.formatted_address || 'Current location',
          position: { lat: result.latitude, lng: result.longitude },
        });
      })
      .catch(() => {
        // Reverse geocoding is a convenience; the coordinates are what matter.
        if (cancelled) return;
        setPickup({ address: 'Current location', position: gpsPosition });
      });

    return () => {
      cancelled = true;
    };
  }, [gpsPosition, pickup]);

  /* -- Data --------------------------------------------------------------- */
  const mapCenter = pickup?.position ?? gpsPosition ?? undefined;

  const { data: rideTypes, isLoading: loadingTypes } = useRideTypes();
  const { data: nearbyDrivers } = useNearbyDrivers(pickup?.position ?? null, !destination);

  const estimateRequest = useMemo<EstimateRequest | null>(() => {
    if (!pickup || !destination) return null;
    return {
      pickup_latitude: pickup.position.lat,
      pickup_longitude: pickup.position.lng,
      dropoff_latitude: destination.position.lat,
      dropoff_longitude: destination.position.lng,
      ...(promoCode.trim() ? { promo_code: promoCode.trim() } : {}),
    };
  }, [pickup, destination, promoCode]);

  const { data: estimates, isLoading: loadingEstimates } = useFareEstimates(estimateRequest);
  const { data: route } = useRoute(pickup?.position ?? null, destination?.position ?? null);

  const requestRide = useRequestRide();

  /* -- Default the tier selection once estimates land ---------------------- */
  useEffect(() => {
    if (rideTypeId || !rideTypes?.length) return;
    setRideTypeId(rideTypes[0]!.id);
  }, [rideTypes, rideTypeId]);

  const selectedEstimate = estimates?.find((e) => e.ride_type_id === rideTypeId);
  const surging = (selectedEstimate?.surge_multiplier ?? 1) > 1;

  /* -- Actions ------------------------------------------------------------- */
  async function handleRequest() {
    if (!pickup || !destination) return;

    try {
      const ride = await requestRide.mutateAsync({
        pickup_latitude: pickup.position.lat,
        pickup_longitude: pickup.position.lng,
        pickup_address: pickup.address,
        dropoff_latitude: destination.position.lat,
        dropoff_longitude: destination.position.lng,
        dropoff_address: destination.address,
        ride_type_id: rideTypeId,
        ...(promoCode.trim() ? { promo_code: promoCode.trim() } : {}),
        is_scheduled: false,
      });

      navigate(`/rider/track/${ride.id}`);
    } catch (error) {
      toast.error(
        'Could not request your ride',
        error instanceof ApiError ? error.userMessage : 'Please try again.',
      );
    }
  }

  function useCurrentLocationAsPickup() {
    setPickup(null);
    locate();
  }

  const canRequest = Boolean(pickup && destination && rideTypeId && !requestRide.isPending);

  /* ------------------------------------------------------------------------ */

  return (
    <div className="relative h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)]">
      <MapView
        center={mapCenter as LatLng | undefined}
        pickup={pickup?.position ?? null}
        destination={destination?.position ?? null}
        drivers={nearbyDrivers ?? []}
        routePolyline={route?.polyline ?? null}
        className="absolute inset-0"
      />

      {/* Re-centre control */}
      <button
        type="button"
        onClick={useCurrentLocationAsPickup}
        aria-label="Use my current location"
        className="absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-xl bg-bg text-ink shadow-card transition-colors hover:bg-surface lg:right-6 lg:top-6"
      >
        {isLocating ? (
          <Loader2 size={19} className="animate-spin" aria-hidden />
        ) : (
          <Crosshair size={19} aria-hidden />
        )}
      </button>

      <Sheet label="Book a ride">
        <div className="space-y-4">
          <div>
            <h1 className="text-h3 text-ink">Where to?</h1>
            {gpsError && <p className="mt-1 text-sm text-ink-muted">{gpsError}</p>}
          </div>

          {/* Route inputs */}
          <div className="space-y-2">
            <PlaceSearch
              label="Pickup"
              placeholder="Enter pickup location"
              leadingDot="pickup"
              value={pickup}
              near={gpsPosition}
              onSelect={setPickup}
              onClear={() => setPickup(null)}
            />

            <PlaceSearch
              label="Destination"
              placeholder="Where are you going?"
              leadingDot="destination"
              value={destination}
              near={pickup?.position ?? gpsPosition}
              autoFocus={Boolean(pickup)}
              onSelect={setDestination}
              onClear={() => setDestination(null)}
            />
          </div>

          {/* Trip summary */}
          {route && destination && (
            <div className="flex items-center gap-4 rounded-xl bg-surface px-4 py-3 text-sm">
              <span className="text-ink-muted">
                <span className="font-medium text-ink">
                  {formatDistance(route.distance_meters / 1000)}
                </span>{' '}
                distance
              </span>
              <span aria-hidden className="h-4 w-px bg-line-strong" />
              <span className="text-ink-muted">
                <span className="font-medium text-ink">
                  {formatDuration(
                    (route.duration_in_traffic_seconds ?? route.duration_seconds) / 60,
                  )}
                </span>{' '}
                in traffic
              </span>
            </div>
          )}

          {/* Vehicle tiers */}
          {destination && (
            <>
              {surging && (
                <div className="flex items-start gap-2.5 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3">
                  <TrendingUp size={17} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
                  <p className="text-sm text-ink">
                    <span className="font-semibold">Higher demand right now.</span> Fares are
                    temporarily {selectedEstimate?.surge_multiplier?.toFixed(1)}× the usual rate.
                  </p>
                </div>
              )}

              <VehicleSelector
                rideTypes={rideTypes ?? []}
                estimates={estimates}
                selectedId={rideTypeId}
                onSelect={setRideTypeId}
                loading={loadingTypes || loadingEstimates}
              />

              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Promo code (optional)"
                aria-label="Promo code"
                className="h-11 w-full rounded-xl border border-line bg-bg px-4 text-sm uppercase tracking-wide text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ink/20"
              />

              {selectedEstimate?.discount_amount ? (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-muted">Promo discount</span>
                  <Badge tone="success">
                    −{selectedEstimate.discount_amount.toFixed(2)}
                  </Badge>
                </div>
              ) : null}
            </>
          )}

          <Button
            size="lg"
            fullWidth
            disabled={!canRequest}
            loading={requestRide.isPending}
            onClick={handleRequest}
          >
            {!destination
              ? 'Choose a destination'
              : requestRide.isPending
                ? 'Requesting'
                : 'Request ride'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
