import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, CheckCircle2, Clock, Star, XCircle } from 'lucide-react';

import { adminApi } from '@shared/api/admin';
import type { Driver } from '@shared/api/types';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { Input } from '@shared/components/ui/Input';
import { Modal } from '@shared/components/ui/Modal';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { StatCard } from '@shared/components/ui/StatCard';
import { useToast } from '@shared/components/ui/Toast';
import { ApiError } from '@shared/lib/http';
import { cn } from '@shared/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export function DriversPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('all');
  const [rejecting, setRejecting] = useState<Driver | null>(null);
  const [reason, setReason] = useState('');

  const drivers = useQuery({
    queryKey: ['admin', 'drivers', filter],
    queryFn: () =>
      adminApi.drivers(filter === 'all' ? { per_page: 100 } : { approval_status: filter, per_page: 100 }),
    retry: 1,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveDriver(id),
    onSuccess: () => {
      invalidate();
      toast.success('Driver approved', 'They can now go online and accept rides.');
    },
    onError: (e) => toast.error('Could not approve', e instanceof ApiError ? e.userMessage : undefined),
  });

  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => adminApi.rejectDriver(id, why),
    onSuccess: () => {
      invalidate();
      setRejecting(null);
      setReason('');
      toast.info('Driver rejected');
    },
    onError: (e) => toast.error('Could not reject', e instanceof ApiError ? e.userMessage : undefined),
  });

  const rows = drivers.data?.items ?? [];

  const counts = {
    total: rows.length,
    pending: rows.filter((d) => d.approval_status === 'pending').length,
    online: rows.filter((d) => d.is_online).length,
    avgRating: rows.length
      ? (rows.reduce((s, d) => s + (d.rating || 0), 0) / rows.length).toFixed(2)
      : '—',
  };

  const columns: Column<Driver>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (d) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink"
          >
            <Car size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{d.vehicle_model || '—'}</p>
            <p className="truncate text-caption text-ink-muted">
              {d.vehicle_plate} · {d.vehicle_color} · {d.vehicle_year || '—'}
            </p>
          </div>
        </div>
      ),
      value: (d) => `${d.vehicle_model} ${d.vehicle_plate}`,
    },
    {
      key: 'licence',
      header: 'Licence',
      secondary: true,
      render: (d) => <span className="tabular text-ink-muted">{d.license_number || '—'}</span>,
      value: (d) => d.license_number,
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      render: (d) => (
        <span className="tabular inline-flex items-center gap-1 font-medium">
          <Star size={13} className="fill-brand text-brand-ink" aria-hidden />
          {d.rating ? d.rating.toFixed(2) : '—'}
        </span>
      ),
      value: (d) => d.rating,
    },
    {
      key: 'trips',
      header: 'Trips',
      align: 'right',
      secondary: true,
      render: (d) => <span className="tabular">{d.total_rides?.toLocaleString() ?? 0}</span>,
      value: (d) => d.total_rides,
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <div className="flex flex-wrap gap-1.5">
          <ApprovalBadge status={d.approval_status} />
          {d.is_online && (
            <Badge tone="success" dot>
              Online
            </Badge>
          )}
        </div>
      ),
      value: (d) => d.approval_status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) =>
        d.approval_status === 'pending' ? (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-soft"
              onClick={(e) => {
                e.stopPropagation();
                setRejecting(d);
              }}
            >
              Reject
            </Button>
            <Button
              size="sm"
              loading={approve.isPending}
              onClick={(e) => {
                e.stopPropagation();
                approve.mutate(d.id);
              }}
            >
              Approve
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Approvals, vehicle details and live availability. Approving a driver lets them go online immediately."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total drivers" value={String(counts.total)} icon={<Car size={17} />} loading={drivers.isLoading} />
        <StatCard label="Pending approval" value={String(counts.pending)} icon={<Clock size={17} />} loading={drivers.isLoading} />
        <StatCard label="Online now" value={String(counts.online)} icon={<CheckCircle2 size={17} />} loading={drivers.isLoading} />
        <StatCard label="Average rating" value={String(counts.avgRating)} icon={<Star size={17} />} loading={drivers.isLoading} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(d) => d.id}
        loading={drivers.isLoading}
        error={drivers.isError}
        onRetry={() => void drivers.refetch()}
        searchable
        searchPlaceholder="Search by vehicle, plate or licence…"
        pageSize={12}
        emptyTitle="No drivers yet"
        emptyDescription="Driver applications appear here for review once people sign up to drive."
        toolbar={
          <div className="flex gap-1 rounded-pill border border-line p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-pill px-3 py-1.5 text-caption font-medium transition-colors',
                  filter === f.id ? 'brand-gradient text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <Modal
        open={rejecting !== null}
        onClose={() => {
          setRejecting(null);
          setReason('');
        }}
        title="Reject this application?"
        description="The driver is told why, so write something they can act on."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 5}
              loading={reject.isPending}
              onClick={() => rejecting && reject.mutate({ id: rejecting.id, why: reason.trim() })}
            >
              Reject application
            </Button>
          </>
        }
      >
        <Input
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Insurance document has expired"
          hint="Shown to the driver. At least 5 characters."
        />
      </Modal>
    </>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'success' | 'danger' | 'brand'; label: string; icon: React.ReactNode }> = {
    approved: { tone: 'success', label: 'Approved', icon: <CheckCircle2 size={11} /> },
    rejected: { tone: 'danger', label: 'Rejected', icon: <XCircle size={11} /> },
    pending: { tone: 'brand', label: 'Pending', icon: <Clock size={11} /> },
  };
  const e = map[status] ?? map.pending!;
  return (
    <Badge tone={e.tone}>
      {e.icon}
      {e.label}
    </Badge>
  );
}
