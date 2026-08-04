import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '@shared/lib/utils';

/**
 * Form controls.
 *
 * All of them are 48px tall (56px for `lg`), which is above the 44px HIG
 * minimum — text fields get tapped precisely and often, frequently while
 * walking. The label is always a real <label> bound by id, and the error is
 * wired through aria-describedby rather than being visual-only.
 */

const FIELD_BASE = cn(
  'w-full rounded-control border bg-bg text-body text-ink',
  'placeholder:text-ink-subtle',
  'transition-[border-color,box-shadow] duration-quick ease-smooth',
  'focus:outline-none focus:ring-4',
  'disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-subtle',
);

function fieldTone(hasError: boolean) {
  return hasError
    ? 'border-danger focus:border-danger focus:ring-danger/15'
    : 'border-line hover:border-line-strong focus:border-brand-ink focus:ring-brand-ink/15';
}

/* -------------------------------------------------------------------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Validation message. Sets aria-invalid and links via aria-describedby. */
  error?: string;
  /** Neutral helper text shown when there is no error. */
  hint?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  inputSize?: 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, trailingSlot, inputSize = 'md', className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-body-sm font-medium text-ink">
          {label}
        </label>
      )}

      <div className="relative">
        {leadingIcon && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle"
          >
            {leadingIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            FIELD_BASE,
            fieldTone(Boolean(error)),
            inputSize === 'lg' ? 'h-14 px-4' : 'h-12 px-4',
            leadingIcon && 'pl-12',
            trailingSlot && 'pr-12',
            className,
          )}
          {...rest}
        />

        {trailingSlot && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailingSlot}</span>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-body-sm text-danger-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-body-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/* -------------------------------------------------------------------------- */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, rows = 5, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-body-sm font-medium text-ink">
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(FIELD_BASE, fieldTone(Boolean(error)), 'resize-y px-4 py-3', className)}
        {...rest}
      />

      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-body-sm text-danger-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-body-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/* -------------------------------------------------------------------------- */

/**
 * Search field.
 *
 * Pill-shaped and unlabelled by design — this is the Uber-style bar that sits
 * on a map or above a list, where a floating label would add a line of
 * chrome for no information. The clear button appears only once there is
 * something to clear.
 */
export const SearchBar = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    label: string;
    onClear?: () => void;
    tone?: 'surface' | 'glass';
  }
>(function SearchBar(
  { label, onClear, tone = 'surface', className, value, placeholder = 'Search', ...rest },
  ref,
) {
  const hasValue = typeof value === 'string' && value.length > 0;

  return (
    <div
      className={cn(
        'flex h-12 items-center gap-2.5 rounded-pill px-4',
        'transition-[border-color,box-shadow] duration-quick ease-smooth',
        'focus-within:border-brand-ink focus-within:ring-4 focus-within:ring-brand-ink/15',
        tone === 'glass'
          ? 'glass border border-line shadow-card'
          : 'border border-line bg-bg shadow-xs',
        className,
      )}
    >
      <Search size={17} aria-hidden className="shrink-0 text-ink-subtle" />

      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-body text-ink outline-none',
          'placeholder:text-ink-subtle',
          /* Safari draws its own clear button on type=search; we have our own. */
          '[&::-webkit-search-cancel-button]:hidden',
        )}
        {...rest}
      />

      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-line text-ink-muted transition-colors hover:bg-line-strong hover:text-ink"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
});
