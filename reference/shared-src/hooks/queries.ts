/**
 * AC7 Ride — React Query bindings
 *
 * One place for every cache key and every fetch policy. Components call these
 * hooks, never the API modules directly, so caching and invalidation stay
 * consistent across screens.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  earningsApi,
  favoritesApi,
  geoApi,
  paymentsApi,
  pricingApi,
  ridesApi,
  driverRidesApi,
  safetyApi,
  walletApi,
} from '@shared/api';
import type { LatLng, RideRequestPayload } from '@shared/api/types';
import type { EstimateRequest } from '@shared/api';
import { computeRoute } from '@shared/lib/geocode';
import { quoteAll, tariffsAsRideTypes } from '@shared/lib/pricing';

/* -------------------------------------------------------------------------- */
/* Cache keys                                                                  */
/* -------------------------------------------------------------------------- */

export const keys = {
  rideTypes: ['ride-types'] as const,
  rides: (filters?: unknown) => ['rides', filters] as const,
  ride: (id: string) => ['ride', id] as const,
  nearbyDrivers: (position: LatLng) =>
    ['nearby-drivers', position.lat.toFixed(3), position.lng.toFixed(3)] as const,
  estimates: (req: EstimateRequest) => ['estimates', req] as const,
  route: (from: LatLng, to: LatLng) => ['route', from, to] as const,
  surge: (position: LatLng) => ['surge', position.lat.toFixed(2), position.lng.toFixed(2)] as const,
  wallet: ['wallet'] as const,
  walletTransactions: ['wallet', 'transactions'] as const,
  paymentMethods: ['payment-methods'] as const,
  favorites: ['favorites'] as const,
  emergencyContacts: ['safety', 'contacts'] as const,
  driverStatus: ['driver', 'status'] as const,
  driverAvailable: ['driver', 'available-rides'] as const,
  earningsSummary: (period?: string) => ['driver', 'earnings', 'summary', period] as const,
};

/* -------------------------------------------------------------------------- */
/* Ride types & pricing                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The vehicle tiers a rider can choose from.
 *
 * From the local tariff table for the same reason as the fares: the endpoint
 * this used to call is on the undeployed Go service, so the selector rendered
 * empty and there was nothing to book. Resolved rather than fetched, so the
 * tiers appear instantly and cannot fail.
 */
export function useRideTypes() {
  return useQuery({
    queryKey: keys.rideTypes,
    queryFn: () => Promise.resolve(tariffsAsRideTypes()),
    staleTime: 15 * 60_000,
  });
}

/**
 * Fare estimates for every tier at once, so the selector shows real prices
 * rather than placeholders. Only runs when both ends of the trip are known.
 *
 * ── Why this no longer calls the backend ──────────────────────────────────
 * It called /pricing/bulk-estimate on the Go service, which is deployed
 * nowhere. The request resolved to the SPA's own index.html, failed on a JSON
 * parse, and the booking screen showed no price at all — permanently, with
 * nothing on screen to explain it. A minicab app that cannot quote a fare is
 * not a minicab app.
 *
 * The fare is now computed from the route Google returns, using the tariff in
 * lib/pricing.ts. It needs no backend, and it is honest: the same distance and
 * duration the rider can see on the screen are the numbers the price is
 * derived from.
 *
 * When the pricing service does exist, this reverts to one line — the shape it
 * returns is unchanged.
 */
export function useFareEstimates(request: EstimateRequest | null) {
  const { data: route } = useRoute(
    request ? { lat: request.pickup_latitude, lng: request.pickup_longitude } : null,
    request ? { lat: request.dropoff_latitude, lng: request.dropoff_longitude } : null,
  );

  return useQuery({
    queryKey: [...keys.estimates(request!), route?.distance_meters, route?.duration_seconds],
    queryFn: () =>
      quoteAll(
        route!.distance_meters,
        route!.duration_in_traffic_seconds ?? route!.duration_seconds,
      ),
    /* Only once the route is known. Quoting from a straight-line guess would
       under-price every journey that crosses the river, and a rider quoted £12
       who is charged £19 does not come back. */
    enabled: request !== null && route != null,
    staleTime: 60_000,
  });
}

