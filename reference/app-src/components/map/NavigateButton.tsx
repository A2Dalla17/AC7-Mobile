import { useState } from 'react';
import { ExternalLink, Navigation, X } from 'lucide-react';

import type { LatLng } from '@shared/api/types';
import { env } from '@shared/config/env';
import { cn, googleMapsNavLink, wazeLink } from '@shared/lib/utils';

/**
 * Turn-by-turn handoff for drivers.
 *
 * Navigation is deliberately not built in-app. Drivers already trust Waze and
 * Google Maps, know their voice prompts, and have them configured. Rebuilding
 * that badly would be worse than handing off — so this opens whichever app the
 * driver prefers, with the destination pre-filled.
 *
 * Both are plain deep links: no API key, no SDK, no cost. That matters more
 * than it sounds: navigation is the single most-used feature in the driver
 * app, and putting it on a billed API would be the most expensive possible
 * place to spend the Maps budget.
 *
 * ── Why the choice is remembered ───────────────────────────────────────────
 * A driver picks their navigation app once and then never changes it. Asking
 * every single time turns a one-tap action into two, on a phone clamped to a
 * windscreen, while a rider waits. After the first choice this opens straight
 * into their app; the picker is still reachable by long-pressing, so the
 * decision is never locked in.
 */

const PREFERENCE_KEY = 'act.driver.navApp';

type NavApp = 'waze' | 'google';

function readPreference(): NavApp | null {
  try {
    const stored = localStorage.getItem(PREFERENCE_KEY);
    return stored === 'waze' || stored === 'google' ? stored : null;
  } catch {
    /* Storage unavailable. The picker simply appears every time, which is the
       old behaviour — inconvenient, never broken. */
    return null;
  }
}

function writePreference(app: NavApp): void {
  try {
    localStorage.setItem(PREFERENCE_KEY, app);
  } catch {
    /* See above. */
  }
}

export function NavigateButton({
  destination,
  label = 'Navigate',
  compact = false,
  className,
}: {
  destination: LatLng;
  label?: string;
  /** Icon-sized, for lists and cards where a full-width button does not fit. */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preferred, setPreferred] = useState<NavApp | null>(readPreference);

  /*
   * Waze only, on purpose.
   *
   * The picker used to offer Google Maps as well. Two taps to start driving is
   * one too many when a rider is already waiting, and a driver picks one app
   * and never changes it — so the chooser was pure friction for everybody
   * after their first trip. Waze is what AC7's drivers use, so Waze is what
   * the button does: one tap, straight into turn-by-turn.
   *
   * `env.features.waze` can still switch it off, and googleMapsNavLink() is
   * kept in lib/utils for the day a driver asks for the alternative back.
   */
  const options = env.features.waze
    ? [
        {
          id: 'waze',
          name: 'Waze',
          hint: 'Live police, hazards and traffic',
          href: wazeLink(destination),
          colour: '#33CCFF',
        },
      ]
    : [
        {
          id: 'google',
          name: 'Google Maps',
          hint: 'Lane guidance and offline maps',
          href: googleMapsNavLink(destination),
          colour: '#4285F4',
        },
      ];

  /* Only one app available, or the driver has already chosen: go straight
     there. Long-press still opens the picker so the choice can be changed. */
  const direct = options.length === 1 ? options[0] : options.find((o) => o.id === preferred);

  const shell = compact
    ? cn(
        'pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill',
        'border border-brand-ink/30 text-brand-ink transition-colors hover:bg-brand-soft',
        className,
      )
    : cn(
        'pressable inline-flex h-14 items-center justify-center gap-2.5 rounded-pill',
        'brand-gradient px-7 text-body font-semibold text-white shadow-brand',
        className,
      );

  if (direct) {
    return (
      <a
        href={direct.href}
        target="_blank"
        rel="noopener noreferrer"
        /* Long-press reopens the picker. `preventDefault` stops the browser's
           own context menu, which on a phone otherwise covers the screen with
           "Open in new tab" while the driver is trying to change apps. */
        onContextMenu={(e) => {
          if (options.length > 1) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={compact ? `${label} with ${direct.name}` : undefined}
        title={options.length > 1 ? `${direct.name} — press and hold to change` : direct.name}
        className={shell}
      >
        <Navigation size={compact ? 17 : 18} aria-hidden />
        {!compact && label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={compact ? label : undefined}
        className={shell}
      >
        <Navigation size={compact ? 17 : 18} aria-hidden />
        {!compact && label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a navigation app"
            className="relative w-full max-w-sm animate-sheet-up rounded-t-sheet bg-bg p-5 pb-[max(1.25rem,var(--safe-bottom))] shadow-sheet sm:animate-scale-in sm:rounded-sheet sm:pb-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h4 text-ink">Open in</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-card hover:text-ink"
              >
                <X size={17} />
              </button>
            </div>

            <ul className="space-y-2">
              {options.map((o) => (
                <li key={o.id}>
                  <a
                    href={o.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      /* Remembered on use rather than behind a "set as
                         default" checkbox nobody ticks. What a driver opens
                         is what they want. */
                      writePreference(o.id as NavApp);
                      setPreferred(o.id as NavApp);
                      setOpen(false);
                    }}
                    className="pressable flex items-center gap-3.5 rounded-tile border border-line bg-card p-4 transition-colors hover:border-line-strong"
                  >
                    <span
                      aria-hidden
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-tile text-white"
                      style={{ background: o.colour }}
                    >
                      <Navigation size={19} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{o.name}</span>
                      <span className="block text-caption text-ink-muted">{o.hint}</span>
                    </span>

                    <ExternalLink size={16} className="shrink-0 text-ink-subtle" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-center text-micro leading-relaxed text-ink-subtle">
              The destination is passed through automatically. Nothing to type.
              <br />
              We&rsquo;ll remember your choice — press and hold Navigate to change it.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
