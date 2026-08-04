import { Check, Users, Zap } from 'lucide-react';

import { cn, formatCurrency, formatDuration } from '@shared/lib/utils';

/**
 * A selectable vehicle tier on the booking sheet.
 *
 * Laid out as a row rather than a grid of cards: tiers are compared on price
 * and ETA, and columns of numbers are only comparable when they are stacked
 * and left-aligned. A card grid makes the eye travel in two dimensions to
 * answer a one-dimensional question.
 *
 * Selection is shown by a border, a tint and a tick — three signals, because
 * on a bright phone screen outdoors a border alone disappears.
 */
export function VehicleOption({
  name,
  description,
  seats,
  fare,
  currency,
  etaSeconds,
  surge,
  icon,
  selected,
  onSelect,
  disabled = false,
}: {
  name: string;
  description?: string;
  seats?: number;
  fare: number;
  currency?: string;
  etaSeconds?: number | null;
  /** Multiplier above 1 shows the surge flag. */
  surge?: number;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const surging = (surge ?? 1) > 1;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-tile border p-3.5 text-left',
        'transition-all duration-base ease-smooth',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-brand-ink bg-brand-soft shadow-xs'
          : 'border-line bg-card hover:border-line-strong',
      )}
    >
      {/* Vehicle mark */}
      <span
        aria-hidden
        className={cn(
          'grid h-12 w-12 shrink-0 place-items-center rounded-tile transition-colors',
          selected ? 'bg-brand text-white' : 'bg-surface text-ink-muted',
        )}
      >
        {icon ?? <CarGlyph />}
      </span>

      {/* Name + meta */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-semibold text-ink">{name}</span>
          {seats != null && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-micro text-ink-subtle">
              <Users size={11} aria-hidden />
              {seats}
            </span>
          )}
        </span>

        <span className="mt-0.5 flex items-center gap-2">
          {etaSeconds != null && (
            <span className="text-caption text-ink-muted">{formatDuration(etaSeconds)} away</span>
          )}
          {description && !etaSeconds && (
            <span className="truncate text-caption text-ink-muted">{description}</span>
          )}
          {surging && (
            <span className="inline-flex items-center gap-0.5 rounded-pill bg-warning-soft px-1.5 py-0.5 text-[0.625rem] font-bold text-warning-ink">
              <Zap size={9} aria-hidden />
              {surge!.toFixed(1)}×
            </span>
          )}
        </span>
      </span>

      {/* Price */}
      <span className="flex shrink-0 items-center gap-2.5">
        <span className="tabular text-amount text-ink">{formatCurrency(fare, currency)}</span>

        <span
          aria-hidden
          className={cn(
            'grid h-5 w-5 place-items-center rounded-full transition-all duration-base ease-spring',
            selected ? 'scale-100 bg-brand text-white' : 'scale-0 bg-transparent',
          )}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </span>
    </button>
  );
}

/** Default vehicle mark — a simple saloon silhouette. */
function CarGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 17v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2m8 0v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3 17v-4.2a2 2 0 0 1 1.4-1.9L6.5 10l1.9-3.4A2 2 0 0 1 10.1 5.6h3.8a2 2 0 0 1 1.7 1L17.5 10l2.1.9a2 2 0 0 1 1.4 1.9V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M6.5 10h11" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="14" r="1" fill="currentColor" />
      <circle cx="17" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}