export function useSurge(position: LatLng | null) {
  return useQuery({
    queryKey: keys.surge(position!),
    queryFn: () => pricingApi.surge(position!),
    enabled: position !== null,
    staleTime: 2 * 60_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Geo                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Nearby drivers. Polls while the user is choosing a destination so the map
 * feels alive; 15 s is frequent enough to look live without hammering /geo.
 */
export function useNearbyDrivers(position: LatLng | null, enabled = true) {
  return useQuery({
    queryKey: keys.nearbyDrivers(position!),
    queryFn: () => geoApi.nearbyDrivers(position!),
    enabled: enabled && position !== null,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

/**
 * Route geometry, distance and duration.
 *
 * ── Why this no longer calls the backend either ───────────────────────────
 * Same story as the fares: /maps/route lives on the undeployed Go service, so
 * the booking screen showed neither miles nor minutes. This asks Google Routes
 * directly. `computeRoute` caches for two minutes and counts against the
 * monthly budget, so a re-render costs nothing and a runaway cannot bill.
 *
 * The response is reshaped to the old wire format rather than changing the
 * callers, so BookRidePage, TrackRidePage and the driver screens are all
 * untouched — and switching back to a real routing service later is one
 * function, not a sweep through five screens.
 */
export function useRoute(from: LatLng | null, to: LatLng | null) {
  return useQuery({
    queryKey: keys.route(from!, to!),
    queryFn: async () => {
      const result = await computeRoute(from!, to!);
      if (!result) return null;
      return {
        polyline: result.polyline,
        distance_meters: result.distance,
        duration_seconds: result.duration,
        /* Google's TRAFFIC_AWARE duration already accounts for current
           conditions, so there is no separate free-flow figure to report. */
        duration_in_traffic_seconds: result.duration,
      };
    },
    enabled: from !== null && to !== null,
    staleTime: 5 * 60_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Rides                                                                       */
/* -------------------------------------------------------------------------- */

export function useMyRides(params?: { page?: number; per_page?: number; status?: string }) {
  return useQuery({
    queryKey: keys.rides(params),
    queryFn: () => ridesApi.list(params),
  });
}

/**
 * A single ride. Polls while the ride is live as a safety net beneath the
 * WebSocket — if the socket drops, the screen still progresses.
 */
export function useRide(rideId: string | null) {
  return useQuery({
    queryKey: keys.ride(rideId!),
    queryFn: () => ridesApi.get(rideId!),
    enabled: rideId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 10_000;
      return status === 'completed' || status === 'cancelled' ? false : 10_000;
    },
  });
}

export function useRequestRide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RideRequestPayload) => ridesApi.request(payload),
    onSuccess: (ride) => {
      queryClient.setQueryData(keys.ride(ride.id), ride);
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
    },
  });
}

export function useCancelRide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rideId, reason }: { rideId: string; reason?: string }) =>
      ridesApi.cancel(rideId, reason),
    onSuccess: (ride) => {
      queryClient.setQueryData(keys.ride(ride.id), ride);
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
    },
  });
}

export function useRateRide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rideId,
      rating,
      feedback,
    }: {
      rideId: string;
      rating: number;
      feedback?: string;
    }) => ridesApi.rate(rideId, { rating, feedback }),
    onSuccess: (ride) => {
      queryClient.setQueryData(keys.ride(ride.id), ride);
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Wallet & payments                                                           */
/* -------------------------------------------------------------------------- */

export function useWallet() {
  return useQuery({ queryKey: keys.wallet, queryFn: () => walletApi.get() });
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: keys.walletTransactions,
    queryFn: () => walletApi.transactions(),
  });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: keys.paymentMethods, queryFn: () => paymentsApi.methods() });
}

export function useTopUpWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ amount, methodId }: { amount: number; methodId?: string }) =>
      walletApi.topUp(amount, methodId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.wallet });
      void queryClient.invalidateQueries({ queryKey: keys.walletTransactions });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Favorites                                                                   */
/* -------------------------------------------------------------------------- */

export function useFavorites() {
  return useQuery({ queryKey: keys.favorites, queryFn: () => favoritesApi.list() });
}

/* -------------------------------------------------------------------------- */
/* Safety                                                                      */
/* -------------------------------------------------------------------------- */

export function useEmergencyContacts() {
  return useQuery({
    queryKey: keys.emergencyContacts,
    queryFn: () => safetyApi.contacts(),
  });
}

export function useTriggerSos() {
  return useMutation({
    mutationFn: ({ position, rideId }: { position: LatLng; rideId?: string }) =>
      safetyApi.triggerSos(position, rideId),
  });
}

/* -------------------------------------------------------------------------- */
/* Driver                                                                      */
/* -------------------------------------------------------------------------- */

export function useDriverStatus() {
  return useQuery({ queryKey: keys.driverStatus, queryFn: () => geoApi.driverStatus() });
}

export function useSetDriverStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isAvailable: boolean) => geoApi.setDriverStatus(isAvailable),
    onSuccess: (driver) => {
      queryClient.setQueryData(keys.driverStatus, driver);
      void queryClient.invalidateQueries({ queryKey: keys.driverAvailable });
    },
  });
}

/** Ride requests waiting for a driver. Polled while online. */
export function useAvailableRides(enabled: boolean) {
  return useQuery({
    queryKey: keys.driverAvailable,
    queryFn: () => driverRidesApi.available(),
    enabled,
    refetchInterval: enabled ? 8_000 : false,
  });
}

export function useDriverEarnings(period: 'day' | 'week' | 'month' = 'week') {
  return useQuery({
    queryKey: keys.earningsSummary(period),
    queryFn: () => earningsApi.summary(period),
  });
}
