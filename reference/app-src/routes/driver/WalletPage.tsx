import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Building2, Clock, Download, Wallet } from 'lucide-react';

import { earningsApi } from '@shared/api';
import { Badge } from '@shared/components/ui/Badge';
import { Button, IconButton } from '@shared/components/ui/Button';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Input } from '@shared/components/ui/Input';
import { Modal } from '@shared/components/ui/Modal';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { ApiError } from '@shared/lib/http';
import { cn, formatCurrency, formatDateTime } from '@shared/lib/utils';

const QUICK = [25, 50, 100];

/**
 * Driver wallet and payouts.
 *
 * Balance splits into available and pending because a driver needs to know
 * what they can actually withdraw today versus what is still clearing.
 */
export function DriverWalletPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [amount, setAmount] = useState('');

  const balance = useQuery({
    queryKey: ['driver', 'balance'],
    queryFn: () => earningsApi.balance(),
    retry: 1,
  });

  const payouts = useQuery({
    queryKey: ['driver', 'payouts'],
    queryFn: () => earningsApi.payoutHistory(),
    retry: 1,
  });

  const accounts = useQuery({
    queryKey: ['driver', 'bank-accounts'],
    queryFn: () => earningsApi.bankAccounts(),
    retry: 1,
  });

  const request = useMutation({
    mutationFn: (value: number) => earningsApi.requestPayout(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver'] });
      setPayoutOpen(false);
      setAmount('');
      toast.success('Payout requested', 'It usually lands within 1–3 business days.');
    },
    onError: (e) =>
      toast.error('Could not request payout', e instanceof ApiError ? e.userMessage : undefined),
  });

  const available = balance.data?.available ?? 0;
  const pending = balance.data?.pending ?? 0;
  const currency = balance.data?.currency_code;

  return (
    <div className="min-h-full bg-surface pb-[calc(6rem+var(--safe-bottom))]">
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+var(--safe-top))]">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Wallet</h1>
        <IconButton label="Download statement">
          <Download size={19} />
        </IconButton>
      </header>

      <div className="stagger">
      {/* Balance */}
      <section className="px-5">
        {balance.isLoading ? (
          <Skeleton className="h-48 rounded-[1.5rem]" />
        ) : (
          <div className="edge-light relative overflow-hidden rounded-[1.5rem] brand-gradient p-6 shadow-brand-lg">
            <svg
              aria-hidden
              viewBox="0 0 400 200"
              className="pointer-events-none absolute -right-10 -top-10 h-56 w-72 opacity-20"
            >
              <circle cx="200" cy="100" r="90" fill="none" stroke="white" strokeWidth="1.5" />
              <circle cx="200" cy="100" r="60" fill="none" stroke="white" strokeWidth="1" />
            </svg>

            <div className="relative">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-white/60">Available to withdraw</p>
              <p className="tabular mt-2 text-[2.375rem] font-bold leading-none tracking-[-0.04em] text-white">
                {formatCurrency(available, currency)}
              </p>

              {pending > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1.5 text-micro text-white/85 backdrop-blur-sm">
                  <Clock size={14} aria-hidden />
                  {formatCurrency(pending, currency)} still clearing
                </p>
              )}

              <button
                type="button"
                disabled={available <= 0}
                onClick={() => setPayoutOpen(true)}
                className="pressable mt-5 inline-flex items-center gap-2 rounded-pill bg-white px-5 py-2.5 text-body-sm font-bold text-brand shadow-lifted disabled:opacity-50"
              >
                <Banknote size={16} aria-hidden />
                Withdraw
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Bank accounts */}
      <section className="mt-5 px-5">
        <Card>
          <CardHeader
            title="Payout account"
            action={
              <Button variant="ghost" size="sm">
                Add
              </Button>
            }
          />

          {accounts.isLoading ? (
            <Skeleton className="h-16" />
          ) : !accounts.data?.length ? (
            <p className="text-body text-ink-muted">
              No account yet. Add one so withdrawals have somewhere to land.
            </p>
          ) : (
            <ul className="space-y-2">
              {accounts.data.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-tile bg-surface px-4 py-3.5">
                  <span
                    aria-hidden
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
                  >
                    <Building2 size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink">
                      {a.bank_name}
                    </span>
                    <span className="tabular mt-0.5 block text-caption text-ink-muted">
                      ···· {a.last_four}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Payout history */}
      <section className="mt-4 px-5">
        <Card>
          <CardHeader title="Payout history" />

          {payouts.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : !payouts.data?.length ? (
            <EmptyState
              icon={<Wallet size={22} />}
              title="No payouts yet"
              description="Once you withdraw, each transfer is listed here with its status."
            />
          ) : (
            <ul className="divide-y divide-line">
              {payouts.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="tabular text-body-lg font-bold tracking-[-0.02em] text-ink">
                      {formatCurrency(p.amount, currency)}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-subtle">
                      {formatDateTime(p.created_at)}
                    </p>
                  </div>
                  <PayoutBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
      </div>

      {/* Withdraw modal */}
      <Modal
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        title="Withdraw earnings"
        description={`You can withdraw up to ${formatCurrency(available, currency)} right now.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayoutOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={request.isPending}
              disabled={!amount || Number(amount) <= 0 || Number(amount) > available}
              onClick={() => request.mutate(Number(amount))}
            >
              Withdraw {amount ? formatCurrency(Number(amount), currency) : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {QUICK.filter((q) => q <= available).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={cn(
                  'tabular rounded-tile border py-3 text-body-sm font-bold transition-all duration-200 ease-smooth',
                  Number(amount) === q
                    ? 'border-brand bg-brand/[0.06] text-brand-ink'
                    : 'border-line text-ink hover:border-line-strong hover:bg-surface',
                )}
              >
                {q}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(String(Math.floor(available)))}
              className={cn(
                'rounded-tile border py-3 text-body-sm font-bold transition-all duration-200 ease-smooth',
                Number(amount) === Math.floor(available)
                  ? 'border-brand bg-brand/[0.06] text-brand-ink'
                  : 'border-line text-ink hover:border-line-strong hover:bg-surface',
              )}
            >
              All
            </button>
          </div>

          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            min={1}
            max={available}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            {...(Number(amount) > available ? { error: 'More than your available balance' } : {})}
          />
        </div>
      </Modal>
    </div>
  );
}

function PayoutBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'success' | 'brand' | 'danger' | 'muted'; label: string }> = {
    completed: { tone: 'success', label: 'Paid' },
    approved: { tone: 'success', label: 'Approved' },
    pending: { tone: 'brand', label: 'Processing' },
    rejected: { tone: 'danger', label: 'Rejected' },
  };
  const e = map[status] ?? { tone: 'muted' as const, label: status };
  return <Badge tone={e.tone}>{e.label}</Badge>;
}
