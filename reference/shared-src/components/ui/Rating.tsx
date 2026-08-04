import { useState } from 'react';
import { Star } from 'lucide-react';

import { cn } from '@shared/lib/utils';

/**
 * Star rating — read-only display and interactive input.
 *
 * The interactive variant is deliberately large (44px targets) and previews on
 * hover, because it is shown at the end of a trip when the phone is usually
 * being held one-handed on the way out of a car.
 */

const SIZES = { sm: 13, md: 17, lg: 32 } as const;

/** Read-only. Renders a half star where the average warrants it. */
export function RatingStars({
  value,
  size = 'sm',
  showValue = false,
  count,
  className,
}: {
  value: number;
  size?: keyof typeof SIZES;
  showValue?: boolean;
  /** Number of ratings behind the average, e.g. "4.92 (318)". */
  count?: number;
  className?: string;
}) {
  const px = SIZES[size];

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="inline-flex" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));

          return (
            <span key={i} className="relative">
              <Star size={px} className="text-line-strong" strokeWidth={1.5} />
              {fill > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star size={px} className="fill-warning text-warning" strokeWidth={1.5} />
                </span>
              )}
            </span>
          );
        })}
      </span>

      {showValue && (
        <span className="tabular text-caption font-semibold text-ink">
          {value.toFixed(2)}
          {count !== undefined && (
            <span className="ml-1 font-normal text-ink-subtle">({count})</span>
          )}
        </span>
      )}

      <span className="sr-only">
        {value.toFixed(1)} out of 5{count !== undefined && ` from ${count} ratings`}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/** Interactive. Fires `onChange` on click; previews on hover and focus. */
export function RatingInput({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [preview, setPreview] = useState(0);
  const shown = preview || value;

  return (
    <div
      role="radiogroup"
      aria-label="Rate this trip"
      className={cn('inline-flex gap-1', className)}
      onMouseLeave={() => setPreview(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setPreview(star)}
          onFocus={() => setPreview(star)}
          onBlur={() => setPreview(0)}
          className={cn(
            'grid h-12 w-12 place-items-center rounded-full',
            'transition-transform duration-quick ease-spring',
            'hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100',
          )}
        >
          <Star
            size={SIZES.lg}
            strokeWidth={1.5}
            className={cn(
              'transition-colors duration-quick',
              star <= shown ? 'fill-warning text-warning' : 'text-line-strong',
            )}
          />
        </button>
      ))}
    </div>
  );
}
