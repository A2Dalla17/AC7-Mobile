import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CreditCard, Download, RotateCcw, TrendingUp } from 'lucide-react';

import { adminApi } from '@shared/api/admin';
import type { Payment } from '@shared/api/types';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { Modal } from '@shared/components/ui/Modal';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { StatCard } from '@shared/components/ui/StatCard';
import { useToast } from '@shared/components/ui/Toast';
import { ApiError } from '@shared/lib/http';
import { cn, formatCurrency, formatDateTime } from '@shared/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Settled' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
];

export function PaymentsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('all');
  const [refunding, setRefunding] = useState<Payment | null>(null);

  const payments = useQuery({
    queryKey: ['admin', 'payments', filter],
    queryFn: () =>
      adminApi.payments(filter === 'all' ? { per_page: 200 } : { status: filter, per_page: 200 }),
    retry: 1,
  });

  const stats = useQuery({
    queryKey: ['admin', 'payment-stats'],
    queryFn: () => adminApi.paymentStats(),
    retry: 1,
  });

  const refund = useMutation({
    mutationFn: (id: string) => adminApi.refundPayment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
      setRefunding(null);
      toast.success('Refund issued', 'The rider will see it within a few business days.');
    },
    onError: (e) => toast.error('Refund failed', e instanceof ApiError ? e.userMessage : undefined),
  });

  const rows = payments.data?.items ?? [];
  const s = stats.data;

  const columns: Column<Payment>[] = [
    {
      key: 'id',
      header: 'Payment',
      render: (p) => (
        <div className="min-w-0">
          <p className="tabular truncate font-medium text-ink">{p.id.slice(0, 8)}</p>
          {p.ride_id && (
            <p className="tabular truncate text-caption text-ink-muted">
              Ride {p.ride_id.slice(0, 8)}
            </p>
          )}
        </div>
      ),
      value: (p) => p.id,
    },
    {
      key: 'method',
      header: 'Method',
      secondary: true,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-ink-muted">
          <CreditCard size={14} aria-hidden />
          {p.method ?? '—'}
        </span>
      ),
      value: (p) => p.method,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => (
        <span className="tabular font-semibold">{formatCurrency(p.amount, p.currency_code)}</span>
      ),
      value: (p) => p.amount,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <PaymentBadge status={p.status} />,
      value: (p) => p.status,
    },
    {
      key: 'when',
      header: 'Processed',
      align: 'right',
      secondary: true,
      render: (p) => <span className="text-ink-muted">{formatDateTime(p.created_at)}</span>,
      value: (p) => p.created_at,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) =>
        p.status === 'completed' ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<RotateCcw size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setRefunding(p);
            }}
          >
            Refund
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every transaction processed through the platform, with refunds."
        actions={
          <Button variant="secondary" leadingIcon={<Download size={16} />}>
            Export
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total processed"
          value={s?.total_processed !== undefined ? formatCurrency(s.total_processed, s.currency_code) : '—'}
          icon={<TrendingUp size={17} />}
          loading={stats.isLoading}
        />
        <StatCard
          label="Refunded"
          value={s?.total_refunded !== undefined ? formatCurrency(s.total_refunded, s.currency_code) : '—'}
          icon={<RotateCcw size={17} />}
          loading={stats.isLoading}
        />
        <StatCard
          label="Pending"
          value={s?.pending_count?.toString() ?? '—'}
          icon={<CreditCard size={17} />}
          loading={stats.isLoading}
        />
        <StatCard
          label="Failed"
          value={s?.failed_count?.toString() ?? '—'}
          icon={<AlertCircle size={17} />}
          loading={stats.isLoading}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        loading={payments.isLoading}
        error={payments.isError}
        onRetry={() => void payments.refetch()}
        searchable
        searchPlaceholder="Search by payment or ride ID…"
        pageSize={15}
        emptyTitle="No payments yet"
        emptyDescription="Transactions appear here once riders start paying for trips."
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

      <Modal
        open={refunding !== null}
        onClose={() => setRefunding(null)}
        title="Issue a full refund?"
        description={
          refunding
            ? `${formatCurrency(refunding.amount, refunding.currency_code)} will be returned to the rider's original payment method. This cannot be undone.`
            : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefunding(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={refund.isPending}
              onClick={() => refunding && refund.mutate(refunding.id)}
            >
              Refund
            </Button>
          </>
        }
      />
    </>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'success' | 'danger' | 'brand' | 'muted'; label: string }> = {
    completed: { tone: 'success', label: 'Settled' },
    pending: { tone: 'brand', label: 'Pending' },
    failed: { tone: 'danger', label: 'Failed' },
    refunded: { tone: 'muted', label: 'Refunded' },
  };
  const e = map[status] ?? { tone: 'muted' as const, label: status };
  return <Badge tone={e.tone}>{e.label}</Badge>;
}
