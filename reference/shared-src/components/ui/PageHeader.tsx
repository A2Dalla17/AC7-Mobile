import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@shared/lib/utils';
import { IconButton } from './Button';

/**
 * Headers.
 *
 *   ScreenHeader  mobile. Back arrow, centred title, one trailing action.
 *   PageHeader    desktop/admin. Left-aligned title, description, actions.
 *   SectionHeader either. A heading within a page.
 *
 * ScreenHeader exists because the same three-part flex row was written by hand
 * on twelve screens, each with slightly different padding — which is why the
 * titles used to shift by a pixel or two as you moved between them.
 */

/* -------------------------------------------------------------------------- */

export function ScreenHeader({
  title,
  subtitle,
  /** Defaults to navigate(-1). Pass `false` to omit the back button. */
  onBack,
  trailing,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: (() => void) | false;
  trailing?: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const showBack = onBack !== false;

  return (
    <header
      className={cn(
        'flex items-center justify-between gap-3 px-gutter pb-1 pt-[calc(0.75rem+var(--safe-top))]',
        className,
      )}
    >
      {showBack ? (
        <IconButton
          label="Go back"
          tone="plain"
          onClick={onBack ?? (() => navigate(-1))}
        >
          <ArrowLeft size={20} />
        </IconButton>
      ) : (
        /* Keeps the title optically centred when there is no back button. */
        <span aria-hidden className="w-11 shrink-0" />
      )}

      <div className="min-w-0 flex-1 text-center">
        <h1 className="truncate text-h5 text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-micro text-ink-subtle">{subtitle}</p>}
      </div>

      {trailing ?? <span aria-hidden className="w-11 shrink-0" />}
    </header>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Consistent page heading. Every admin and settings screen uses this so the
 * vertical rhythm never drifts between pages.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-h2 text-ink">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-body leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Section heading used inside a page, below PageHeader or a ScreenHeader. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-h4 text-ink">{title}</h2>
        {description && <p className="mt-1 text-body-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
