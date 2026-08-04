/**
 * ACT — Rides
 *
 * Upcoming and past, with scheduling.
 *
 * ── Why Upcoming leads ─────────────────────────────────────────────────────
 * Someone opening this tab almost always wants the trip that has not happened
 * yet — to check the time, or to cancel. Past trips are for receipts and
 * disputes, which is a rarer and less urgent errand. Upcoming is the default
 * tab and past is one tap away, rather than the reverse.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Clock, MapPin, Receipt } from 'lucide-react';

import { Card } from '@shared/components/ui/Card';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { cn } from '@shared/lib/utils';

type Tab = 'upcoming' | 'past';

export function RidesPage() {
  const [tab, setTab] = useState<Tab>('upcoming');

  /* Empty until the booking service is live. Kept as an explicit empty list
     rather than invented rows: fake trips in a real account are indefensible,
     and an honest empty state is the correct thing to show. */
  const upcoming = useMemo(() => [] as const, []);
  const past = useMemo(() => [] as const, []);

  const rides = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="pb-tabbar">
      <ScreenHeader title="Rides" />

      <div className="px-gutter">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Ride history"
          className="flex gap-1 rounded-control bg-surface p-1"
        >
          {(['upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'min-h-11 flex-1 rounded-control px-4 text-body-sm font-semibold capitalize transition-colors',
                tab === t ? 'bg-card text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Schedule */}
        <Card tone="flat" className="mt-4">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink"
            >
              <CalendarPlus size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-ink">Book ahead</p>
              <p className="mt-0.5 text-body-sm text-ink-muted">
                Airport runs, early starts, anything you would rather not leave to
                chance.
              </p>
            </div>
          </div>
          {/* A Link styled as a button, not a Link inside a Button — an <a>
              nested in a <button> is invalid HTML and browsers disagree about
              which one handles the click. */}
          <Link
            to="/rider/book?schedule=1"
            className="brand-gradient mt-4 flex h-12 w-full items-center justify-center rounded-control text-body font-semibold text-white shadow-brand transition-[filter] hover:brightness-[1.06]"
          >
            Schedule a ride
          </Link>
        </Card>

        {/* List */}
        {rides.length === 0 ? (
          <div className="mt-8 text-center">
            <span
              aria-hidden
              className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface text-ink-subtle"
            >
              {tab === 'upcoming' ? <Clock size={24} /> : <Receipt size={24} />}
            </span>
            <p className="mt-4 text-body font-medium text-ink">
              {tab === 'upcoming' ? 'Nothing booked yet' : 'No past rides'}
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-body-sm text-ink-muted">
              {tab === 'upcoming'
                ? 'When you book a ride it will appear here, with your driver and their arrival time.'
                : 'Your completed trips and receipts will be listed here.'}
            </p>
            {tab === 'upcoming' && (
              <Link
                to="/rider/book"
                className="brand-gradient mt-5 inline-flex h-12 items-center gap-2 rounded-control px-6 text-body font-semibold text-white shadow-brand transition-[filter] hover:brightness-[1.06]"
              >
                <MapPin size={16} aria-hidden />
                Book a ride
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Rendered once the booking service returns trips. */}
          </div>
        )}
      </div>
    </div>
  );
}
