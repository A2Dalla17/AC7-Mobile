/**
 * ACT — Service
 *
 * What else AC7 does, and where to read more.
 *
 * ── Why the website link opens in the same tab ─────────────────────────────
 * The landing site is part of this application, not a third party. Opening it
 * in a new tab would leave the rider with two tabs of the same product and no
 * back button that behaves the way they expect.
 */

import { Link } from 'react-router-dom';
import { Bus, CalendarCheck, ChevronRight, Globe, Lock, Phone, ShoppingBag } from 'lucide-react';

import { Card } from '@shared/components/ui/Card';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { env } from '@shared/config/env';

export function ServicePage() {
  return (
    <div className="pb-tabbar">
      <ScreenHeader title="Services" />

      <div className="space-y-4 px-gutter">
        {/* The website */}
        <Link to="/" className="block">
          <Card tone="flat" className="transition-colors hover:border-brand">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink"
              >
                <Globe size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-ink">Visit our website</p>
                <p className="mt-0.5 text-body-sm text-ink-muted">
                  Everything AC7 GROUP does, in one place.
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-ink-subtle" aria-hidden />
            </div>
          </Card>
        </Link>

        <div>
          <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wide text-ink-subtle">
            Other AC7 services
          </h2>

          <div className="space-y-3">
            <ServiceRow
              icon={<Bus size={20} />}
              title="School Runs"
              hint="Council contracts and daily routes, with the assigned driver shown to parents."
              to="/school-runs"
            />
            <ServiceRow
              icon={<CalendarCheck size={20} />}
              title="Bookings"
              hint="Restaurants, barbers and garages — booked by name or by code."
              to="/bookings"
            />
            <ServiceRow
              icon={<ShoppingBag size={20} />}
              title="AC7 Deliveries"
              hint="Food, shops and community delivery."
              locked
            />
          </div>
        </div>

        {/* Control room */}
        <Card tone="flat">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink"
            >
              <Phone size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-ink">AC7 Control Room</p>
              <p className="mt-0.5 text-body-sm text-ink-muted">
                Open 24 hours. A person answers, every time.
              </p>
            </div>
          </div>
          <a
            href={`tel:${env.controlCentre.tel}`}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-control border border-brand-ink/35 text-body font-semibold text-brand-ink transition-colors hover:bg-brand-soft"
          >
            <Phone size={16} aria-hidden />
            {env.controlCentre.display}
          </a>
        </Card>
      </div>
    </div>
  );
}

function ServiceRow({
  icon,
  title,
  hint,
  to,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  to?: string;
  locked?: boolean;
}) {
  const inner = (
    <Card tone="flat" className={locked ? 'opacity-70' : 'transition-colors hover:border-brand'}>
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-tile bg-surface text-ink-muted"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-body font-semibold text-ink">
            {title}
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-micro font-medium text-ink-subtle">
                <Lock size={10} aria-hidden />
                Coming soon
              </span>
            )}
          </p>
          <p className="mt-0.5 text-body-sm text-ink-muted">{hint}</p>
        </div>
        {!locked && <ChevronRight size={18} className="shrink-0 text-ink-subtle" aria-hidden />}
      </div>
    </Card>
  );

  /* Locked services are not links. A link that goes nowhere is worse than a
     label that says it is not ready — the first wastes a tap and looks broken,
     the second is simply true. */
  return locked ? inner : <Link to={to as string} className="block">{inner}</Link>;
}
