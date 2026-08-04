import type { ReactNode } from 'react';
import { MessageCircle, Phone, ShieldCheck } from 'lucide-react';

import { Avatar } from '@shared/components/ui/Avatar';
import { IconButton } from '@shared/components/ui/Button';
import { RatingStars } from '@shared/components/ui/Rating';
import { cn, initials } from '@shared/lib/utils';

/**
 * The assigned driver, shown while a trip is live.
 *
 * Call and message sit as large circular targets on the right, because they
 * are pressed in exactly one situation — the driver cannot find you — and that
 * situation is stressful and one-handed. They are never buried in a menu.
 *
 * The plate is rendered in tabular figures at high contrast so it can be read
 * at a glance against a real car across a street.
 */
export function DriverCard({
  name,
  photo,
  rating,
  ratingCount,
  vehicle,
  plate,
  verified = false,
  onCall,
  onMessage,
  trailing,
  className,
}: {
  name: string;
  photo?: string | null;
  rating?: number | null;
  ratingCount?: number;
  vehicle?: string | null;
  plate?: string | null;
  verified?: boolean;
  onCall?: () => void;
  onMessage?: () => void;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <div className="relative shrink-0">
        <Avatar
          size="lg"
          src={photo ?? undefined}
          initials={initials({ first_name: name.split(' ')[0], last_name: name.split(' ')[1] })}
        />
        {verified && (
          <span
            aria-label="Verified driver"
            className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-success text-white ring-2 ring-bg"
          >
            <ShieldCheck size={11} aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg font-semibold text-ink">{name}</p>

        {rating != null && (
          <RatingStars value={rating} showValue count={ratingCount} className="mt-0.5" />
        )}

        {(vehicle || plate) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {vehicle && <span className="truncate text-caption text-ink-muted">{vehicle}</span>}
            {plate && (
              <span className="tabular rounded-chip border border-line-strong bg-surface px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-ink">
                {plate}
              </span>
            )}
          </p>
        )}
      </div>

      {(onCall || onMessage || trailing) && (
        <div className="flex shrink-0 items-center gap-2">
          {onMessage && (
            <IconButton label={`Message ${name}`} onClick={onMessage}>
              <MessageCircle size={18} />
            </IconButton>
          )}
          {onCall && (
            <IconButton label={`Call ${name}`} tone="brand" onClick={onCall}>
              <Phone size={18} />
            </IconButton>
          )}
          {trailing}
        </div>
      )}
    </div>
  );
}
