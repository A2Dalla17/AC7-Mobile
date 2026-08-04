import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Car, Home, LayoutGrid, User } from 'lucide-react';

import { Spinner } from '@shared/components/ui/Spinner';
import { ToastProvider } from '@shared/components/ui/Toast';
import { cn } from '@shared/lib/utils';

import { HomePage } from './HomePage';

const BookRidePage = lazy(() =>
  import('./BookRidePage').then((m) => ({ default: m.BookRidePage })),
);
const TrackRidePage = lazy(() =>
  import('./TrackRidePage').then((m) => ({ default: m.TrackRidePage })),
);
const TripsPage = lazy(() => import('./TripsPage').then((m) => ({ default: m.TripsPage })));
const WalletPage = lazy(() => import('./WalletPage').then((m) => ({ default: m.WalletPage })));
const ProfilePage = lazy(() => import('./ProfilePage').then((m) => ({ default: m.ProfilePage })));
const NotificationsPage = lazy(() =>
  import('./NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const FavouritesPage = lazy(() =>
  import('./FavouritesPage').then((m) => ({ default: m.FavouritesPage })),
);
const SafetyPage = lazy(() => import('./SafetyPage').then((m) => ({ default: m.SafetyPage })));
const SupportPage = lazy(() => import('./SupportPage').then((m) => ({ default: m.SupportPage })));
const ReferPage = lazy(() =>
  import('../shared/ReferPage').then((m) => ({ default: m.ReferPage })),
);
const RidesPage = lazy(() => import('./RidesPage').then((m) => ({ default: m.RidesPage })));
const ServicePage = lazy(() => import('./ServicePage').then((m) => ({ default: m.ServicePage })));
const RiderSettingsPage = lazy(() =>
  import('./SettingsPage').then((m) => ({ default: m.RiderSettingsPage })),
);
const MessagesPage = lazy(() =>
  import('../shared/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);
const ChatThreadPage = lazy(() =>
  import('../shared/ChatThreadPage').then((m) => ({ default: m.ChatThreadPage })),
);

/** Left of the centre action, then right — matching the mockup's tab order. */
const LEFT_TABS = [
  { to: '/rider', label: 'Home', icon: Home, end: true },
  { to: '/rider/rides', label: 'Rides', icon: Car, end: false },
] as const;

const RIGHT_TABS = [
  { to: '/rider/service', label: 'Service', icon: LayoutGrid, end: false },
  { to: '/rider/profile', label: 'Profile', icon: User, end: false },
] as const;

/**
 * Rider shell.
 *
 * Bottom tab bar with a raised centre action, as in the mockup. The bar hides
 * on the booking and tracking screens, which are full-bleed map experiences
 * where a floating bar would sit on top of the sheet.
 */
export function RiderLayout() {
  const location = useLocation();

  const immersive =
    location.pathname.startsWith('/rider/book') || location.pathname.startsWith('/rider/track');

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
              <Route index element={<HomePage />} />
              <Route path="book" element={<BookRidePage />} />
              <Route path="track/:rideId" element={<TrackRidePage />} />
              <Route path="rides" element={<RidesPage />} />
              <Route path="settings" element={<RiderSettingsPage />} />
              <Route path="service" element={<ServicePage />} />
              <Route path="trips" element={<TripsPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="favourites" element={<FavouritesPage />} />
              <Route path="safety" element={<SafetyPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="refer" element={<ReferPage />} />
              <Route path="messages" element={<MessagesPage />} />
              {/* "new" is not a thread id — it carries ?driver=AC7xxxxx and the
                  page resolves it into a real thread on arrival. */}
              <Route path="chat/new" element={<ChatThreadPage />} />
              <Route path="chat/:threadId" element={<ChatThreadPage />} />
              <Route path="*" element={<Navigate to="/rider" replace />} />
            </Routes>
          </Suspense>
        </main>

        {!immersive && <RiderTabBar />}
      </div>
    </ToastProvider>
  );
}

/**
 * The rider tab bar.
 *
 * ── Solid, full width, brand red ───────────────────────────────────────────
 * This was a translucent pill floating with a margin on every side. Over a
 * map that meant tiles showing through the bar AND around it, so the
 * navigation never looked like part of the app — it looked like something
 * resting on top of a map, and the map's own attribution ("Leaflet ©
 * OpenStreetMap © CARTO") read through the gap underneath it.
 *
 * A navigation bar is chrome, not content. It is now opaque, brand red, and
 * anchored to the bottom edge with nothing behind or beside it. That also
 * makes it identical in light and dark themes, which is correct: the brand
 * does not change colour because the rider's phone did.
 *
 * ── Why the centre action inverts ──────────────────────────────────────────
 * Book ride used to be a red circle. On a red bar it would vanish. It is now
 * white with a red car, which is both the highest contrast available here and
 * the standard treatment for a primary action sitting on a brand-filled
 * surface.
 */
function RiderTabBar() {
  return (
    <nav
      aria-label="Main"
      /* No margin, no rounding at the sides: the bar meets the screen edges so
         nothing of the map can appear beside it. The safe-area padding is
         INSIDE the coloured element, so the red runs all the way down through
         the home indicator rather than stopping short and leaving a stripe. */
      className="brand-gradient fixed inset-x-0 bottom-0 z-40 pb-[var(--safe-bottom)] shadow-lifted"
    >
      <div className="flex items-end justify-around px-2 pb-2 pt-2.5">
        {LEFT_TABS.map((tab) => (
          <Tab key={tab.to} {...tab} />
        ))}

        {/* Centre action — raised, and inverted so it reads on the red. */}
        <NavLink
          to="/rider/book"
          className="pressable -mt-6 flex flex-col items-center gap-1"
          aria-label="Book a ride"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand-700 shadow-lifted ring-4 ring-white/25">
            <Car size={21} aria-hidden />
          </span>
          <span className="text-[0.625rem] font-semibold text-white">Book ride</span>
        </NavLink>

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
  icon: typeof Home;
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
          /* Everything on this bar is white now, because the bar is brand red.
             The unselected state is dimmed white rather than a grey token —
             a theme grey chosen to sit on the page background has nothing to
             do with legibility on a saturated red, and read as muddy. */
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
                /* The active underline was brand red, which is now the colour
                   of the bar it sits on — invisible. White. */
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
