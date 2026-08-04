import { Banknote, Check, CreditCard, Smartphone, Wallet } from 'lucide-react';

import { cn } from '@shared/lib/utils';

/**
 * A payment method in a list or a picker.
 *
 * The brand mark is derived from the method type rather than shipping card-
 * network logos — those are trademarked, they need licensing to redistribute,
 * and a generic mark plus the last four digits is what people actually use to
 * tell their cards apart anyway.
 */

type MethodType = 'card' | 'cash' | 'wallet' | 'mobile_money';

const MARKS: Record<MethodType, { icon: React.ReactNode; tint: string }> = {
  card: { icon: <CreditCard size={18} />, tint: 'bg-info-soft text-info-ink' },
  cash: { icon: <Banknote size={18} />, tint: 'bg-success-soft text-success-ink' },
  wallet: { icon: <Wallet size={18} />, tint: 'bg-brand-soft text-brand-ink' },
  mobile_money: { icon: <Smartphone size={18} />, tint: 'bg-warning-soft text-warning-ink' },
};

function normalise(type: string): MethodType {
  const t = type.toLowerCase();
  if (t.includes('cash')) return 'cash';
  if (t.includes('wallet') || t.includes('balance')) return 'wallet';
  if (t.includes('mobile') || t.includes('evc') || t.includes('zaad')) return 'mobile_money';
  return 'card';
}

export function PaymentMethodRow({
  type,
  label,
  lastFour,
  isDefault = false,
  selected,
  onSelect,
  className,
}: {
  type: string;
  label: string;
  lastFour?: string | null;
  isDefault?: boolean;
  /** Omit both `selected` and `onSelect` to render as a static list row. */
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const mark = MARKS[normalise(type)];
  const selectable = onSelect !== undefined;

  const content = (
    <>
      <span aria-hidden className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', mark.tint)}>
        {mark.icon}
      </span>

      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-body font-medium text-ink">{label}</span>
        {lastFour && (
          <span className="tabular mt-0.5 block text-caption text-ink-muted">•••• {lastFour}</span>
        )}
      </span>

      {isDefault && !selectable && (
        <span className="shrink-0 rounded-pill bg-brand-soft px-2.5 py-1 text-[0.6875rem] font-semibold text-brand-ink">
          Default
        </span>
      )}

      {selectable && (
        <span
          aria-hidden
          className={cn(
            'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all duration-base ease-spring',
            selected ? 'border-brand bg-brand text-white' : 'border-line-strong',
          )}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </span>
      )}
    </>
  );

  const classes = cn(
    'flex w-full items-center gap-3 rounded-tile px-4 py-3.5 transition-all duration-base ease-smooth',
    selectable
      ? selected
        ? 'border border-brand-ink bg-brand-soft'
        : 'border border-line bg-card hover:border-line-strong'
      : 'bg-surface',
    className,
  );

  return selectable ? (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={classes}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}
