import { Bus, CalendarCheck, Car, Info, ShoppingBag, type LucideIcon } from 'lucide-react';

import { env } from '@shared/config/env';

/**
 * The navigation model.
 *
 * Header, footer and the home service cards all read from this one array, so a
 * new module is added in a single place and appears everywhere consistently.
 * Duplicating the list is how a footer ends up linking to something the header
 * has already dropped.
 *
 * ── `href` vs `to` ─────────────────────────────────────────────────────────
 * Taxi is a separate deployment, so it needs a full page navigation. School
 * Runs and Bookings are routes inside this app and must use the router or the
 * SPA reloads on every click. The distinction is encoded in the data rather
 * than decided by each consumer, because getting it wrong is invisible in
 * development — where everything is on localhost — and obvious in production.
 */

export interface ServiceLink {
  id: 'taxi' | 'school-runs' | 'bookings' | 'marketplace';
  label: string;
  /** Internal router path. Mutually exclusive with `href`. */
  to?: string;
  /** External URL, opened as a full navigation. */
  href?: string;
  /** Phase 2 or otherwise not yet live. Renders locked, never links. */
  comingSoon?: boolean;
  icon: LucideIcon;
  tagline: string;
  description: string;
  cta: string;
}

export const SERVICES: readonly ServiceLink[] = [
  {
    id: 'taxi',
    label: 'Taxi',
    /* `to`, not `href`.
       While the taxi app was a separate deployment this had to be an <a> —
       a full page load to another origin. It is a route in this application
       now, so a <Link> is correct: pressing Taxi transitions straight into
       the product with no reload, no white flash and no second bundle
       download. Leaving it as `href` would still "work", which is exactly
       why it is worth stating: it would silently keep the old two-app feel
       after the two apps had already been merged. */
    to: env.services.taxi,
    icon: Car,
    tagline: 'Airport transfers and private hire',
    description:
      'Book in seconds, watch your driver approach, and pay in the app. The fare is agreed before you confirm.',
    cta: 'Book a taxi',
  },
  {
    id: 'school-runs',
    label: 'School Runs',
    to: env.services.schoolRuns,
    icon: Bus,
    tagline: 'Council contracts and daily routes',
    description:
      'Parents see the assigned driver and live trip status. Councils and schools get one dashboard for every route.',
    cta: 'Open the portal',
  },
  {
    id: 'bookings',
    label: 'Bookings',
    to: env.services.bookings,
    icon: CalendarCheck,
    tagline: 'Restaurants, barbers, garages',
    description:
      'Book local businesses by name or code. If anything goes wrong, the control centre finishes it for you.',
    cta: 'Make a booking',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    ...(env.services.marketplace ? { href: env.services.marketplace } : { comingSoon: true }),
    icon: ShoppingBag,
    tagline: 'Food, shops and delivery',
    description:
      'Restaurants, grocery, halal meat and community delivery, all in one place.',
    cta: 'Coming soon',
  },
] as const;

/** Header navigation: the four services, then About Us. */
export interface NavEntry {
  label: string;
  to?: string;
  href?: string;
  comingSoon?: boolean;
  icon?: LucideIcon;
  /** Present when this entry opens a submenu rather than navigating. */
  children?: readonly NavEntry[];
}

/**
 * Header navigation.
 *
 * ── Why Taxi and School Runs sit under Transport ───────────────────────────
 * They are two ways of buying the same thing: a licensed driver and a vehicle.
 * Listing them beside Bookings and Marketplace put four items at the same
 * level that are not the same kind of thing, and it grows worse as the group
 * fills out — Transport will hold at least a third service. One heading keeps
 * the top level short, which matters most on a phone where every extra item is
 * another row of the menu.
 */
export const HEADER_NAV: readonly NavEntry[] = [
  {
    label: 'Transport',
    icon: Car,
    children: [
      {
        label: 'Taxi',
        to: env.services.taxi,
        icon: Car,
      },
      {
        label: 'School Runs',
        to: env.services.schoolRuns,
        icon: Bus,
      },
    ],
  },
  ...SERVICES.filter((s) => s.id !== 'taxi' && s.id !== 'school-runs').map((service) => ({
    label: service.label,
    ...(service.to ? { to: service.to } : {}),
    ...(service.href ? { href: service.href } : {}),
    ...(service.comingSoon ? { comingSoon: true } : {}),
    icon: service.icon,
  })),
  { label: 'About Us', to: '/about', icon: Info },
];

export const LEGAL_NAV = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Cookies', to: '/cookies' },
] as const;
