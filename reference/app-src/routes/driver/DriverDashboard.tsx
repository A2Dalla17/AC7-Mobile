import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronRight, Clock, Crosshair, Menu, Moon, Star, Sun, TrendingUp, Wallet,
} from 'lucide-react';

import { driverRidesApi, geoApi } from '@shared/api';
import type { NearbyDriver } from '@shared/api/types';
import { MapView } from '@/components/map/MapView';
import { IconButton } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import {
  useAvailableRides,
  useDriverEarnings,
  useDriverStatus,
  useSetDriverStatus,
} from '@shared/hooks/queries';
import { useGeolocation } from '@shared/hooks/useGeolocation';
import { env } from '@shared/config/env';
import { ApiError } from '@shared/lib/http';
import { cn, formatCurrency } from '@shared/lib/utils';
import { useTheme } from '@shared/providers/ThemeProvider';

import { RideRequestCard } from './components/RideRequestCard';
import { SlideToToggle } from './components/SlideToToggle';

/**
 * Driver dashboard.
 *
 * A driver looks at this screen between trips, often one-handed, often in
 * sunlight. So the two things that matter — what I earned today, and am I
 * online — are the two largest objects on it. Everything else is secondary
 * and styled to stay that way.
 *
 * While online the app pushes position to `POST /geo/location` on the interval
 * from `env.driverLocationPingMs`, and polls `/driver/rides/available`. Both
 * stop entirely when offline — continuous GPS is the largest battery cost in a
 * driver app, and running it while offline earns nothing.
 */
