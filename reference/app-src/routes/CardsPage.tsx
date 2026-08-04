import { useState } from 'react';
import { Printer, Scissors } from 'lucide-react';

import { QrCode } from '@shared/components/ui/QrCode';
import { env } from '@shared/config/env';

/**
 * Printable cards to hand out in the street.
 *
 * Ten business cards on one A4 sheet: scan the code, the taxi app opens.
 *
 * ── Why the sizes are in millimetres ───────────────────────────────────────
 * This is the one screen whose output is measured with a ruler rather than
 * viewed. Pixels do not survive a printer — a card laid out at 320px lands at
 * whatever size the print dialogue decides. 85×55mm is the standard business
 * card, so it fits a wallet, a card holder and every guillotine in every print
 * shop. Ten of them tile an A4 sheet with room for the cut lines.
 *
 * ── Why the QR carries the full URL ────────────────────────────────────────
 * A phone's camera app recognises a URL and offers to open it. A QR containing
 * just "AC7" would show somebody a meaningless string. This is the whole point
 * of the card, so it is the one thing that must not be clever.
 *
 * ── Error correction level H ───────────────────────────────────────────────
 * A card carried in a pocket gets creased, wet and scuffed. Level H survives
 * roughly 30% of the symbol being unreadable. For a code printed once and
 * handed to a stranger, that redundancy is worth the denser pattern.
 */

const CARDS_PER_SHEET = 10;

export function CardsPage() {
  /* Read at render rather than hard-coded: printing from a preview deploy
     would otherwise produce cards pointing at production, or the reverse,
     and nobody would notice until a hundred were printed. */
  const appUrl = typeof window === 'undefined' ? '' : window.location.origin;
  const [copies, setCopies] = useState(CARDS_PER_SHEET);

  return (
    <div className="min-h-screen bg-surface">
      {/* Controls. Hidden on paper — printing the toolbar would waste a card. */}
      <div className="no-print border-b border-line bg-card px-gutter py-5">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-h3 text-ink">Street cards</h1>
            <p className="mt-1 text-body-sm text-ink-muted">
              Print, cut along the lines, hand them out. Scanning opens the app.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-body-sm text-ink-muted">
              Cards
              <select
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
                className="ml-2 h-10 rounded-control border border-line bg-bg px-2.5 text-body text-ink"
              >
                {[2, 4, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => window.print()}
              className="brand-gradient inline-flex h-11 items-center gap-2 rounded-control px-5 text-body font-semibold text-white"
            >
              <Printer size={17} aria-hidden />
              Print
            </button>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-3xl rounded-tile bg-surface px-4 py-3 text-caption leading-relaxed text-ink-muted">
          <strong className="text-ink">Before printing:</strong> in the print dialogue set
          paper to <strong className="text-ink">A4</strong>, scale to{' '}
          <strong className="text-ink">100%</strong> (not &ldquo;Fit to page&rdquo;, which
          shrinks the cards), and turn on{' '}
          <strong className="text-ink">Background graphics</strong> or the red will not
          appear. Card stock around 300gsm feels like a real business card.
        </div>
      </div>

      {/* The sheet */}
      <div className="sheet mx-auto my-8 bg-white p-[8mm] shadow-card print:my-0 print:shadow-none">
        <div className="grid grid-cols-2 gap-x-[6mm] gap-y-[5mm]">
          {Array.from({ length: copies }).map((_, i) => (
            <StreetCard key={i} url={appUrl} />
          ))}
        </div>
      </div>

      <p className="no-print mx-auto max-w-3xl px-gutter pb-10 text-center text-caption text-ink-subtle">
        <Scissors size={12} className="mr-1 inline" aria-hidden />
        Cut along the dashed edges. Each card is 85 × 55 mm — standard business card size.
      </p>

      {/*
        Print rules. Scoped to this page rather than the global stylesheet:
        every other screen in this app is meant for a display, and a stray
        @page rule would affect all of them.
      */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { margin: 0 !important; padding: 8mm !important; box-shadow: none !important; }
          /* Keep a card from being split across two pages. */
          .street-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StreetCard({ url }: { url: string }) {
  return (
    <article
      className="street-card flex items-center gap-[4mm] rounded-[3mm] border border-dashed border-neutral-300 bg-white p-[4mm]"
      style={{ width: '85mm', height: '55mm' }}
    >
      {/* QR. Fixed millimetres: below about 20mm a phone struggles to focus
          close enough to resolve it, especially in poor light. */}
      <div className="shrink-0">
        <QrCode value={url} size={132} label="Scan to open AC7 Ride" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-[1mm]">
        <div>
          <div className="flex items-center gap-[2mm]">
            <span
              aria-hidden
              className="grid h-[9mm] w-[9mm] place-items-center rounded-[2mm] text-[3.6mm] font-bold text-white"
              style={{ background: '#8B0000' }}
            >
              A7
            </span>
            <span className="text-[4.2mm] font-bold leading-none tracking-tight text-neutral-900">
              AC7 Ride
            </span>
          </div>

          <p className="mt-[2mm] text-[3.1mm] font-semibold leading-tight" style={{ color: '#8B0000' }}>
            Scan to book a taxi
          </p>

          <p className="mt-[1mm] text-[2.6mm] leading-snug text-neutral-600">
            Licensed private hire across London. Fare agreed before you confirm.
          </p>
        </div>

        <div className="border-t border-neutral-200 pt-[1.5mm]">
          <p className="text-[2.4mm] uppercase tracking-wide text-neutral-500">
            24/7 control centre
          </p>
          <p className="text-[3.4mm] font-bold tabular-nums text-neutral-900">
            {env.controlCentre.display}
          </p>
        </div>
      </div>
    </article>
  );
}
