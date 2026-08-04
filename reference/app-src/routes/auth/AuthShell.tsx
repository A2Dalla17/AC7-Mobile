import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared frame for every auth screen.
 *
 * Split layout: form on the left, brand panel on the right. The panel is
 * hidden below `lg` so mobile gets a clean, single-column form.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-bg">
      {/* Form column */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[55%] lg:px-20 xl:px-28">
        <div className="mx-auto w-full max-w-[26rem]">
          <Link
            to="/"
            className="mb-12 inline-flex items-center gap-2 text-lg font-bold tracking-tight text-brand-ink"
          >
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-white"
            >
              A7
            </span>
            AC7 Ride
          </Link>

          <h1 className="text-h2 text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-body text-ink-muted">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>

      {/* Brand panel — decorative, hidden from assistive tech. */}
      <div
        aria-hidden
        className="relative hidden overflow-hidden bg-brand-900 lg:block lg:w-[45%]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900" />

        {/* Soft light bloom, evoking a lounge rather than a nightclub. */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="relative flex h-full flex-col justify-end p-14 xl:p-20">
          <blockquote className="max-w-md">
            <p className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
              Arrive composed.
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Vetted drivers, transparent fares and a car that is already on its way before
              you finish typing the address.
            </p>
          </blockquote>

          <div className="mt-12 flex gap-10 border-t border-white/15 pt-8">
            <Stat value="4.9" label="Average rating" />
            <Stat value="< 4 min" label="Median pickup" />
            <Stat value="24/7" label="Support" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-0.5 text-sm text-white/60">{label}</p>
    </div>
  );
}
