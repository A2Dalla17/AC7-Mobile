import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ListOrdered, TrendingUp } from 'lucide-react';

import { earningsApi } from '@shared/api';
import { useQuery } from '@tanstack/react-query';
import { IconButton } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useDriverEarnings } from '@shared/hooks/queries';
import { cn, formatCurrency } from '@shared/lib/utils';

type Period = 'day' | 'week' | 'month';

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

/**
 * Driver earnings.
 *
 * Matches the mockup: period tabs, headline total with a trend sparkline,
 * three stat tiles, and a breakdown table. Every figure comes from
 * `/driver/earnings/*` — there is no client-side estimation.
 */
export function EarningsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('day');

  const { data: summary, isLoading } = useDriverEarnings(period);

  const { data: daily } = useQuery({
    queryKey: ['driver', 'earnings', 'daily', period],
    queryFn: () => earningsApi.daily(),
    staleTime: 5 * 60_000,
  });

  const series = useMemo(() => (daily ?? []).map((point) => point.total), [daily]);

  const averagePerTrip =
    summary && summary.total_rides > 0 ? summary.total_earnings / summary.total_rides : 0;

  return (
    <div className="min-h-full bg-surface pb-[calc(6rem+var(--safe-bottom))]">
      {/* ---- Header ---------------------------------------------------- */}
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+var(--safe-top))]">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>

        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Earnings</h1>

        <IconButton label="Choose a date range">
          <Calendar size={19} />
        </IconButton>
      </header>

      {/* ---- Period tabs ------------------------------------------------ */}
      <div
        role="tablist"
        aria-label="Earnings period"
        className="mx-5 flex rounded-pill border border-line bg-card p-1 shadow-card"
      >
        {PERIODS.map((option) => (
          <button
            key={option.id}
            role="tab"
            aria-selected={period === option.id}
            onClick={() => setPeriod(option.id)}
            className={cn(
              'flex-1 rounded-pill py-2.5 text-body-sm font-semibold transition-all duration-200 ease-smooth',
              period === option.id
                ? 'brand-gradient text-white shadow-brand'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="stagger">
      {/* ---- Headline --------------------------------------------------- */}
      <section className="mt-5 px-5">
        {isLoading ? (
          <Skeleton className="h-44 rounded-[1.5rem]" />
        ) : (
          <div className="edge-light relative overflow-hidden rounded-[1.5rem] brand-gradient px-6 pb-6 pt-6 shadow-brand-lg">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-white/60">
              Total earnings
            </p>

            <p className="tabular mt-2 text-[2.375rem] font-bold leading-none tracking-[-0.04em] text-white">
              {formatCurrency(summary?.total_earnings ?? 0, summary?.currency_code)}
            </p>

            {series.length > 1 && (
              <div className="mt-4 flex items-end justify-between gap-4">
                <p className="flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1.5 text-micro backdrop-blur-sm">
                  <TrendingUp size={13} className="text-white" aria-hidden />
                  <span className="font-bold text-white">{trendLabel(series)}</span>
                  <span className="text-white/70">vs previous</span>
                </p>

                <Sparkline values={series} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- Stat tiles -------------------------------------------------- */}
      <section className="mt-3 grid grid-cols-3 gap-2.5 px-5">
        {isLoading ? (
          <>
            <Skeleton className="h-20 rounded-tile" />
            <Skeleton className="h-20 rounded-tile" />
            <Skeleton className="h-20 rounded-tile" />
          </>
        ) : (
          <>
            <StatTile value={String(summary?.total_rides ?? 0)} label="Trips" />
            <StatTile value={formatOnline(summary?.online_seconds)} label="Online time" />
            <StatTile
              value={formatCurrency(averagePerTrip, summary?.currency_code)}
              label="Avg. per trip"
            />
          </>
        )}
      </section>

      {/* ---- Breakdown --------------------------------------------------- */}
      <section className="mt-5 px-5">
        <div className="rounded-card border border-line bg-card p-5">
          <h2 className="text-h4 text-ink">Earnings breakdown</h2>

          {isLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ) : !summary ? (
            <EmptyState
              icon={<ListOrdered size={20} />}
              title="No earnings yet"
              description="Completed trips will appear here with a full breakdown."
            />
          ) : (
            <>
              <dl className="mt-4 space-y-3.5">
                <Row label="Base fare" value={summary.total_earnings} code={summary.currency_code} />
                <Row label="Trips completed" raw={String(summary.total_rides)} />
                {summary.average_rating !== undefined && (
                  <Row label="Average rating" raw={summary.average_rating.toFixed(2)} />
                )}
              </dl>

              <div className="mt-4 flex justify-between border-t border-line pt-4">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="tabular font-bold text-brand-ink">
                  {formatCurrency(summary.total_earnings, summary.currency_code)}
                </dd>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ---- Transactions ------------------------------------------------ */}
      <section className="mt-3 px-5">
        <button
          type="button"
          onClick={() => navigate('/driver/wallet')}
          className="pressable flex w-full items-center justify-center gap-2.5 rounded-card border border-line bg-card py-4 text-body font-semibold text-ink"
        >
          <ListOrdered size={17} aria-hidden />
          View transactions
        </button>
      </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="liftable rounded-[1.125rem] border border-line bg-card p-3.5 text-center">
      <p className="tabular truncate text-body-lg font-bold tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  raw,
  code,
}: {
  label: string;
  value?: number;
  raw?: string;
  code?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-body text-ink-muted">{label}</dt>
      <dd className="tabular text-body font-medium text-ink">
        {raw ?? formatCurrency(value ?? 0, code)}
      </dd>
    </div>
  );
}

/**
 * Inline sparkline. Hand-drawn rather than pulled from a charting library —
 * one path element is far lighter than shipping a chart runtime for a
 * decorative trend line.
 */
function Sparkline({ values }: { values: number[] }) {
  const width = 132;
  const height = 46;
  const pad = 3;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const coords = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = pad + (1 - (value - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} ${width},${height} 0,${height}`;
  const last = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Earnings trend across ${values.length} periods`}
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      <polygon points={area} fill="url(#spark-fill)" />

      <polyline
        points={line}
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {last && (
        <circle cx={last[0]} cy={last[1]} r="3" fill="white" stroke="none" />
      )}
    </svg>
  );
}

function trendLabel(values: number[]): string {
  const last = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;
  if (previous === 0) return '—';
  const change = ((last - previous) / previous) * 100;
  return `${change >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(change))}%`;
}

function formatOnline(seconds: number | undefined): string {
  if (!seconds) return '0h 00m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
