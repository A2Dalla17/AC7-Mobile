import { cn } from '@shared/lib/utils';

/**
 * Segmented control — the pill of tabs used for Daily/Weekly/Monthly,
 * trip filters and date ranges.
 *
 * Two shapes for two jobs:
 *
 *   SegmentedControl  fixed set, equal widths, one visible at a time.
 *                     Use when the options are exhaustive (a period picker).
 *   FilterChips       scrollable rail. Use when the set can grow or the
 *                     labels vary in length (statuses, categories).
 *
 * Reaching for the wrong one is the usual cause of a squashed four-column
 * segmented control with truncated labels.
 */

export interface Segment<T extends string> {
  id: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  className,
}: {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex rounded-pill border border-line bg-card p-1 shadow-xs', className)}
    >
      {segments.map((segment) => {
        const active = segment.id === value;

        return (
          <button
            key={segment.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(segment.id)}
            className={cn(
              'flex-1 rounded-pill py-2.5 text-body-sm font-semibold',
              'transition-all duration-base ease-smooth',
              active
                ? 'brand-gradient text-white shadow-brand'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function FilterChips<T extends string>({
  segments,
  value,
  onChange,
  label,
  className,
}: {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('scrollbar-none flex gap-2 overflow-x-auto pb-1', className)}
    >
      {segments.map((segment) => {
        const active = segment.id === value;

        return (
          <button
            key={segment.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(segment.id)}
            className={cn(
              'shrink-0 rounded-pill border px-4 py-2 text-caption font-semibold',
              'transition-all duration-base ease-smooth',
              active
                ? 'border-transparent brand-gradient text-white shadow-brand'
                : 'border-line bg-card text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
