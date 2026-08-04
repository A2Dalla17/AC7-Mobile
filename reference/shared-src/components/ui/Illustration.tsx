import { cn } from '@shared/lib/utils';

/**
 * Empty-state illustrations.
 *
 * Hand-drawn as inline SVG rather than pulled from an illustration pack, for
 * three reasons: they inherit the brand colour through `currentColor` so they
 * flip with the theme for free, they add nothing to the bundle beyond their
 * own markup, and a stock illustration set is the fastest way to make an app
 * look like six other apps.
 *
 * Each one is drawn on a 200×140 canvas with a consistent stroke weight, so
 * they read as a family rather than a collection.
 */

type Props = { className?: string };

const CANVAS = 'h-32 w-auto';

/** Shared ground line — grounds every illustration at the same height. */
function Ground() {
  return (
    <line
      x1="24"
      y1="118"
      x2="176"
      y2="118"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-line-strong"
      strokeDasharray="6 8"
    />
  );
}

/* -------------------------------------------------------------------------- */

/** No trips yet — a car on an empty road. */
export function NoTripsArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <Ground />
      <g className="text-brand-ink">
        {/* body */}
        <path
          d="M56 100h88a8 8 0 0 0 8-8V78a8 8 0 0 0-5.6-7.6L134 66l-12-15a10 10 0 0 0-8-4H86a10 10 0 0 0-8 4L66 66l-12.4 4.4A8 8 0 0 0 48 78v14a8 8 0 0 0 8 8Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* windows */}
        <path d="M84 51h32l9 14H75l9-14Z" fill="currentColor" fillOpacity="0.12" />
        <path d="M100 51v14" stroke="currentColor" strokeWidth="2" />
      </g>
      {/* wheels */}
      <circle cx="70" cy="100" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink" />
      <circle cx="130" cy="100" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink" />
    </svg>
  );
}

/** No saved places — a map pin over a folded map. */
export function NoPlacesArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <Ground />
      {/* folded map */}
      <g className="text-line-strong">
        <path
          d="M52 96V50l24-10 24 10 24-10 24 10v46l-24 10-24-10-24 10-24-10Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M76 40v56M124 40v56" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
      </g>
      {/* pin */}
      <g className="text-brand-ink">
        <path
          d="M100 26c-9.4 0-17 7.4-17 16.6 0 12 17 26.4 17 26.4s17-14.4 17-26.4C117 33.4 109.4 26 100 26Z"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <circle cx="100" cy="43" r="5.5" fill="currentColor" />
      </g>
    </svg>
  );
}

/** Nothing in the wallet — a card with a coin. */
export function NoWalletArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <Ground />
      <g className="text-brand-ink">
        <rect
          x="46"
          y="42"
          width="108"
          height="66"
          rx="12"
          fill="currentColor"
          fillOpacity="0.08"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M46 64h108" stroke="currentColor" strokeWidth="2.5" />
        <rect x="60" y="80" width="30" height="7" rx="3.5" fill="currentColor" fillOpacity="0.35" />
      </g>
      <g className="text-warning-ink">
        <circle cx="140" cy="88" r="17" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M140 80v16M135.5 84h7a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 0 0 7h7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** Nothing to notify — a bell at rest. */
export function NoNotificationsArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <Ground />
      <g className="text-brand-ink">
        <path
          d="M100 30a26 26 0 0 0-26 26v18l-9 14a3 3 0 0 0 2.6 4.6h64.8A3 3 0 0 0 135 88l-9-14V56a26 26 0 0 0-26-26Z"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M89 96a11 11 0 0 0 22 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="26" r="4" fill="currentColor" />
      </g>
      {/* silence marks */}
      <g className="text-line-strong">
        <path d="M148 52c4 6 4 14 0 20M56 52c-4 6-4 14 0 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Search found nothing. */
export function NoResultsArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <Ground />
      <g className="text-brand-ink">
        <circle
          cx="92"
          cy="62"
          r="30"
          fill="currentColor"
          fillOpacity="0.08"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M114 84l20 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path
        d="M82 62h20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-ink-subtle"
      />
    </svg>
  );
}

/** Connection lost. */
export function OfflineArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <Ground />
      <g className="text-ink-subtle">
        <path d="M58 62a60 60 0 0 1 84 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M74 78a38 38 0 0 1 52 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="96" r="6" fill="currentColor" className="text-ink-subtle" />
      {/* the slash */}
      <path
        d="M62 40l76 68"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="text-danger-ink"
      />
    </svg>
  );
}

/** Something broke. */
export function ErrorArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <Ground />
      <g className="text-danger-ink">
        <path
          d="M100 32 156 104H44L100 32Z"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M100 62v22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="100" cy="94" r="3" fill="currentColor" />
      </g>
    </svg>
  );
}

/** Done. Pairs with the draw-check animation. */
export function SuccessArt({ className }: Props) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={cn(CANVAS, className)} aria-hidden>
      <g className="text-success-ink">
        <circle
          cx="100"
          cy="70"
          r="40"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M82 70l12 12 24-24"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          className="animate-draw-check"
        />
      </g>
    </svg>
  );
}
