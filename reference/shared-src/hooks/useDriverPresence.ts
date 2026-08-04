import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { driversApi, type DriverPresence, type DriverRecord } from '@shared/api/drivers';
import { supabase } from '@shared/lib/supabase';

/**
 * The driver's own record and their online/offline state.
 *
 * ── Why the toggle is optimistic ───────────────────────────────────────────
 * A driver taps "Go online" while pulling away from a kerb on a patchy signal.
 * Waiting for a round trip before the switch moves makes them tap it again,
 * and a double tap on a slow network is how you get someone who believes they
 * are online while the server has them offline. Flipping the cache first and
 * rolling back on failure means the control always responds immediately and
 * the truth catches up.
 *
 * ── Why it also subscribes ─────────────────────────────────────────────────
 * Presence is not only changed from this device. Accepting a job moves a driver
 * to on_trip server-side, and an admin can force someone offline. Without the
 * subscription the toggle would sit there claiming "available" while the driver
 * is mid-fare.
 */
export function useDriverPresence() {
  const queryClient = useQueryClient();

  const driver = useQuery<DriverRecord | null>({
    queryKey: ['driver', 'me'],
    queryFn: () => driversApi.me(),
    staleTime: 30_000,
  });

  const driverId = driver.data?.id;

  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-presence:${driverId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` },
        (payload) => {
          queryClient.setQueryData<DriverRecord | null>(['driver', 'me'], (current) =>
            current ? { ...current, ...(payload.new as Partial<DriverRecord>) } : current,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);

  const setPresence = useMutation({
    mutationFn: (presence: DriverPresence) => {
      if (!driverId) throw new Error('Your driver record is still loading.');
      return driversApi.setPresence(driverId, presence);
    },

    onMutate: async (presence) => {
      await queryClient.cancelQueries({ queryKey: ['driver', 'me'] });
      const previous = queryClient.getQueryData(['driver', 'me']);

      queryClient.setQueryData<DriverRecord | null>(['driver', 'me'], (current) =>
        current
          ? {
              ...current,
              presence,
              is_online: presence !== 'offline',
              is_available: presence === 'available',
            }
          : current,
      );

      return { previous };
    },

    onError: (_error, _presence, context) => {
      // Put the switch back where it was. Leaving it flipped after a failure is
      // the single most dangerous state here: the driver stops looking for jobs
      // because they believe they are online.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['driver', 'me'], context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver', 'me'] });
    },
  });

  const presence: DriverPresence = driver.data?.presence ?? 'offline';

  const toggleOnline = useCallback(() => {
    setPresence.mutate(presence === 'offline' ? 'available' : 'offline');
  }, [presence, setPresence]);

  return {
    driver: driver.data,
    driverId,
    driverCode: driver.data?.driver_code,
    presence,
    isOnline: presence !== 'offline',
    isAvailable: presence === 'available',
    isLoading: driver.isLoading,
    error: driver.error,
    setPresence: setPresence.mutate,
    toggleOnline,
    isUpdating: setPresence.isPending,
  };
}
