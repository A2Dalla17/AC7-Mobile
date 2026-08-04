/**
 * AC7 Ride — charts
 *
 * Hand-drawn SVG rather than a charting library. Three reasons: the bundle
 * stays small, the palette is guaranteed to match the design system, and
 * these shapes are simple enough that a library would be more code, not less.
 *
 * Every chart carries role="img" with a descriptive label, because a chart
 * that a screen reader cannot describe is a chart half the audience cannot use.
 */

import { useId } from 'react';

import { cn } from '@shared/lib/utils';

const RAMP = ['#A11324', '#7A0C18', '#D9505F', '#EA8B96', '#B0B0B0', '#7A7A7A'];

/* -------------------------------------------------------------------------- */
/* Line / area                                                                 */
/* -------------------------------------------------------------------------- */

export function AreaChart({
  data,
  labels,
  height = 220,
  valueFormat = (v: number) => String(Math.round(v)),
  className,
  ariaLabel,
}: {
  data: number[];
  labels?: string[];
  height?: number;
  valueFormat?: (v: number) => string;
  className?: string;
  ariaLabel: string;
}) {
  const gradientId = useId();

  const w = 600;
  const h = height;
  const padX = 8;
  const padTop = 16;
  const padBottom = labels ? 28 : 8;

  if (data.length < 2) {
    return <ChartEmpty height={height} className={className} />;
  }

  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const plotH = h - padTop - padBottom;
  const step = (w - padX * 2) / (data.length - 1);

  const pts = data.map((v, i) => ({
    x: padX + i * step,
    y: padTop + plotH - ((v - min) / range) * plotH,
  }));

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1]!.x.toFixed(1)} ${padTop + plotH} L ${pts[0]!.x.toFixed(1)} ${padTop + plotH} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('w-full', className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A11324" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#A11324" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal guides */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={padX}
          x2={w - padX}
          y1={padTop + plotH * f}
          y2={padTop + plotH * f}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="#A11324"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#A11324" vectorEffect="non-scaling-stroke" />
      ))}

      {labels &&
        labels.map((label, i) => (
          <text
            key={i}
            x={padX + i * step}
            y={h - 8}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            fillOpacity="0.55"
          >
            {label}
          </text>
        ))}

      <title>
        {ariaLabel}. Highest {valueFormat(max)}, lowest {valueFormat(min)}.
      </title>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Bars                                                                        */
/* -------------------------------------------------------------------------- */

export function BarChart({
  data,
  labels,
  height = 220,
  valueFormat = (v: number) => String(Math.round(v)),
  className,
  ariaLabel,
}: {
  data: number[];
  labels: string[];
  height?: number;
  valueFormat?: (v: number) => string;
  className?: string;
  ariaLabel: string;
}) {
  if (data.length === 0) return <ChartEmpty height={height} className={className} />;

  const max = Math.max(...data, 1);

  return (
    <div className={cn('w-full', className)} role="img" aria-label={ariaLabel} style={{ height }}>
      <div className="flex h-full items-end gap-2">
        {data.map((v, i) => (
          <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="tabular text-[0.6875rem] font-semibold text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {valueFormat(v)}
            </span>

            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-brand-700 to-brand-500 transition-all duration-300 ease-smooth group-hover:brightness-110"
              style={{ height: `${Math.max((v / max) * 100, 2)}%` }}
            />

            <span className="truncate text-[0.6875rem] text-ink-muted">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Donut                                                                       */
/* -------------------------------------------------------------------------- */

export function DonutChart({
  segments,
  size = 180,
  centerLabel,
  centerValue,
  className,
  ariaLabel,
}: {
  segments: Array<{ label: string; value: number }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
  ariaLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) return <ChartEmpty height={size} className={className} />;

  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-6', className)}>
      <svg
        viewBox="0 0 180 180"
        style={{ width: size, height: size }}
        role="img"
        aria-label={ariaLabel}
        className="shrink-0 -rotate-90"
      >
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = frac * c;
          const el = (
            <circle
              key={seg.label}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={RAMP[i % RAMP.length]}
              strokeWidth="26"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              className="transition-all duration-500 ease-smooth"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>

      {(centerValue || segments.length > 0) && (
        <div className="min-w-0 flex-1">
          {centerValue && (
            <div className="mb-3">
              <p className="tabular text-h3 text-ink">{centerValue}</p>
              {centerLabel && <p className="text-sm text-ink-muted">{centerLabel}</p>}
            </div>
          )}

          <ul className="space-y-2">
            {segments.map((seg, i) => (
              <li key={seg.label} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: RAMP[i % RAMP.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-muted">{seg.label}</span>
                <span className="tabular font-semibold text-ink">
                  {Math.round((seg.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ChartEmpty({ height, className }: { height: number; className?: string }) {
  return (
    <div
      className={cn('grid place-items-center rounded-tile border border-dashed border-line', className)}
      style={{ height }}
    >
      <p className="text-sm text-ink-muted">Not enough data to chart yet</p>
    </div>
  );
}