export function DriverDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggle } = useTheme();

  const { data: driver, isLoading: loadingStatus } = useDriverStatus();
  const setStatus = useSetDriverStatus();

  const online = driver?.is_available ?? false;

  const { position, heading } = useGeolocation({ watch: online });
  const { data: earnings, isLoading: loadingEarnings } = useDriverEarnings('day');
  const { data: availableRides } = useAvailableRides(online);

  const [accepting, setAccepting] = useState<string | null>(null);
  const [declined, setDeclined] = useState<Set<string>>(new Set());

  /* -- Push location while online -----------------------------------------
   *
   * The interval is the whole point of this effect: a driver's position goes
   * to the server every env.driverLocationPingMs, and no faster.
   *
   * That is why position and heading are read through a ref instead of being
   * dependencies. useGeolocation runs `watchPosition`, which produces a new
   * object on every GPS update — so listing it here tore the effect down and
   * rebuilt it on each fix, and the rebuild calls push() immediately. The
   * interval never got to run: the app pushed on every GPS update instead of
   * every few seconds, and driverLocationPingMs did nothing at all. On a
   * moving vehicle that is a request per second per driver, all day.
   *
   * Depending only on `online` means the timer is created when the driver
   * goes online and destroyed when they go offline, which is what it is for.
   */
  const fixRef = useRef({ position, heading });
  fixRef.current = { position, heading };

  useEffect(() => {
    if (!online) return;

    let cancelled = false;

    const push = () => {
      if (cancelled) return;
      const fix = fixRef.current;
      /* No fix yet — skip this tick rather than abandoning the timer. The
         driver may still be waiting on their first GPS lock, and the next
         tick will have it. */
      if (!fix.position) return;

      geoApi
        .pushLocation({ ...fix.position, heading: fix.heading ?? undefined })
        .catch(() => {
          // A dropped ping is not worth interrupting the driver over; the next
          // one succeeds. Persistent failure surfaces via the ride list.
        });
    };

    push();
    const timer = setInterval(push, env.driverLocationPingMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [online]);

  /* -- Actions ------------------------------------------------------------ */

  async function handleToggle(next: boolean) {
    try {
      await setStatus.mutateAsync(next);
      toast.success(
        next ? "You're online" : "You're offline",
        next ? 'Looking for rides nearby.' : undefined,
      );
    } catch (error) {
      toast.error(
        'Could not change your status',
        error instanceof ApiError ? error.userMessage : 'Please try again.',
      );
    }
  }

  async function handleAccept(rideId: string) {
    setAccepting(rideId);
    try {
      await driverRidesApi.accept(rideId);
      navigate(`/driver/trip/${rideId}`);
    } catch (error) {
      toast.error(
        'Could not accept',
        error instanceof ApiError
          ? error.status === 409
            ? 'Another driver took this ride.'
            : error.userMessage
          : 'Please try again.',
      );
    } finally {
      setAccepting(null);
    }
  }

  const pending = (availableRides ?? []).filter((ride) => !declined.has(ride.id));
  const nextRide = pending[0];

  const selfMarker: NearbyDriver[] = position
    ? [
        {
          driver_id: driver?.id ?? 'me',
          latitude: position.lat,
          longitude: position.lng,
          heading: heading ?? 0,
        },
      ]
    : [];

  return (
    <div className="min-h-full bg-surface pb-[calc(7rem+var(--safe-bottom))]">
      {/* ---- Header ---------------------------------------------------- */}
      <header className="flex items-center justify-between px-5 pb-1 pt-[calc(0.75rem+var(--safe-top))]">
        <IconButton label="Open menu">
          <Menu size={20} />
        </IconButton>

        <div className="text-center">
          <p className="text-body-lg font-extrabold leading-none tracking-[-0.035em] text-ink">
            AC7 <span className="text-brand-ink">DRIVE</span>
          </p>
          <p
            className={cn(
              'mt-1 flex items-center justify-center gap-1.5 text-[0.5625rem] font-semibold uppercase tracking-[0.22em]',
              online ? 'text-success-ink' : 'text-ink-subtle',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                online ? 'bg-success' : 'bg-ink-subtle',
              )}
            />
            {online ? 'Online' : 'Offline'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </IconButton>

          <IconButton label="Notifications" className="relative">
            <Bell size={19} />
            {pending.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-brand px-1 text-[0.625rem] font-bold leading-none text-white ring-[2.5px] ring-surface">
                {pending.length}
              </span>
            )}
          </IconButton>
        </div>
      </header>

      <div className="stagger">
        {/* ---- Earnings hero ------------------------------------------- */}
        <section className="px-5 pt-6">
          {loadingEarnings ? (
            <Skeleton className="h-[11.5rem] rounded-[1.5rem]" />
          ) : (
            <div className="edge-light relative overflow-hidden rounded-[1.5rem] brand-gradient px-6 pb-14 pt-6 shadow-brand-lg">
              {/* Faint road arc — the one decorative element */}
              <svg
                aria-hidden
                viewBox="0 0 420 220"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
                preserveAspectRatio="xMaxYMax slice"
              >
                <path
                  d="M-40 190 Q 130 120 230 158 T 460 88"
                  fill="none"
                  stroke="white"
                  strokeWidth="26"
                  strokeLinecap="round"
                />
              </svg>

              <div className="relative">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-white/60">
                  Today's earnings
                </p>
                <p className="tabular mt-2 text-[2.375rem] font-bold leading-none tracking-[-0.04em] text-white">
                  {formatCurrency(earnings?.total_earnings ?? 0, earnings?.currency_code)}
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/driver/earnings')}
                  className="pressable mt-4 inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3.5 py-1.5 text-micro font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  <TrendingUp size={13} aria-hidden />
                  Earnings breakdown
                  <ChevronRight size={13} aria-hidden />
                </button>
              </div>
            </div>
          )}

          {/* Stat strip, overlapping the hero */}
          {!loadingEarnings && (
            <div className="edge-light relative -mt-10 grid grid-cols-3 divide-x divide-line rounded-[1.25rem] border border-line bg-card py-4 shadow-lifted">
              <Stat value={String(earnings?.total_rides ?? 0)} label="Trips" />
              <Stat value={formatOnline(earnings?.online_seconds)} label="Online" />
              <Stat value={driver?.rating ? driver.rating.toFixed(2) : '—'} label="Rating" />
            </div>
          )}
        </section>

        {/* ---- Online toggle ------------------------------------------- */}
        <section className="mt-5 px-5">
          {loadingStatus ? (
            <Skeleton className="h-16 rounded-pill" />
          ) : (
            <SlideToToggle
              online={online}
              onToggle={(next) => void handleToggle(next)}
              busy={setStatus.isPending}
            />
          )}
        </section>

        {/* ---- Map ------------------------------------------------------ */}
        <section className="mt-5 px-5">
          <div className="edge-light relative h-60 overflow-hidden rounded-[1.25rem] border border-line shadow-card">
            <MapView
              center={position ?? undefined}
              drivers={selfMarker}
              halo={online}
              fitBounds={false}
              minimal
              zoom={15}
              className="absolute inset-0"
            />

            {/* Status pill floating over the map */}
            <div className="pointer-events-none absolute left-3 top-3 z-[500]">
              <span
                className={cn(
                  'glass inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[0.6875rem] font-semibold',
                  online ? 'text-success-ink' : 'text-ink-muted',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    online ? 'animate-pulse bg-success' : 'bg-ink-subtle',
                  )}
                />
                {online ? 'Visible to riders' : 'Hidden'}
              </span>
            </div>

            <IconButton
              label="Centre on my location"
              tone="glass"
              className="absolute bottom-3 right-3 z-[500]"
            >
              <Crosshair size={18} />
            </IconButton>
          </div>
        </section>

        {/* ---- Incoming request ---------------------------------------- */}
        <section className="mt-7 px-5">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-body-lg font-bold tracking-[-0.02em] text-ink">
              {online && nextRide ? 'Incoming request' : 'Upcoming ride'}
            </h2>
            {pending.length > 1 && (
              <button
                type="button"
                onClick={() => navigate('/driver/requests')}
                className="pressable text-caption font-semibold text-brand-ink"
              >
                View all {pending.length}
              </button>
            )}
          </div>

          {!online ? (
            <div className="rounded-card border border-line bg-card">
              <EmptyState
                icon={<Clock size={22} />}
                title="You're offline"
                description="Slide the control above to go online and start receiving ride requests."
              />
            </div>
          ) : !nextRide ? (
            <div className="rounded-card border border-line bg-card">
              <EmptyState
                icon={<Clock size={22} />}
                title="Waiting for requests"
                description="You're online and visible to riders nearby. Requests will appear here."
              />
            </div>
          ) : (
            <RideRequestCard
              ride={nextRide}
              distanceKm={nextRide.estimated_distance}
              etaMinutes={nextRide.estimated_duration}
              accepting={accepting === nextRide.id}
              onAccept={() => void handleAccept(nextRide.id)}
              onDecline={() => setDeclined((prev) => new Set(prev).add(nextRide.id))}
            />
          )}
        </section>

        {/* ---- Shortcuts ------------------------------------------------ */}
        <section className="mt-7 px-5">
          <h2 className="mb-3 text-body-lg font-bold tracking-[-0.02em] text-ink">
            Quick access
          </h2>

          <div className="grid grid-cols-4 gap-2.5">
            <Shortcut
              icon={<Wallet size={19} />}
              label="Wallet"
              onClick={() => navigate('/driver/wallet')}
            />
            <Shortcut
              icon={<TripIcon />}
              label="Trips"
              onClick={() => navigate('/driver/trips')}
            />
            <Shortcut
              icon={<TrendingUp size={19} />}
              label="Earnings"
              onClick={() => navigate('/driver/earnings')}
            />
            <Shortcut
              icon={<Star size={19} />}
              label="Profile"
              onClick={() => navigate('/driver/profile')}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 text-center">
      <p className="tabular truncate text-body-lg font-bold tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
    </div>
  );
}

function Shortcut({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="liftable group flex flex-col items-center gap-2 rounded-[1.125rem] border border-line bg-card px-2 py-4"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink transition-transform duration-300 ease-smooth group-hover:scale-110"
      >
        {icon}
      </span>
      <span className="text-[0.6875rem] font-semibold text-ink">{label}</span>
    </button>
  );
}

function TripIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Seconds → "4h 32m". */
function formatOnline(seconds: number | undefined): string {
  if (!seconds) return '0h 00m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
