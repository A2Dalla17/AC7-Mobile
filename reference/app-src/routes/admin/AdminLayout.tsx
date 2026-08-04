import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  BarChart3, Bell, Car, CreditCard, FileText, LayoutDashboard, LifeBuoy, LogOut,
  Megaphone, Menu, Moon, Rocket, Route as RouteIcon, Settings, ShieldCheck, Sun, Tag, Users, Wallet, X,
} from 'lucide-react';

import { Avatar } from '@shared/components/ui/Avatar';
import { IconButton } from '@shared/components/ui/Button';
import { Spinner } from '@shared/components/ui/Spinner';
import { ToastProvider } from '@shared/components/ui/Toast';
import { cn, fullName, initials } from '@shared/lib/utils';
import { useAuth } from '@shared/providers/AuthProvider';
import { useTheme } from '@shared/providers/ThemeProvider';
import { useRealtimeStatus } from '@shared/hooks/useRealtime';

import { DashboardPage } from './DashboardPage';

const AnalyticsPage = lazy(() => import('./AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const UsersPage = lazy(() => import('./UsersPage').then((m) => ({ default: m.UsersPage })));
const DriversPage = lazy(() => import('./DriversPage').then((m) => ({ default: m.DriversPage })));
const TripsPage = lazy(() => import('./TripsPage').then((m) => ({ default: m.TripsPage })));
const PaymentsPage = lazy(() => import('./PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const SettingsPage = lazy(() => import('./SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ReleasesPage = lazy(() => import('./ReleasesPage').then((m) => ({ default: m.ReleasesPage })));
const AdvertsManagerPage = lazy(() =>
  import('./AdvertsManagerPage').then((m) => ({ default: m.AdvertsManagerPage })),
);
const DriverDossierPage = lazy(() =>
  import('./DriverDossierPage').then((m) => ({ default: m.DriverDossierPage })),
);

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV_GROUPS: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/drivers', label: 'Drivers', icon: Car },
      { to: '/admin/trips', label: 'Trips', icon: RouteIcon },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
      { to: '/admin/wallet', label: 'Wallet', icon: Wallet },
      { to: '/admin/coupons', label: 'Coupons', icon: Tag },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { to: '/admin/adverts', label: 'Advertising', icon: Megaphone },
      { to: '/admin/releases', label: 'Releases', icon: Rocket },
      { to: '/admin/reports', label: 'Reports', icon: FileText },
      { to: '/admin/support', label: 'Support', icon: LifeBuoy },
      { to: '/admin/roles', label: 'Roles', icon: ShieldCheck },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/**
 * Admin console shell.
 *
 * Desktop-first, unlike the rider and driver apps. This is used at a desk for
 * long sessions, so density beats touch comfort — the inverse of the mobile
 * priorities. Below `lg` the sidebar becomes a drawer.
 */
export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on navigation — otherwise it covers the page you just
  // asked for on mobile.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface">
        <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <div className="lg:pl-64">
          <TopBar onMenu={() => setDrawerOpen(true)} />

          <main className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
            <Suspense
              fallback={
                <div className="grid min-h-[50vh] place-items-center">
                  <Spinner size="lg" className="text-brand-ink" />
                </div>
              }
            >
              <Routes>
                <Route index element={<DashboardPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="drivers" element={<DriverDossierPage />} />
                <Route path="drivers/legacy" element={<DriversPage />} />
                <Route path="trips" element={<TripsPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="adverts" element={<AdvertsManagerPage />} />
                <Route path="releases" element={<ReleasesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

/* -------------------------------------------------------------------------- */

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 animate-fade-in bg-ink/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        aria-label="Restricted area navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-bg',
          'transition-transform duration-300 ease-smooth',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <NavLink to="/admin" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg brand-gradient text-sm font-bold text-white"
            >
              A7
            </span>
            <span>
              <span className="block text-sm font-bold leading-tight tracking-tight text-ink">
                AC7 Ride
              </span>
              <span className="block text-[0.625rem] uppercase tracking-widest text-ink-muted">
                Admin
              </span>
            </span>
          </NavLink>

          <IconButton label="Close menu" size="sm" onClick={onClose} className="lg:hidden">
            <X size={17} />
          </IconButton>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="mb-5">
              <p className="mb-1.5 px-3 text-[0.625rem] font-semibold uppercase tracking-widest text-ink-subtle">
                {group.heading}
              </p>

              <ul className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-tile px-3 py-2 text-body-sm font-medium',
                          'transition-all duration-200 ease-smooth',
                          isActive
                            ? 'bg-brand-soft text-brand-ink'
                            : 'text-ink-muted hover:bg-card hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={18}
                            aria-hidden
                            strokeWidth={isActive ? 2.4 : 2}
                            className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                          />
                          {label}
                          {isActive && (
                            <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Account */}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-tile px-2 py-2">
            <Avatar initials={initials(user)} src={user?.profile_image} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-semibold text-ink">
                {fullName(user) || 'Administrator'}
              </p>
              <p className="truncate text-[0.6875rem] text-ink-muted">{user?.email}</p>
            </div>
            <IconButton label="Sign out" size="sm" onClick={logout}>
              <LogOut size={15} />
            </IconButton>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const status = useRealtimeStatus();

  const tone =
    status === 'open' ? 'bg-success' : status === 'reconnecting' ? 'bg-brand-300' : 'bg-ink-subtle';

  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 lg:px-8">
        <IconButton label="Open menu" onClick={onMenu} className="lg:hidden">
          <Menu size={19} />
        </IconButton>

        <div className="flex-1" />

        <span className="hidden items-center gap-2 rounded-pill border border-line px-3 py-1.5 text-xs text-ink-muted sm:flex">
          <span aria-hidden className={cn('h-2 w-2 rounded-full', tone)} />
          <span className="sr-only">Realtime connection:</span>
          {status}
        </span>

        <IconButton
          label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggle}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>

        <IconButton label="Notifications" className="relative">
          <Bell size={18} />
          <span
            aria-hidden
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand ring-2 ring-bg"
          />
        </IconButton>
      </div>
    </header>
  );
}
