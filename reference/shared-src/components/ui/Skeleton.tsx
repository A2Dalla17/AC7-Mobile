import { cn } from '@shared/lib/utils';

/**
 * Loading placeholder. Sized by the caller so the layout does not shift when
 * real content arrives — that jump is the main thing skeletons exist to avoid.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block', className)} />;
}

/** Common shape: a stack of text lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4 rounded', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Common shape: a list of cards. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-20 rounded-card" />
      ))}
    </div>
  );
}
