import { Link } from 'react-router-dom';

import { env } from '@shared/config/env';
import { cn } from '@shared/lib/utils';

/**
 * The AC7 GROUP lockup.
 *
 * The mark and wordmark are one link, not two adjacent ones. Two links to the
 * same place next to each other are announced twice by a screen reader and
 * double the tab stops for no benefit — so the mark is aria-hidden and the
 * accessible name comes from the text.
 */
export function Logo({
  showMeaning = false,
  className,
}: {
  showMeaning?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-2.5', className)}
      aria-label={`${env.company.name} — home`}
    >
      <span
        aria-hidden
        className="brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-xl text-body-sm font-bold text-white shadow-brand transition-transform duration-300 ease-smooth group-hover:scale-105"
      >
        A7
      </span>

      <span className="leading-tight">
        <span className="block text-body font-semibold tracking-tight text-ink">
          {env.company.name}
        </span>
        {showMeaning && (
          <span className="block text-micro font-medium text-brand-ink">
            {env.company.meaning}
          </span>
        )}
      </span>
    </Link>
  );
}
