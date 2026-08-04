import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronsRight, Power } from 'lucide-react';

import { cn } from '@shared/lib/utils';

/**
 * Slide-to-confirm control, as in the driver mockup.
 *
 * Going online and offline is consequential — a mis-tap while driving either
 * strands a rider or costs the driver a fare. A deliberate drag prevents that
 * in a way a button cannot.
 *
 * Accessibility: it is a real `<button>` underneath. Keyboard and screen-reader
 * users activate it with Enter or Space; the drag is a progressive enhancement,
 * never the only path.
 */
export function SlideToToggle({
  online,
  onToggle,
  disabled = false,
  busy = false,
}: {
  online: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const KNOB = 56;
  const PADDING = 4;
  const THRESHOLD = 0.72; // fraction of the track that must be covered

  const reset = useCallback(() => {
    setDragX(0);
    setDragging(false);
  }, []);

  const commit = useCallback(() => {
    const track = trackRef.current;
    if (!track) return reset();

    const travel = track.offsetWidth - KNOB - PADDING * 2;
    if (dragX >= travel * THRESHOLD) {
      onToggle(!online);
    }
    reset();
  }, [dragX, online, onToggle, reset]);

  useEffect(() => {
    if (!dragging) return;

    function onPointerMove(event: PointerEvent) {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const travel = rect.width - KNOB - PADDING * 2;
      const next = Math.min(Math.max(event.clientX - rect.left - KNOB / 2 - PADDING, 0), travel);
      setDragX(next);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', commit);
    window.addEventListener('pointercancel', reset);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', commit);
      window.removeEventListener('pointercancel', reset);
    };
  }, [dragging, commit, reset]);

  const label = online ? 'Slide to go offline' : 'Slide to go online';

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-16 w-full select-none overflow-hidden rounded-pill border p-1',
        online ? 'border-line bg-card' : 'border-brand/30 bg-brand-soft',
        disabled && 'opacity-50',
      )}
    >
      {/* Fill that follows the knob */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-1 rounded-pill brand-gradient',
          !dragging && 'transition-[width] duration-300 ease-smooth',
        )}
        style={{ width: `${KNOB + dragX}px` }}
      />

      <p
        aria-hidden
        className={cn(
          'absolute inset-0 grid place-items-center text-body font-semibold',
          'pointer-events-none transition-opacity duration-200',
          dragX > 20 ? 'opacity-0' : 'opacity-100',
          online ? 'text-ink-muted' : 'text-brand-ink',
        )}
      >
        {label}
      </p>

      <button
        type="button"
        disabled={disabled || busy}
        aria-label={label}
        aria-pressed={online}
        onPointerDown={(event) => {
          if (disabled || busy) return;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!disabled && !busy) onToggle(!online);
          }
        }}
        className={cn(
          'absolute top-1 grid h-14 w-14 cursor-grab place-items-center rounded-full',
          'brand-gradient text-white shadow-brand active:cursor-grabbing',
          !dragging && 'transition-transform duration-300 ease-smooth',
        )}
        style={{ transform: `translateX(${dragX}px)`, left: '4px' }}
      >
        {busy ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent" />
        ) : online ? (
          <ChevronsRight size={22} className="animate-slide-hint" aria-hidden />
        ) : (
          <Power size={20} aria-hidden />
        )}
      </button>
    </div>
  );
}
