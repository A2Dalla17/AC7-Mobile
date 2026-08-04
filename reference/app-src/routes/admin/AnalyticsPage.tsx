import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Route as RouteIcon, TrendingUp, Users } from 'lucide-react';

import { adminApi } from '@shared/api/admin';
import { AreaChart, BarChart, DonutChart } from '@/components/charts/Charts';
import { Card } from '@shared/components/ui/Card';
import { PageHeader, SectionHeader } from '@shared/components/ui/PageHeader';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { StatCard } from '@shared/components/ui/StatCard';
import { cn, formatCurrency } from '@shared/lib/utils';

type Period = 'week' | 'month' | 'year';

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('month');

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => adminApi.stats(), retry: 1 });
  const revenue = useQuery({
    queryKey: ['admin', 'revenue', period],
    queryFn: () => adminApi.revenueSeries(period),
    retry: 1,
  });
  const rides = useQuery({
    queryKey: ['admin', 'rides-series', period],
    queryFn: () => adminApi.rideSeries(period),
    retry: 1,
  });
  const types = useQuery({
    queryKey: ['admin', 'ride-types'],
    queryFn: () => adminApi.rideTypeBreakdown(),
    retry: 1,
  });

  const s = stats.data;
  const currency = s?.currency_code;

  const revenueSeries = revenue.data ?? [];
  const rideSeries = rides.data ?? [];

  const completionRate =
    s?.total_rides && s.completed_rides !== undefined
      ? Math.round((s.completed_rides / s.total_rides) * 100)
      : null;

  const avgFare =
    s?.total_revenue !== undefined && s.completed_rides
      ? s.total_revenue / s.completed_rides
      : null;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Revenue, demand and platform health over time."
        actions={
          <div className="flex gap-1 rounded-pill border border-line p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'rounded-pill px-4 py-1.5 text-caption font-medium transition-colors',
                  period === p.id ? 'brand-gradient text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={s?.total_revenue !== undefined ? formatCurrency(s.total_revenue, currency) : '—'}
          icon={<CreditCard size={17} />}
          {...(s?.revenue_trend !== undefined ? { trend: s.revenue_trend } : {})}
          loading={stats.isLoading}
          {...(revenueSeries.length > 1 ? { sparkline: revenueSeries.map((p) => p.value) } : {})}
        />
        <StatCard
          label="Completed trips"
          value={s?.completed_rides?.toLocaleString() ?? '—'}
          icon={<RouteIcon size={17} />}
          {...(s?.rides_trend !== undefined ? { trend: s.rides_trend } : {})}
          loading={stats.isLoading}
        />
        <StatCard
          label="Completion rate"
          value={completionRate !== null ? `${completionRate}%` : '—'}
          icon={<TrendingUp size={17} />}
          loading={stats.isLoading}
        />
        <StatCard
          label="Average fare"
          value={avgFare !== null ? formatCurrency(avgFare, currency) : '—'}
          icon={<Users size={17} />}
          loading={stats.isLoading}
        />
      </div>

      <Card className="mt-6">
        <SectionHeader title="Revenue over time" description={`Gross revenue, by ${period}`} />
        {revenue.isLoading ? (
          <Skeleton className="h-[280px]" />
        ) : (
          <AreaChart
            data={revenueSeries.map((p) => p.value)}
            labels={revenueSeries.map((p) => p.label ?? '')}
            height={280}
            ariaLabel={`Revenue over the last ${period}`}
            valueFormat={(v) => formatCurrency(v, currency)}
          />
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title="Trip volume" description="Completed rides per period" />
          {rides.isLoading ? (
            <Skeleton className="h-[240px]" />
          ) : (
            <BarChart
              data={rideSeries.map((p) => p.value)}
              labels={rideSeries.map((p) => p.label ?? '')}
              height={240}
              ariaLabel={`Trip volume over the last ${period}`}
            />
          )}
        </Card>

        <Card>
          <SectionHeader title="Vehicle mix" description="Share by ride type" />
          {types.isLoading ? (
            <Skeleton className="h-[240px]" />
          ) : (
            <DonutChart
              segments={(types.data ?? []).map((t) => ({ label: t.ride_type, value: t.count }))}
              size={160}
              ariaLabel="Share of trips by vehicle type"
            />
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <SectionHeader
          title="Where the numbers come from"
          description="So nothing here is mistaken for an estimate"
        />
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Source label="Revenue and trends" endpoint="GET /api/v1/analytics/revenue" />
          <Source label="Trip volume" endpoint="GET /api/v1/analytics/rides" />
          <Source label="Vehicle mix" endpoint="GET /api/v1/analytics/ride-types" />
          <Source label="Platform totals" endpoint="GET /api/v1/admin/stats" />
        </dl>
      </Card>
    </>
  );
}

function Source({ label, endpoint }: { label: string; endpoint: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-tile bg-surface px-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="truncate font-mono text-caption text-ink">{endpoint}</dd>
    </div>
  );
}
