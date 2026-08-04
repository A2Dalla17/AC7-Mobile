import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight, Car, CheckCircle2, CreditCard, Route as RouteIcon,
  ShieldAlert, TrendingUp, Users, XCircle,
} from 'lucide-react';

import { adminApi } from '@shared/api/admin';
import { AreaChart, BarChart, DonutChart } from '@/components/charts/Charts';
import { RideStatusBadge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { PageHeader, SectionHeader } from '@shared/components/ui/PageHeader';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { StatCard } from '@shared/components/ui/StatCard';
import type { Ride } from '@shared/api/types';
import { formatCurrency, formatDateTime, formatDistance } from '@shared/lib/utils';
import { useAuth } from '@shared/providers/AuthProvider';

/**
 * Admin dashboard.
 *
 * Every figure comes from the analytics and admin services. When those are not
 * running the cards show an em dash and the charts show "not enough data" —
 * never an invented number. An operations console that lies is worse than one
 * that is honest about being offline.
 */
export function DashboardPage() {
  const { user } = useAuth();

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => adminApi.stats(), retry: 1 });
  const revenue = useQuery({
    queryKey: ['admin', 'revenue', 'month'],
    queryFn: () => adminApi.revenueSeries('month'),
    retry: 1,
  });
  const rides = useQuery({
    queryKey: ['admin', 'rides-series', 'week'],
    queryFn: () => adminApi.rideSeries('week'),
    retry: 1,
  });
  const breakdown = useQuery({
    queryKey: ['admin', 'ride-types'],
    queryFn: () => adminApi.rideTypeBreakdown(),
    retry: 1,
  });
  const recent = useQuery({
    queryKey: ['admin', 'recent-rides'],
    queryFn: () => adminApi.rides({ per_page: 8 }),
    retry: 1,
  });
  const emergencies = useQuery({
    queryKey: ['admin', 'emergencies'],
    queryFn: () => adminApi.activeEmergencies(),
    retry: 1,
    refetchInterval: 30_000,
  });

  const s = stats.data;
  const currency = s?.currency_code;

  const activeEmergencies = emergencies.data ?? [];

  const recentColumns: Column<Ride>[] = [
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-body-sm font-medium text-ink">{r.pickup_address}</p>
          <p className="truncate text-caption text-ink-muted">→ {r.dropoff_address}</p>
        </div>
      ),
      value: (r) => r.pickup_address,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <RideStatusBadge status={r.status} />,
      value: (r) => r.status,
    },
    {
      key: 'distance',
      header: 'Distance',
      align: 'right',
      secondary: true,
      render: (r) => (
        <span className="tabular">{formatDistance(r.actual_distance ?? r.estimated_distance)}</span>
      ),
      value: (r) => r.actual_distance ?? r.estimated_distance,
    },
    {
      key: 'fare',
      header: 'Fare',
      align: 'right',
      render: (r) => (
        <span className="tabular font-semibold">
          {formatCurrency(r.final_fare ?? r.estimated_fare, r.currency_code)}
        </span>
      ),
      value: (r) => r.final_fare ?? r.estimated_fare,
    },
    {
      key: 'when',
      header: 'Requested',
      align: 'right',
      secondary: true,
      render: (r) => <span className="text-ink-muted">{formatDateTime(r.requested_at)}</span>,
      value: (r) => r.requested_at,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user?.first_name ?? 'Admin'}`}
        description="Platform health at a glance. Figures refresh as the services report."
        actions={
          <Link to="/admin/analytics">
            <Button variant="secondary" trailingIcon={<ArrowUpRight size={16} />}>
              Full analytics
            </Button>
          </Link>
        }
      />

      {/* ---- Emergency banner — highest priority when present ------------- */}
      {activeEmergencies.length > 0 && (
        <div className="mb-6 flex items-center gap-4 rounded-card border border-danger/30 bg-danger-soft p-4">
          <span
            aria-hidden
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-danger text-white"
          >
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-danger/40" />
            <ShieldAlert size={20} className="relative" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-danger-ink">
              {activeEmergencies.length} active emergency
              {activeEmergencies.length > 1 ? ' alerts' : ' alert'}
            </p>
            <p className="text-sm text-ink-muted">Requires immediate attention from the safety team.</p>
          </div>

          <Button variant="danger" size="sm">
            Open console
          </Button>
        </div>
      )}

      {/* ---- Stats ------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={s?.total_revenue !== undefined ? formatCurrency(s.total_revenue, currency) : '—'}
          icon={<CreditCard size={17} />}
          {...(s?.revenue_trend !== undefined ? { trend: s.revenue_trend } : {})}
          loading={stats.isLoading}
        />
        <StatCard
          label="Total rides"
          value={s?.total_rides?.toLocaleString() ?? '—'}
          icon={<RouteIcon size={17} />}
          {...(s?.rides_trend !== undefined ? { trend: s.rides_trend } : {})}
          loading={stats.isLoading}
        />
        <StatCard
          label="Active drivers"
          value={s?.active_drivers?.toLocaleString() ?? '—'}
          icon={<Car size={17} />}
          {...(s?.drivers_trend !== undefined ? { trend: s.drivers_trend } : {})}
          loading={stats.isLoading}
        />
        <StatCard
          label="Registered users"
          value={s?.total_users?.toLocaleString() ?? '—'}
          icon={<Users size={17} />}
          {...(s?.users_trend !== undefined ? { trend: s.users_trend } : {})}
          loading={stats.isLoading}
        />
      </div>

      {/* ---- Charts ------------------------------------------------------ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Revenue"
            description="Gross platform revenue over the last month"
            actions={
              <span className="flex items-center gap-1.5 rounded-pill bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                <TrendingUp size={12} aria-hidden />
                {s?.revenue_trend !== undefined ? `${s.revenue_trend.toFixed(1)}%` : '—'}
              </span>
            }
          />

          {revenue.isLoading ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <AreaChart
              data={(revenue.data ?? []).map((p) => p.value)}
              labels={(revenue.data ?? []).map((p) => p.label ?? '')}
              ariaLabel="Platform revenue over the last month"
              valueFormat={(v) => formatCurrency(v, currency)}
            />
          )}
        </Card>

        <Card>
          <SectionHeader title="Rides by type" description="Share of completed trips" />

          {breakdown.isLoading ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <DonutChart
              segments={(breakdown.data ?? []).map((b) => ({ label: b.ride_type, value: b.count }))}
              centerValue={s?.completed_rides?.toLocaleString() ?? '—'}
              centerLabel="Completed trips"
              ariaLabel="Distribution of rides by vehicle type"
            />
          )}
        </Card>
      </div>

      {/* ---- Weekly volume + completion ---------------------------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title="Ride volume" description="Trips per day, last seven days" />

          {rides.isLoading ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <BarChart
              data={(rides.data ?? []).map((p) => p.value)}
              labels={(rides.data ?? []).map((p) => p.label ?? '')}
              ariaLabel="Ride volume per day over the last week"
            />
          )}
        </Card>

        <Card>
          <SectionHeader title="Trip outcomes" />

          <div className="space-y-4">
            <Outcome
              icon={<CheckCircle2 size={17} />}
              tone="success"
              label="Completed"
              value={s?.completed_rides}
              total={s?.total_rides}
              loading={stats.isLoading}
            />
            <Outcome
              icon={<XCircle size={17} />}
              tone="danger"
              label="Cancelled"
              value={s?.cancelled_rides}
              total={s?.total_rides}
              loading={stats.isLoading}
            />
          </div>
        </Card>
      </div>

      {/* ---- Recent activity --------------------------------------------- */}
      <div className="mt-6">
        <SectionHeader
          title="Recent trips"
          description="The last eight rides across the platform"
          actions={
            <Link to="/admin/trips">
              <Button variant="ghost" size="sm" trailingIcon={<ArrowUpRight size={14} />}>
                View all
              </Button>
            </Link>
          }
        />

        <DataTable
          columns={recentColumns}
          rows={recent.data?.items}
          rowKey={(r) => r.id}
          loading={recent.isLoading}
          error={recent.isError}
          onRetry={() => void recent.refetch()}
          emptyTitle="No trips yet"
          emptyDescription="Once riders start booking, activity appears here in real time."
        />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Outcome({
  icon,
  tone,
  label,
  value,
  total,
  loading,
}: {
  icon: React.ReactNode;
  tone: 'success' | 'danger';
  label: string;
  value: number | undefined;
  total: number | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-16" />;

  const pct = value !== undefined && total ? Math.round((value / total) * 100) : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-ink-muted">
          <span className={tone === 'success' ? 'text-success-ink' : 'text-danger-ink'}>{icon}</span>
          {label}
        </span>
        <span className="tabular font-semibold text-ink">
          {value?.toLocaleString() ?? '—'}
          {pct !== null && <span className="ml-1.5 text-sm font-normal text-ink-muted">{pct}%</span>}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={tone === 'success' ? 'h-full bg-success' : 'h-full bg-danger'}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}
