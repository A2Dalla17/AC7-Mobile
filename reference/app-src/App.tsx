/**
 * AC7 Taxi — the application's route table
 *
 * This is the product: rider, driver and control centre. It is what ships to
 * Google Play and the App Store.
 *
 * ── What is deliberately NOT here ─────────────────────────────────────────
 * There is no home page, no about, no pricing, no terms. The website lives in
 * packages/landing and this package does not depend on it — so marketing
 * pages cannot end up inside a mobile binary, which is the entire reason the
 * two were separated.
 *
 * That is enforced by the dependency graph, not by discipline. Adding a
 * marketing page here would mean adding @ac7/landing as a dependency of the
 * app, which nobody does by accident.
 *
 * ── Why the app opens on sign-in ──────────────────────────────────────────
 * A native app has no marketing front door: the App Store listing is the
 * marketing. Someone who has installed this has already decided. So "/" is
 * the way in, resolving to the signed-in user's home or to sign-in.
 *
 * ── Routes ────────────────────────────────────────────────────────────────
 *   /                  entry — role home, or sign-in
 *   /login /register /forgot-password /two-factor
 *   /onboarding        phone number and messaging consent
 *   /rider/*           rider application
 *   /driver/*          driver application
 *   /admin/*           control centre
 *   /d/:code           driver code lookup — public on purpose
 */

import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import type { UserRole } from '@shared/api/types';
import { FullPageSpinner } from '@shared/components/ui/Spinner';
import { applyPreferences, usePreferences } from '@shared/lib/preferences';
import { useAuth } from '@shared/providers/AuthProvider';

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

const LoginPage = lazy(() =>
  import('@/routes/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/routes/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/routes/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const TwoFactorPage = lazy(() =>
  import('@/routes/auth/TwoFactorPage').then((m) => ({ default: m.TwoFactorPage })),
);
const OnboardingPage = lazy(() =>
  import('@/routes/taxi/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);

/* -------------------------------------------------------------------------- */
/* Modules                                                                    */
/* -------------------------------------------------------------------------- */

const RiderLayout = lazy(() =>
  import('@/routes/rider/RiderLayout').then((m) => ({ default: m.RiderLayout })),
);
const DriverLayout = lazy(() =>
  import('@/routes/driver/DriverLayout').then((m) => ({ default: m.DriverLayout })),
);
const AdminLayout = lazy(() =>
  import('@/routes/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const AdminSignInPage = lazy(() =>
  import('@/routes/admin/adverts/SignInPage').then((m) => ({ default: m.SignInPage })),
);

const DriverLookupPage = lazy(() =>
  import('@/routes/DriverLookupPage').then((m) => ({ default: m.DriverLookupPage })),
);
const CardsPage = lazy(() =>
  import('@/routes/CardsPage').then((m) => ({ default: m.CardsPage })),
);
const NotFoundPage = lazy(() =>
  import('@/routes/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

/* -------------------------------------------------------------------------- */
/* Guards                                                                     */
/* -------------------------------------------------------------------------- */

/** Where each role lands after signing in. */
const HOME_FOR_ROLE: Record<UserRole, string> = {
  rider: '/rider',
  driver: '/driver',
  admin: '/admin',
};

/**
 * The way in.
 *
 * Waiting for the session matters — redirecting early bounces a signed-in
 * driver back to sign-in on every hard refresh, and on a phone that is every
 * time the OS reclaims memory.
 */
function Entry() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return <FullPageSpinner label="Loading" />;
  if (isAuthenticated && role) return <Navigate to={HOME_FOR_ROLE[role]} replace />;
  return <Navigate to="/login" replace />;
}

function RequireAuth({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner label="Signing you in" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (role && !allow.includes(role)) {
    return <Navigate to={HOME_FOR_ROLE[role]} replace />;
  }
  return <>{children}</>;
}

/** Sends an already-signed-in user away from sign-in and register. */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return <FullPageSpinner label="Loading" />;
  if (isAuthenticated && role) return <Navigate to={HOME_FOR_ROLE[role]} replace />;
  return <>{children}</>;
}

/* -------------------------------------------------------------------------- */

export function App() {
  const { preferences } = usePreferences();

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Entry />} />

        {/* ---------------- Authentication ---------------- */}
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthed>
              <RegisterPage />
            </RedirectIfAuthed>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/two-factor" element={<TwoFactorPage />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth allow={['rider', 'driver', 'admin']}>
              <OnboardingPage />
            </RequireAuth>
          }
        />

        {/* ---------------- Modules ---------------- */}
        <Route
          path="/rider/*"
          element={
            <RequireAuth allow={['rider', 'driver', 'admin']}>
              <RiderLayout />
            </RequireAuth>
          }
        />
        <Route
          path="/driver/*"
          element={
            <RequireAuth allow={['driver', 'admin']}>
              <DriverLayout />
            </RequireAuth>
          }
        />

        <Route path="/admin/signin" element={<AdminSignInPage />} />
        <Route
          path="/admin/*"
          element={
            <RequireAuth allow={['admin']}>
              <AdminLayout />
            </RequireAuth>
          }
        />

        {/* Driver code lookup — public on purpose. Someone deciding whether to
            get into a car cannot be asked to register first; that would defeat
            the point of the check. */}
        <Route path="/d" element={<DriverLookupPage />} />
        <Route path="/d/:code" element={<DriverLookupPage />} />

        {/* Printable street cards. Public: whoever prints them is not
            necessarily signed in, and the page holds nothing private. */}
        <Route path="/cards" element={<CardsPage />} />

        {/* ---------------- Old web paths ----------------
            The app used to live under /taxi/* when it shared a router with the
            website. Anything already bookmarked, printed on a card or sent in
            a message still resolves rather than 404ing. */}
        <Route path="/taxi" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/register" replace />} />
        <Route path="/onboarding" element={<Navigate to="/onboarding" replace />} />
        <Route path="/rider/*" element={<RedirectPreserving to="/rider" from="/rider" />} />
        <Route path="/driver/*" element={<RedirectPreserving to="/driver" from="/driver" />} />
        <Route path="/d/:code" element={<RedirectPreserving to="/d" from="/taxi/d" />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Redirect a whole subtree, keeping the rest of the path.
 *
 * A plain <Navigate to="/rider"> would send every old deep link to the rider
 * home, so a bookmarked trip or a link to a wallet page would silently land
 * somewhere else. This keeps the tail, so /rider/wallet becomes
 * /rider/wallet rather than /rider.
 */
function RedirectPreserving({ to, from }: { to: string; from: string }) {
  const { pathname, search } = useLocation();
  const tail = pathname.slice(from.length);
  return <Navigate to={`${to}${tail}${search}`} replace />;
}
