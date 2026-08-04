import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

import { cn } from '@shared/lib/utils';
import { Button } from './Button';
import { ErrorArt, OfflineArt, SuccessArt } from './Illustration';

/**
 * The four states every data-backed screen needs.
 *
 * A screen that only handles "loaded with data" is unfinished — most of the
 * time a user spends waiting or recovering is spent in one of these.
 */

/* -------------------------------------------------------------------------- */
/* Empty                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Shown when a list is legitimately empty, or when a request failed.
 *
 * Pass `art` for a full illustration (preferred on a whole-screen empty) or
 * `icon` for the compact treatment used inside a card. `tone="error"` keeps
 * the copy calm — an error state that shouts is worse than one that explains
 * what to do next.
 */
export function EmptyState({
  art,
  icon,
  title,
  description,
  action,
  secondaryAction,
  tone = 'neutral',
  className,
}: {
  art?: ReactNode;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  tone?: 'neutral' | 'error';
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex animate-fade-up flex-col items-center px-6 text-center',
        art ? 'py-10' : 'py-14',
        className,
      )}
    >
      {art ? (
        <div className="mb-5">{art}</div>
      ) : icon ? (
        <span
          aria-hidden
          className={cn(
            'mb-4 grid h-14 w-14 place-items-center rounded-panel',
            tone === 'error' ? 'bg-danger-soft text-danger-ink' : 'bg-surface text-ink-muted',
          )}
        >
          {icon}
        </span>
      ) : null}

      <h3 className="text-h4 text-ink">{title}</h3>

      {description && (
        <p className="mt-2 max-w-prose text-body leading-relaxed text-ink-muted">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Error                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A failed request, with a way out.
 *
 * Always offers a retry. An error screen that only apologises leaves the user
 * with nothing to do but leave.
 */
export function ErrorState({
  title = "That didn't work",
  description = 'Something went wrong on our side. Try again in a moment.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      tone="error"
      art={<ErrorArt />}
      title={title}
      description={description}
      className={className}
      action={
        onRetry && (
          <Button variant="secondary" leadingIcon={<RefreshCw size={16} />} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Success                                                                    */
/* -------------------------------------------------------------------------- */

export function SuccessState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      art={<SuccessArt />}
      title={title}
      description={description ?? ''}
      action={action}
      className={className}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Offline                                                                    */
/* -------------------------------------------------------------------------- */

/** True when the browser reports no network. Updates live. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);

    window.addEventListener('online', up);
    window.addEventListener('offline', down);

    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}

/**
 * Full-screen offline state — for when a screen has no cached content to show.
 */
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      art={<OfflineArt />}
      title="You're offline"
      description="Check your connection. Your trips and wallet will load as soon as you're back."
      action={
        onRetry && (
          <Button variant="secondary" leadingIcon={<RefreshCw size={16} />} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  );
}

/**
 * A slim banner that appears at the top of the app when the network drops.
 *
 * Preferred over the full-screen state when the screen already has content
 * worth reading — pulling a populated list out from under someone because
 * their signal dipped in a lift is hostile.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      className={cn(
        'fixed inset-x-0 top-0 z-[100] animate-fade-down',
        'flex items-center justify-center gap-2 px-4',
        'bg-warning py-2 text-micro font-semibold text-black/85',
        'pt-[max(0.5rem,var(--safe-top))]',
      )}
    >
      <WifiOff size={13} aria-hidden />
      No connection — showing the last saved data
    </div>
  );
}
