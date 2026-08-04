import { cn } from '@shared/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Announced to screen readers. */
  label?: string;
}

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
} as const;

export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-current border-r-transparent align-[-0.125em]',
        SIZES[size],
        className,
      )}
    />
  );
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" className="text-brand-ink" label={label} />
        <p className="text-sm text-ink-muted">{label}…</p>
      </div>
    </div>
  );
}
