/**
 * ACT — the taxi front door
 *
 * Two ways in: use the app, or ring a person. Both are first-class.
 *
 * ── Why the phone number is not a lesser option ────────────────────────────
 * A good share of AC7's customers will ring rather than install anything —
 * older passengers, people with a flat battery, anyone booking on behalf of a
 * relative. Burying the number under a "having trouble?" link tells them the
 * business would rather not hear from them. It sits beside the download,
 * same size, same weight.
 */

import { Link } from 'react-router-dom';
import { Download, Phone, ShieldCheck } from 'lucide-react';

import { env } from '@shared/config/env';

export function TaxiGatewayPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-gutter py-12">
      <header className="text-center">
        <span
          aria-hidden
          className="mx-auto grid h-16 w-16 place-items-center rounded-card brand-gradient text-h3 font-bold text-white shadow-brand"
        >
          A7
        </span>
        <h1 className="mt-5 text-h2 text-ink">AC7 Taxi</h1>
        <p className="mt-2 text-body text-ink-muted">
          Licensed private hire across London. Book in the app, or speak to someone
          any hour of the day.
        </p>
      </header>

      <div className="mt-9 space-y-3">
        <Link
          /* Straight to sign-in. The rider/driver choice lives on that
             screen now — a separate page to answer one question, before a
             form that asks the same person for two more things, was a step
             for its own sake. */
          to="/login"
          className="flex items-center gap-4 rounded-card brand-gradient p-5 text-white shadow-brand transition-[filter] hover:brightness-[1.06]"
        >
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-tile bg-white/15"
          >
            <Download size={22} />
          </span>
          <span className="min-w-0">
            {/* White on the brand gradient measures 10:1 — comfortably past
                the 4.5:1 needed for body text. */}
            <span className="block text-body-lg font-semibold">Download AC7 Taxi</span>
            <span className="mt-0.5 block text-body-sm text-white/85">
              Book a car, follow it on the map and pay in the app.
            </span>
          </span>
        </Link>

        <a
          href={`tel:${env.controlCentre.tel}`}
          className="flex items-center gap-4 rounded-card border border-line bg-card p-5 shadow-card transition-colors hover:border-brand hover:bg-brand-soft"
        >
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink"
          >
            <Phone size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-body-lg font-semibold text-ink">
              Call the AC7 Control Room
            </span>
            <span className="mt-0.5 block text-body-sm text-ink-muted">
              24/7 support office — we will book it for you.
            </span>
            <span className="mt-1 block text-body font-semibold tabular-nums text-brand-ink">
              {env.controlCentre.display}
            </span>
          </span>
        </a>
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-body-sm text-ink-muted">
        <ShieldCheck size={15} className="text-accent-ink" aria-hidden />
        Every AC7 driver is licensed, insured and checked before their first trip.
      </p>

      <Link
        to="/"
        className="mt-6 text-center text-body-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Back to AC7 GROUP
      </Link>
    </main>
  );
}
