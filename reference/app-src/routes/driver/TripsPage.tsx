import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Star, TrendingUp } from 'lucide-react';

import { earningsApi } from '@shared/api';
import type { EarningsEntry } from '@shared/api/types';
import { IconButton } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { cn, formatCurrency, formatDateTime } from '@shared/lib/utils';

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
];

/**
 * Driver trip history.
 *
 * Reads /driver/earnings/history — each entry is a completed ride with the
 * gross fare, the platform commission and what the driver actually kept.
 * Showing all three is deliberate: a driver who only sees net earnings cannot
 * check the commission is right.
 */
export function DriverTripsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState('week');

  const history = useQuery({
    queryKey: ['driver', 'trip-history', range],
    queryFn: () => earningsApi.history({ per_page: 100 }),
    retry: 1,
  });

  const rows = history.data?.items ?? [];

  const totals = rows.reduce(
    (acc, e) => ({
      gross: acc.gross + (e.gross_amount ?? 0),
      net: acc.net + (e.net_amount ?? 0),
      tips: acc.tips + (e.tip_amount ?? 0),
    }),
    { gross: 0, net: 0, tips: 0 },
  );

  return (
    <div className="min-h-full bg-surface pb-[calc(6rem+var(--safe-bottom))]">
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+var(--safe-top))]">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Trip history</h1>
        <IconButton label="Choose a date range">
          <Calendar size={19} />
        </IconButton>
      </header>

      {/* Range tabs */}
      <div role="tablist" aria-label="Date range" className="mx-5 flex rounded-pill border border-line bg-card p-1 shadow-card">
        {RANGES.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={range === r.id}
            onClick={() => setRange(r.id)}
            className={cn(
              'flex-1 rounded-pill py-2.5 text-body-sm font-semibold transition-all duration-200 ease-smooth',
              range === r.id ? 'brand-gradient text-white shadow-brand' : 'text-ink-muted hover:text-ink',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="stagger">
      {/* Totals */}
      <section className="mt-4 grid grid-cols-3 gap-2.5 px-5">
        {history.isLoading ? (
          <>
            <Skeleton className="h-20 rounded-tile" />
            <Skeleton className="h-20 rounded-tile" />
            <Skeleton className="h-20 rounded-tile" />
          </>
        ) : (
          <>
            <Tile label="Trips" value={String(rows.length)} icon={<CheckCircle2 size={15} />} />
            <Tile label="You kept" value={formatCurrency(totals.net)} icon={<TrendingUp size={15} />} />
            <Tile label="Tips" value={formatCurrency(totals.tips)} icon={<Star size={15} />} />
          </>
        )}
      </section>

      {/* List */}
      <section className="mt-5 px-5">
        {history.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Clock size={22} />}
              title="No trips in this period"
              description="Completed rides appear here with a full breakdown of what you earned."
            />
          </Card>
        ) : (
          <ul className="stagger space-y-2.5">
            {rows.map((entry) => (
              <li key={entry.id}>
                <TripRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

function TripRow({ entry }: { entry: EarningsEntry }) {
  const commissionPct =
    entry.gross_amount > 0 ? Math.round((entry.commission / entry.gross_amount) * 100) : 0;

  return (
    <article className="liftable rounded-card border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-micro font-medium text-ink-subtle">{formatDateTime(entry.created_at)}</p>
          <p className="tabular mt-1 text-[1.375rem] font-bold leading-none tracking-[-0.03em] text-ink">{formatCurrency(entry.net_amount)}</p>
        </div>

        {entry.tip_amount ? (
          <span className="shrink-0 rounded-pill bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            +{formatCurrency(entry.tip_amount)} tip
          </span>
        ) : null}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line pt-3 text-caption">
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">Fare</dt>
          <dd className="tabular font-medium text-ink">{formatCurrency(entry.gross_amount)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-ink-muted">Commission</dt>
          <dd className="tabular font-medium text-ink">
            −{formatCurrency(entry.commission)}
            <span className="ml-1 text-ink-muted">({commissionPct}%)</span>
          </dd>
        </div>
      </dl>
    </article>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="liftable rounded-[1.125rem] border border-line bg-card p-3.5 text-center">
      <span
        aria-hidden
        className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand-ink"
      >
        {icon}
      </span>
      <p className="tabular mt-2 truncate text-body font-bold tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
    </div>
  );
}
