import type { ReactNode } from 'react';

import { cn, formatCurrency } from '@shared/lib/utils';

/**
 * The brand hero panel used for a wallet balance or an earnings total.
 *
 * One per screen, always. Its whole job is to be the first thing read, and two
 * of them on a screen means neither is.
 *
 * The faint geometry is drawn, not imported: concentric rings for money,
 * a road arc for earnings. Both sit at ~14% opacity — enough to give the
 * panel depth, not enough to compete with the figure.
 */
export function BalanceCard({
  label,
  amount,
  currency,
  caption,
  action,
  motif = 'rings',
  className,
}: {
  label: string;
  amount: number;
  currency?: string;
  /** A pill under the amount — "still clearing", "+12% vs last week". */
  caption?: ReactNode;
  action?: ReactNode;
  motif?: 'rings' | 'road' | 'none';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'edge-light relative overflow-hidden rounded-panel brand-gradient px-6 pb-6 pt-6 shadow-brand-lg',
        className,
      )}
    >
      {motif === 'rings' && <RingMotif />}
      {motif === 'road' && <RoadMotif />}

      <div className="relative">
        <p className="text-overline uppercase text-white/60">{label}</p>

        <p className="tabular mt-2 text-amount-xl text-white">{formatCurrency(amount, currency)}</p>

        {caption && <div className="mt-3">{caption}</div>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** A pill for use inside BalanceCard's `caption`. */
export function BalanceCaption({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1.5 text-micro text-white/85 backdrop-blur-sm">
      {icon}
      {children}
    </p>
  );
}

/* -------------------------------------------------------------------------- */

function RingMotif() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 opacity-[0.14]"
    >
      <circle cx="100" cy="100" r="42" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="66" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

function RoadMotif() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 420 220"
      preserveAspectRatio="xMaxYMax slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
    >
      <path
        d="M-40 190 Q 130 120 230 158 T 460 88"
        fill="none"
        stroke="white"
        strokeWidth="26"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The stat strip that overlaps the bottom of a BalanceCard.
 *
 * The overlap is deliberate: it ties the two together into one object and
 * stops the strip reading as an unrelated row of numbers below it.
 */
export function StatStrip({
  stats,
  className,
}: {
  stats: ReadonlyArray<{ label: string; value: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'edge-light relative -mt-10 grid divide-x divide-line rounded-panel',
        'border border-line bg-card py-4 shadow-lifted',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="px-2 text-center">
          <p className="tabular truncate text-body-lg font-bold tracking-[-0.02em] text-ink">
            {stat.value}
          </p>
          <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-ink-subtle">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
