import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

/**
 * Card.
 *
 * Four tones, each for a different relationship to the page:
 *
 *   flat     sits on the surface. Grouping only, no elevation implied.
 *   raised   lifts off it. The default — most content lives here.
 *   glass    floats over a map. Frosted so the map stays partly readable.
 *   brand    the hero panel. Deep red gradient, white content.
 *
 * `interactive` adds the hover lift and press. Only pass it when the whole
 * card is a link or button — a lift on something unclickable is a lie.
 */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'flat' | 'raised' | 'glass' | 'brand';
  padded?: boolean;
  interactive?: boolean;
}

export function Card({
  tone = 'raised',
  padded = true,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card',
        tone === 'flat' && 'border border-line bg-card',
        tone === 'raised' && 'border border-line bg-card shadow-card',
        tone === 'glass' && 'glass border border-line shadow-lifted',
        tone === 'brand' && 'edge-light brand-gradient text-white shadow-brand-lg',
        interactive && 'liftable cursor-pointer',
        padded && 'p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-h4 text-ink">{title}</h3>
        {description && <p className="mt-1 text-body-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A row inside a card — settings, menus, link lists.
 *
 * This exists because the same row markup was being hand-written on six
 * screens with slightly different padding each time.
 */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  tone = 'default',
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 px-5 py-4 text-left',
        'transition-colors duration-quick',
        tone === 'danger' ? 'hover:bg-danger-soft' : 'hover:bg-surface',
        className,
      )}
      {...rest}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-full',
            tone === 'danger' ? 'bg-danger-soft text-danger-ink' : 'bg-brand-soft text-brand-ink',
          )}
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-body font-medium',
            tone === 'danger' ? 'text-danger-ink' : 'text-ink',
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-caption text-ink-muted">{subtitle}</span>
        )}
      </span>

      {trailing && <span className="shrink-0">{trailing}</span>}
    </div>
  );
}
