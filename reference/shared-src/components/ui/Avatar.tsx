import { cn } from '@shared/lib/utils';

interface AvatarProps {
  src?: string | null;
  /** Fallback initials, shown when there is no image or it fails to load. */
  initials: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  /** Decorative avatars next to a visible name should be hidden from AT. */
  alt?: string;
}

const SIZES = {
  sm: 'h-8 w-8 text-micro',
  md: 'h-10 w-10 text-body-sm',
  lg: 'h-14 w-14 text-body-lg',
  xl: 'h-20 w-20 text-h3',
  '2xl': 'h-28 w-28 text-h1',
} as const;

export function Avatar({ src, initials, size = 'md', className, alt }: AvatarProps) {
  const base = cn(
    'shrink-0 overflow-hidden rounded-full bg-brand font-semibold text-white',
    SIZES[size],
    className,
  );

  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        aria-hidden={alt ? undefined : true}
        className={cn(base, 'object-cover')}
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      className={cn(base, 'grid place-items-center')}
    >
      {initials}
    </span>
  );
}
