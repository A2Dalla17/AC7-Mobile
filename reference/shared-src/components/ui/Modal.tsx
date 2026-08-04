import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '@shared/lib/utils';
import { useFocusTrap } from './Sheet';

/**
 * Modal dialog. Traps focus, closes on Escape and scrim click, restores focus
 * to the trigger on close, and locks body scroll while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' } as const;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-end p-0 sm:place-items-center sm:p-4">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]"
      />

      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        className={cn(
          'relative w-full border border-line bg-bg shadow-float',
          /* Mobile: rises from the bottom edge like a native action sheet.
             Desktop: a centred dialog that scales in. */
          'animate-sheet-up rounded-t-sheet pb-[max(1.5rem,var(--safe-bottom))]',
          'sm:animate-scale-in sm:rounded-sheet sm:pb-6',
          'max-h-[90vh] overflow-y-auto overscroll-contain p-6',
          widths[size],
        )}
      >
        {/* Grab handle, mobile only — signals the sheet can be dismissed. */}
        <div className="mb-3 flex justify-center sm:hidden">
          <span aria-hidden className="h-[5px] w-11 rounded-full bg-line-strong" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 hidden h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-card hover:text-ink sm:grid"
        >
          <X size={18} />
        </button>

        <h2 id="modal-title" className="text-h3 text-ink sm:pr-10">
          {title}
        </h2>

        {description && (
          <p id="modal-description" className="mt-2 text-body leading-relaxed text-ink-muted">
            {description}
          </p>
        )}

        {children && <div className="mt-5">{children}</div>}

        {footer && (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
