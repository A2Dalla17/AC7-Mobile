import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@shared/lib/utils';
import { Spinner } from './Spinner';

/**
 * Button.
 *
 * Sizes are built around thumbs, not text. `md` is 44px — the Apple HIG
 * minimum for a comfortable target — and `lg` at 56px is what every primary
 * action in the booking flow uses, because those are pressed one-handed while
 * standing on a street.
 *
 * `loading` keeps the label in place and swaps only the leading icon for a
 * spinner. Buttons that collapse to a bare spinner cause a layout jump and
 * lose the user's place in the flow.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success' | 'inverse';
type Size = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: cn(
    'brand-gradient text-white shadow-brand',
    'hover:shadow-brand-lg hover:brightness-[1.06]',
    'disabled:opacity-40 disabled:shadow-none disabled:brightness-100',
  ),
  secondary: cn(
    'bg-card text-ink border border-line shadow-xs',
    'hover:bg-elevated hover:border-line-strong hover:shadow-card',
    'disabled:opacity-40 disabled:shadow-none',
  ),
  ghost: 'bg-transparent text-ink hover:bg-card disabled:opacity-40',
  outline: cn(
    'bg-transparent text-brand-ink border border-brand-ink/35',
    'hover:bg-brand-soft hover:border-brand-ink/60',
    'disabled:opacity-40',
  ),
  danger: 'bg-danger text-white shadow-xs hover:brightness-110 disabled:opacity-40',
  success: 'bg-success text-white shadow-xs hover:brightness-110 disabled:opacity-40',
  /* For use on a brand panel — white pill, deep red label. */
  inverse: 'bg-white text-brand shadow-lifted hover:bg-white/90 disabled:opacity-50',
};

/**
 * Height scale: 40 / 44 / 48 / 56.
 *
 * ── Why lg and xl came down ────────────────────────────────────────────────
 * They were 56px and 64px. A 64px button is taller than a row of the on-screen
 * keyboard; two of them stacked on an iPhone SE consume a fifth of the
 * viewport, which is what made the app read as oversized and shouty rather
 * than premium. Nothing else on a phone is that tall, so the buttons stopped
 * looking like part of the same interface.
 *
 * ── Why nothing goes below 40 ──────────────────────────────────────────────
 * Apple's minimum touch target is 44pt and Material's is 48dp. `sm` at 40px
 * sits just under, and is deliberately kept for dense admin toolbars used with
 * a mouse — never for a primary action on a phone. `md` at 44px is the
 * smallest size that is safe under a thumb, and is the default.
 *
 * The horizontal padding shrank with the heights. Padding that stays wide
 * while the height drops produces a lozenge, and a row of lozenges is exactly
 * the "inconsistent, crowded" feel the redesign is meant to remove.
 */
const SIZES: Record<Size, string> = {
  /* Tailwind's spacing scale has 3.5 and 4 but no 4.5 — px-4.5 compiles to
     nothing at all, which is a silent bug rather than a visible one. Only
     values that exist are used here. */
  sm: 'h-10 px-3.5 text-caption gap-1.5',
  md: 'h-11 px-4 text-body-sm gap-2',
  lg: 'h-12 px-6 text-body gap-2',
  xl: 'h-14 px-7 text-body gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'pressable inline-flex select-none items-center justify-center rounded-pill font-semibold',
        'transition-all duration-quick ease-smooth',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} label="" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

/* -------------------------------------------------------------------------- */

/**
 * Circular icon button — notification bells, back arrows, map controls.
 *
 * `label` is required and becomes the accessible name. An icon button without
 * one is invisible to a screen reader, so the API makes it impossible to omit.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    size?: 'sm' | 'md' | 'lg';
    tone?: 'default' | 'plain' | 'brand' | 'glass' | 'danger';
  }
>(function IconButton({ label, size = 'md', tone = 'default', className, children, ...rest }, ref) {
  const sizes = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-12 w-12' } as const;

  const tones = {
    default: 'bg-card text-ink border border-line shadow-xs hover:bg-elevated',
    /* No chrome until hovered — for dense headers where a bordered circle
       on every control would read as clutter. */
    plain: 'bg-transparent text-ink hover:bg-card',
    brand: 'brand-gradient text-white shadow-brand',
    glass: 'glass text-ink border border-line shadow-card',
    danger: 'bg-danger-soft text-danger-ink hover:brightness-95',
  } as const;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        'pressable grid shrink-0 place-items-center rounded-full',
        'transition-all duration-quick ease-smooth disabled:opacity-40',
        sizes[size],
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/* -------------------------------------------------------------------------- */

/**
 * Floating action button. Sits above the map on booking screens.
 *
 * `extended` shows a label alongside the icon — used for the primary map
 * action ("Where to?"), where an unlabelled circle would be ambiguous.
 */
export const Fab = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    icon: ReactNode;
    extended?: boolean;
    tone?: 'brand' | 'surface';
  }
>(function Fab({ label, icon, extended = false, tone = 'brand', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={extended ? undefined : label}
      className={cn(
        'pressable inline-flex items-center justify-center gap-2.5 font-semibold',
        'transition-all duration-quick ease-smooth',
        extended ? 'h-14 rounded-pill px-6 text-body-sm' : 'h-14 w-14 rounded-full',
        tone === 'brand'
          ? 'brand-gradient text-white shadow-brand-lg hover:brightness-[1.06]'
          : 'border border-line bg-bg text-ink shadow-float hover:bg-card',
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="grid place-items-center">
        {icon}
      </span>
      {extended && label}
    </button>
  );
});
