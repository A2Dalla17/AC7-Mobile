import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

/**
 * Bottom sheet — the primary surface for the booking flow on mobile, and a
 * floating left panel on desktop.
 *
 * Accessibility: renders as a labelled region rather than a modal dialog,
 * because the map behind it must stay interactive. Use <Modal> when the user
 * genuinely must not interact with anything else.
 */
export function Sheet({
  children,
  className,
  label,
  /** Adds the grab handle. Purely visual — the sheet is not drag-resizable. */
  handle = true,
  /** How much of the viewport the sheet may occupy before it scrolls. */
  height = 'auto',
}: {
  children: ReactNode;
  className?: string;
  label: string;
  handle?: boolean;
  height?: 'auto' | 'half' | 'tall';
}) {
  const maxHeight = {
    auto: 'max-h-[86vh]',
    half: 'max-h-[52vh]',
    tall: 'max-h-[92vh]',
  }[height];

  return (
    <section
      aria-label={label}
      className={cn(
        // Mobile: pinned to the bottom, full width, rounded top corners.
        'edge-light fixed inset-x-0 bottom-0 z-30 rounded-t-sheet bg-bg shadow-sheet',
        'animate-sheet-up',
        maxHeight,
        'overflow-y-auto overscroll-contain',
        'pb-[max(1.5rem,var(--safe-bottom))]',
        // Desktop: becomes a floating panel on the left of the map.
        'lg:inset-y-5 lg:left-5 lg:right-auto lg:w-[27rem] lg:rounded-sheet lg:shadow-lifted',
        'lg:max-h-none lg:animate-fade-up',
        className,
      )}
    >
      {handle && (
        <div className="sticky top-0 z-10 flex justify-center bg-bg pb-2 pt-3.5 lg:hidden">
          <span aria-hidden className="h-[5px] w-11 rounded-full bg-line-strong" />
        </div>
      )}
      <div className="px-gutter pb-1 pt-1 lg:p-7">{children}</div>
    </section>
  );
}

/**
 * Focus trap helper used by Modal. Extracted so both surfaces share the same
 * keyboard behaviour if the sheet ever becomes modal.
 */
export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const container = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(selector));

    focusables()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);

  return ref;
}
