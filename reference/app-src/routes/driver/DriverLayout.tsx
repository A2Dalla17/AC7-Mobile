import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { CalendarClock, Car, Home, Power, Trophy, User } from 'lucide-react';

import { Spinner } from '@shared/components/ui/Spinner';
import { ToastProvider } from '@shared/components/ui/Toast';
import { useDriverPresence } from '@shared/hooks/useDriverPresence';
import { cn } from '@shared/lib/utils';

import { DriverDashboard } from './DriverDashboard';

const EarningsPage = lazy(() =>
  import('./EarningsPage').then((m) => ({ default: m.EarningsPage })),
);
const DriverTripsPage = lazy(() =>
  import('./TripsPage').then((m) => ({ default: m.DriverTripsPage })),
);
const DriverWalletPage = lazy(() =>
  import('./WalletPage').then((m) => ({ default: m.DriverWalletPage })),
);
const DriverProfilePage = lazy(() =>
  import('./ProfilePage').then((m) => ({ default: m.DriverProfilePage })),
);
const ReferPage = lazy(() =>
  import('../shared/ReferPage').then((m) => ({ default: m.ReferPage })),
);
const DriverActiveTripPage = lazy(() =>
  import('./ActiveTripPage').then((m) => ({ default: m.DriverActiveTripPage })),
);
const DriverRankPage = lazy(() => import('./RankPage').then((m) => ({ default: m.DriverRankPage })));
const DriverShiftsPage = lazy(() =>
  import('./ShiftsPage').then((m) => ({ default: m.DriverShiftsPage })),
);
const ApplicationPage = lazy(() =>
  import('./ApplicationPage').then((m) => ({ default: m.ApplicationPage })),
);
const MessagesPage = lazy(() =>
  import('../shared/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);
const ChatThreadPage = lazy(() =>
  import('../shared/ChatThreadPage').then((m) => ({ default: m.ChatThreadPage })),
);

const LEFT_TABS = [
  { to: '/driver', label: 'Home', icon: Home, end: true },
  { to: '/driver/shifts', label: 'Shifts', icon: CalendarClock, end: false },
] as const;

const RIGHT_TABS = [
  { to: '/driver/rank', label: 'Rank', icon: Trophy, end: false },
  { to: '/driver/profile', label: 'Profile', icon: User, end: false },
] as const;

/**
 * Driver shell.
 *
 * The centre action is the online toggle, as in the mockup — it is the control
 * a driver reaches for most, and putting it in the thumb's natural arc matters
 * when the phone is mounted on a dashboard.
 */
export function DriverLayout() {
  return (
    <ToastProvider>
      <div className="relative flex min-h-screen flex-col bg-surface">
        <main className="flex-1">
          <Suspense
            fallback={
              <div className="grid min-h-[70vh] place-items-center">
                <Spinner size="lg" className="text-brand-ink" />
              </div>
            }
          >
            <Routes>
              <Route index element={<DriverDashboard />} />
              <Route path="earnings" element={<EarningsPage />} />
              <Route path="trips" element={<DriverTripsPage />} />
              <Route path="wallet" element={<DriverWalletPage />} />
              <Route path="profile" element={<DriverProfilePage />} />
              <Route path="application" element={<ApplicationPage />} />
              <Route path="trip/:rideId" element={<DriverActiveTripPage />} />
              <Route path="rank" element={<DriverRankPage />} />
              <Route path="shifts" element={<DriverShiftsPage />} />
              <Route path="refer" element={<ReferPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="chat/:threadId" element={<ChatThreadPage />} />
              <Route path="*" element={<Navigate to="/driver" replace />} />
            </Routes>
          </Suspense>
        </main>

        <DriverTabBar />
      </div>
    </ToastProvider>
  );
}

function DriverTabBar() {
  /* Presence comes from the database now, not from the preview fixtures.
     The hook is optimistic and also listens for server-side changes, so
     accepting a job (which moves the driver to on_trip) is reflected here
     without the driver touching anything. */
  const { isOnline, toggleOnline, isUpdating } = useDriverPresence();
  const online = isOnline;

  return (
    /* Solid brand red, full width — see the note on the rider bar. Kept
       identical here on purpose: a driver who also rides should not meet two
       different navigation bars in what is one application. */
    <nav
      aria-label="Main"
      className="brand-gradient fixed inset-x-0 bottom-0 z-40 pb-[var(--safe-bottom)] shadow-lifted"
    >
      <div className="flex items-end justify-around px-2 pb-2 pt-2.5">
        {LEFT_TABS.map((tab) => (
          <Tab key={tab.to} {...tab} />
        ))}

        <button
          type="button"
          onClick={toggleOnline}
          disabled={isUpdating}
          aria-pressed={online}
          className="pressable -mt-7 flex flex-col items-center gap-1"
        >
          {/*
            Online and offline must be distinguishable at a glance, from a
            windscreen mount, in daylight — this is the control a driver's
            earnings depend on.

            Both states used to sit on the page background, so red-versus-grey
            carried the meaning. On a red bar that is gone, so the states now
            differ in FILL as well as colour: solid white when online, hollow
            when not. That reads correctly even to a driver who cannot
            distinguish the two colours.
          */}
          <span
            className={cn(
              'grid h-14 w-14 place-items-center rounded-full ring-4 transition-colors',
              online
                ? 'bg-white text-brand-700 ring-white/30'
                : 'border-2 border-white/50 bg-brand-900/40 text-white/80 ring-transparent',
            )}
          >
            <Power size={22} aria-hidden />
          </span>
          <span className="text-[0.625rem] font-semibold text-white">
            {online ? 'Go offline' : 'Go online'}
          </span>
        </button>

        {RIGHT_TABS.map((tab) => (
          <Tab key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  );
}

function Tab({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof Car;
  end: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-w-[3.75rem] flex-col items-center gap-1 rounded-tile px-2 py-1.5',
          'transition-colors duration-200',
          /* White on the red bar — a theme grey picked for the page
             background is not legible on saturated red. */
          isActive ? 'text-white' : 'text-white/65 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon size={21} aria-hidden strokeWidth={isActive ? 2.4 : 1.9} />
            <span
              aria-hidden
              className={cn(
                /* White, not bg-brand — brand red is now the colour of the bar
                   this sits on, so it was drawing red on red. */
                'absolute -bottom-[0.3125rem] left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-white transition-all duration-300 ease-smooth',
                isActive ? 'w-3.5 opacity-100' : 'w-0 opacity-0',
              )}
            />
          </span>
          <span className="text-[0.625rem] font-semibold tracking-[0.01em]">{label}</span>
        </>
      )}
    </NavLink>
  );
}
