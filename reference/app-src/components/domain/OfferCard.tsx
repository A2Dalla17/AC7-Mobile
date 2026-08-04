import { Check, Copy, Ticket } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@shared/lib/utils';

/**
 * Promotion and coupon cards.
 *
 * The notch is the point. A rectangle with a dashed line reads as a form
 * field; two circular bites out of the sides read as a torn ticket, and people
 * recognise that shape before they read a word of it. The notches are cut with
 * a radial-gradient mask so they take the page background automatically rather
 * than needing a hard-coded fill.
 */

export function CouponCard({
  code,
  title,
  description,
  expiry,
  disabled = false,
  onApply,
  className,
}: {
  code: string;
  title: string;
  description?: string;
  expiry?: string;
  disabled?: boolean;
  onApply?: (code: string) => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
    onApply?.(code);
  }

  return (
    <div
      className={cn(
        'relative flex overflow-hidden rounded-card border border-line bg-card shadow-card',
        disabled && 'opacity-55',
        className,
      )}
    >
      {/* Stub */}
      <div className="grid w-[4.5rem] shrink-0 place-items-center brand-gradient text-white">
        <Ticket size={22} aria-hidden />
      </div>

      {/* Perforation — two notches plus a dashed rule */}
      <span
        aria-hidden
        className="absolute left-[4.5rem] top-0 h-full w-0 border-l border-dashed border-line-strong"
      />
      <span
        aria-hidden
        className="absolute -top-2 left-[4.5rem] h-4 w-4 -translate-x-1/2 rounded-full bg-surface"
      />
      <span
        aria-hidden
        className="absolute -bottom-2 left-[4.5rem] h-4 w-4 -translate-x-1/2 rounded-full bg-surface"
      />

      {/* Body */}
      <div className="min-w-0 flex-1 p-4">
        <p className="truncate text-body font-semibold text-ink">{title}</p>

        {description && (
          <p className="clamp-2 mt-0.5 text-caption leading-relaxed text-ink-muted">
            {description}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <code className="tabular rounded-chip border border-dashed border-line-strong bg-surface px-2 py-1 text-micro font-bold tracking-wider text-ink">
            {code}
          </code>

          {!disabled && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 text-micro font-semibold text-brand-ink transition-opacity hover:opacity-75"
            >
              {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>

        {expiry && <p className="mt-2 text-[0.6875rem] text-ink-subtle">{expiry}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A wide promotional banner for the top of the home screen.
 *
 * Deliberately not a coupon: promos are browsed, coupons are redeemed, and
 * giving them the same shape teaches people to ignore both.
 */
export function PromoBanner({
  eyebrow,
  title,
  body,
  art,
  onClick,
  className,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  art?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'edge-light relative w-full overflow-hidden rounded-panel brand-gradient p-5 text-left text-white shadow-brand',
        onClick && 'liftable',
        className,
      )}
    >
      <div className="relative max-w-[70%]">
        {eyebrow && <p className="text-overline uppercase text-white/60">{eyebrow}</p>}
        <p className="mt-1.5 text-h4 text-white">{title}</p>
        {body && <p className="mt-1 text-caption leading-relaxed text-white/75">{body}</p>}
      </div>

      {art && (
        <div aria-hidden className="pointer-events-none absolute -bottom-2 right-2 opacity-90">
          {art}
        </div>
      )}
    </Tag>
  );
}
