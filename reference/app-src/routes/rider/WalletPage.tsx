import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CreditCard, Plus,
  Receipt, Wallet as WalletIcon,
} from 'lucide-react';

import { Button, IconButton } from '@shared/components/ui/Button';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Input } from '@shared/components/ui/Input';
import { Modal } from '@shared/components/ui/Modal';
import { Skeleton, SkeletonList } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import {
  usePaymentMethods,
  useTopUpWallet,
  useWallet,
  useWalletTransactions,
} from '@shared/hooks/queries';
import { ApiError } from '@shared/lib/http';
import { cn, formatCurrency, formatDateTime } from '@shared/lib/utils';

const QUICK_AMOUNTS = [50, 100, 200, 500];

/**
 * Wallet.
 *
 * The balance is the whole point of the screen, so it gets the brand panel and
 * the largest type. Everything below it — cards, ledger — is reference
 * material and is styled to read as such.
 *
 * GET /wallet, /wallet/transactions, /payment-methods.
 */
export function WalletPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const { data: wallet, isLoading: loadingWallet, isError: walletError } = useWallet();
  const { data: transactions, isLoading: loadingTransactions } = useWalletTransactions();
  const { data: methods } = usePaymentMethods();

  const topUp = useTopUpWallet();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [amount, setAmount] = useState('');

  async function handleTopUp() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;

    const defaultMethod = methods?.find((m) => m.is_default) ?? methods?.[0];

    try {
      await topUp.mutateAsync({
        amount: value,
        ...(defaultMethod ? { methodId: defaultMethod.id } : {}),
      });
      setTopUpOpen(false);
      setAmount('');
      toast.success('Wallet topped up', formatCurrency(value, wallet?.currency_code));
    } catch (error) {
      toast.error(
        'Top-up failed',
        error instanceof ApiError ? error.userMessage : 'Please try again.',
      );
    }
  }

  return (
    <div className="min-h-full bg-surface pb-[calc(7rem+var(--safe-bottom))]">
      {/* ---- Header ---------------------------------------------------- */}
      <header className="flex items-center justify-between px-5 pb-1 pt-[calc(0.75rem+var(--safe-top))]">
        <span className="w-11" />
        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Wallet</h1>
        <IconButton label="Trip receipts" onClick={() => navigate('/rider/trips')}>
          <Receipt size={19} />
        </IconButton>
      </header>

      <div className="stagger">
        {/* ---- Balance ------------------------------------------------- */}
        <section className="px-5 pt-6">
          {loadingWallet ? (
            <Skeleton className="h-[11rem] rounded-[1.5rem]" />
          ) : walletError ? (
            <Card>
              <EmptyState
                tone="error"
                icon={<AlertTriangle size={22} />}
                title="Wallet unavailable"
                description="We couldn't reach the payments service."
              />
            </Card>
          ) : (
            <div className="edge-light relative overflow-hidden rounded-[1.5rem] brand-gradient px-6 pb-6 pt-6 shadow-brand-lg">
              {/* Faint concentric rings — the one decorative element */}
              <svg
                aria-hidden
                viewBox="0 0 200 200"
                className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 opacity-[0.14]"
              >
                <circle cx="100" cy="100" r="42" fill="none" stroke="white" strokeWidth="1.5" />
                <circle cx="100" cy="100" r="66" fill="none" stroke="white" strokeWidth="1.5" />
                <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="1.5" />
              </svg>

              <div className="relative">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-white/60">
                  Available balance
                </p>
                <p className="tabular mt-2 text-[2.375rem] font-bold leading-none tracking-[-0.04em] text-white">
                  {formatCurrency(wallet?.balance ?? 0, wallet?.currency_code)}
                </p>

                <button
                  type="button"
                  onClick={() => setTopUpOpen(true)}
                  className="pressable mt-5 inline-flex items-center gap-2 rounded-pill bg-white px-5 py-2.5 text-body-sm font-bold text-brand shadow-lifted"
                >
                  <Plus size={16} aria-hidden />
                  Add money
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ---- Payment methods ----------------------------------------- */}
        <section className="mt-4 px-5">
          <Card>
            <CardHeader
              title="Payment methods"
              description={methods?.length ? undefined : 'Nothing saved yet'}
            />

            {!methods || methods.length === 0 ? (
              <p className="text-body-sm leading-relaxed text-ink-muted">
                No cards saved yet. Add one at checkout to pay without topping up.
              </p>
            ) : (
              <ul className="space-y-2">
                {methods.map((method) => (
                  <li
                    key={method.id}
                    className="flex items-center gap-3 rounded-tile bg-surface px-4 py-3.5"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
                    >
                      <CreditCard size={17} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {method.brand ?? method.type}
                      </span>
                      {method.last_four && (
                        <span className="tabular mt-0.5 block text-caption text-ink-muted">
                          •••• {method.last_four}
                        </span>
                      )}
                    </span>

                    {method.is_default && (
                      <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-[0.6875rem] font-semibold text-brand-ink">
                        Default
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* ---- Transactions -------------------------------------------- */}
        <section className="mt-4 px-5">
          <Card padded={false}>
            <div className="p-5 pb-2">
              <CardHeader title="Recent activity" description="Top-ups, trips and refunds" />
            </div>

            {loadingTransactions ? (
              <div className="px-5 pb-5">
                <SkeletonList count={3} />
              </div>
            ) : !transactions?.items?.length ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={<WalletIcon size={22} />}
                  title="No activity yet"
                  description="Top-ups, ride charges and refunds will appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {transactions.items.map((transaction) => {
                  const credit = transaction.amount >= 0;

                  return (
                    <li
                      key={transaction.id}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                          credit ? 'bg-success-soft text-success' : 'bg-surface text-ink-muted',
                        )}
                      >
                        {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-ink">
                          {transaction.description ?? transaction.type}
                        </p>
                        <p className="mt-0.5 text-caption text-ink-subtle">
                          {formatDateTime(transaction.created_at)}
                        </p>
                      </div>

                      <p
                        className={cn(
                          'tabular shrink-0 text-body font-bold',
                          credit ? 'text-success-ink' : 'text-ink',
                        )}
                      >
                        {credit ? '+' : '−'}
                        {formatCurrency(Math.abs(transaction.amount), wallet?.currency_code)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {/* ---- Top-up --------------------------------------------------- */}
      <Modal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        title="Add money"
        description="Funds are available immediately after the payment clears."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTopUpOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={topUp.isPending}
              disabled={!amount || Number(amount) <= 0}
              onClick={() => void handleTopUp()}
            >
              Add {amount ? formatCurrency(Number(amount), wallet?.currency_code) : 'money'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className={cn(
                  'tabular rounded-tile border py-3 text-body-sm font-bold transition-all duration-200 ease-smooth',
                  Number(amount) === value
                    ? 'border-brand bg-brand/[0.06] text-brand-ink'
                    : 'border-line text-ink hover:border-line-strong hover:bg-surface',
                )}
              >
                {value}
              </button>
            ))}
          </div>

          <Input
            label="Or enter an amount"
            type="number"
            inputMode="decimal"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </Modal>
    </div>
  );
}
