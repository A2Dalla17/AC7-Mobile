import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { Skeleton } from './Skeleton';
import { cn } from '@shared/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  /** Percentage change. Positive is not automatically "good" — see `invertTrend`. */
  trend?: number;
  trendLabel?: string;
  /** For metrics where a rise is bad (cancellations, complaints). */
  invertTrend?: boolean;
  loading?: boolean;
  /** Small sparkline drawn under the value. */
  sparkline?: number[];
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel = 'vs last period',
  invertTrend = false,
  loading = false,
  sparkline,
  className,
}: StatCardProps) {
  if (loading) {
    return <Skeleton className={cn('h-32 rounded-card', className)} />;
  }

  const rising = trend !== undefined && trend > 0;
  const good = trend === undefined ? null : invertTrend ? !rising : rising;

  return (
    <div
      className={cn(
        'group rounded-card border border-line bg-card p-5',
        'transition-all duration-200 ease-smooth hover:border-line-strong hover:shadow-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-medium text-ink-muted">{label}</p>
        {icon && (
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink transition-transform duration-200 ease-smooth group-hover:scale-110"
          >
            {icon}
          </span>
        )}
      </div>

      <p className="tabular mt-3 text-h2 text-ink">{value}</p>

      {trend !== undefined && (
        <p className="mt-2 flex items-center gap-1.5 text-caption">
          <span
            className={cn(
              'inline-flex items-center gap-1 font-semibold',
              good ? 'text-success-ink' : 'text-danger-ink',
            )}
          >
            {rising ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-ink-muted">{trendLabel}</span>
        </p>
      )}

      {sparkline && sparkline.length > 1 && (
        <Sparkline values={sparkline} positive={good !== false} />
      )}
    </div>
  );
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const w = 200;
  const h = 32;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend across ${values.length} points`}
      className="mt-3 h-8 w-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#00C853' : '#A11324'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
