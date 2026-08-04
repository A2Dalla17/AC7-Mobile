import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Download, Route as RouteIcon } from 'lucide-react';

import { adminApi } from '@shared/api/admin';
import type { Ride } from '@shared/api/types';
import { Badge, RideStatusBadge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { Modal } from '@shared/components/ui/Modal';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { StatCard } from '@shared/components/ui/StatCard';
import { cn, formatCurrency, formatDateTime, formatDistance, formatDuration } from '@shared/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Searching' },
  { id: 'accepted', label: 'Assigned' },
  { id: 'in_progress', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function TripsPage() {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Ride | null>(null);

  const trips = useQuery({
    queryKey: ['admin', 'trips', filter],
    queryFn: () =>
      adminApi.rides(filter === 'all' ? { per_page: 200 } : { status: filter, per_page: 200 }),
    retry: 1,
    refetchInterval: 30_000,
  });

  const rows = trips.data?.items ?? [];

  const stats = {
    total: rows.length,
    active: rows.filter((r) => ['requested', 'accepted', 'in_progress'].includes(r.status)).length,
    completed: rows.filter((r) => r.status === 'completed').length,
    revenue: rows
      .filter((r) => r.status === 'completed')
      .reduce((s, r) => s + (r.final_fare ?? r.estimated_fare ?? 0), 0),
  };

  const columns: Column<Ride>[] = [
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <div className="flex gap-2.5">
          <div aria-hidden className="flex flex-col items-center pt-1.5">
            <span className="h-2 w-2 rounded-full border-2 border-brand" />
            <span className="my-0.5 w-px flex-1 bg-line-strong" />
            <span className="h-2 w-2 rounded-full bg-ink-subtle" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-body-sm text-ink">{r.pickup_address}</p>
            <p className="mt-1 truncate text-body-sm text-ink-muted">{r.dropoff_address}</p>
          </div>
        </div>
      ),
      value: (r) => `${r.pickup_address} ${r.dropoff_address}`,
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
        <div>
          <p className="tabular font-semibold text-ink">
            {formatCurrency(r.final_fare ?? r.estimated_fare, r.currency_code)}
          </p>
          {r.surge_multiplier > 1 && (
            <p className="text-[0.6875rem] font-medium text-brand-ink">
              {r.surge_multiplier.toFixed(1)}× surge
            </p>
          )}
        </div>
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
        title="Trips"
        description="Every ride on the platform. The list refreshes every 30 seconds."
        actions={
          <Button variant="secondary" leadingIcon={<Download size={16} />}>
            Export
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trips shown" value={String(stats.total)} icon={<RouteIcon size={17} />} loading={trips.isLoading} />
        <StatCard label="In progress" value={String(stats.active)} icon={<Clock size={17} />} loading={trips.isLoading} />
        <StatCard label="Completed" value={String(stats.completed)} icon={<CheckCircle2 size={17} />} loading={trips.isLoading} />
        <StatCard label="Revenue" value={formatCurrency(stats.revenue)} icon={<CheckCircle2 size={17} />} loading={trips.isLoading} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={trips.isLoading}
        error={trips.isError}
        onRetry={() => void trips.refetch()}
        searchable
        searchPlaceholder="Search by pickup or destination…"
        pageSize={15}
        onRowClick={setSelected}
        emptyTitle="No trips match"
        emptyDescription="Try a different filter, or wait for new bookings to come in."
        toolbar={
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-pill border border-line p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'whitespace-nowrap rounded-pill px-3 py-1.5 text-caption font-medium transition-colors',
                  filter === f.id ? 'brand-gradient text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <TripDetail ride={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function TripDetail({ ride, onClose }: { ride: Ride | null; onClose: () => void }) {
  if (!ride) return null;

  return (
    <Modal open onClose={onClose} title="Trip detail" size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <RideStatusBadge status={ride.status} />
          {ride.surge_multiplier > 1 && (
            <Badge tone="brand">{ride.surge_multiplier.toFixed(1)}× surge</Badge>
          )}
          {ride.is_scheduled && <Badge tone="muted">Scheduled</Badge>}
          {ride.was_negotiated && <Badge tone="muted">Negotiated</Badge>}
        </div>

        <div className="rounded-tile bg-surface p-4">
          <div className="flex gap-3">
            <div aria-hidden className="flex flex-col items-center pt-1.5">
              <span className="h-3 w-3 rounded-full border-[3px] border-brand" />
              <span className="my-1 w-px flex-1 bg-line-strong" />
              <span className="h-3 w-3 rounded-full bg-ink" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-xs font-medium text-ink-muted">Pickup</p>
                <p className="text-body text-ink">{ride.pickup_address}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Destination</p>
                <p className="text-body text-ink">{ride.dropoff_address}</p>
              </div>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Distance" value={formatDistance(ride.actual_distance ?? ride.estimated_distance)} />
          <Field label="Duration" value={formatDuration(ride.actual_duration ?? ride.estimated_duration)} />
          <Field label="Fare" value={formatCurrency(ride.final_fare ?? ride.estimated_fare, ride.currency_code)} />
          <Field label="Discount" value={formatCurrency(ride.discount_amount, ride.currency_code)} />
          <Field label="Requested" value={formatDateTime(ride.requested_at)} />
          <Field label="Completed" value={ride.completed_at ? formatDateTime(ride.completed_at) : '—'} />
        </dl>

        {ride.cancellation_reason && (
          <div className="rounded-tile border border-danger/25 bg-danger-soft p-4">
            <p className="text-xs font-semibold text-danger-ink">Cancellation reason</p>
            <p className="mt-1 text-body text-ink">{ride.cancellation_reason}</p>
          </div>
        )}

        {ride.rating && (
          <div className="rounded-tile bg-surface p-4">
            <p className="text-xs font-medium text-ink-muted">Rider rating</p>
            <p className="tabular mt-1 text-h4 text-ink">{ride.rating} / 5</p>
            {ride.feedback && <p className="mt-2 text-body text-ink-muted">“{ride.feedback}”</p>}
          </div>
        )}

        <p className="text-xs text-ink-subtle">Ride ID · {ride.id}</p>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-body font-medium text-ink">{value}</dd>
    </div>
  );
}
