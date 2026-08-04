/**
 * ACT — draggable bottom sheet
 *
 * The panel that sits over a map and snaps between two heights, as in every
 * ride-hailing app. Distinct from ui/Sheet, which is a modal that opens over
 * the page and closes; this one is always present and never goes away.
 *
 * ── Why drag is limited to the handle and header ───────────────────────────
 * If the whole sheet were draggable, every attempt to scroll a long list of
 * search results would drag the sheet down instead. Uber and Bolt both take
 * the same approach: a grab area at the top, and normal scrolling everywhere
 * below it.
 *
 * ── Why Pointer Events rather than touch handlers ──────────────────────────
 * One code path covers finger, mouse and stylus. Touch-only handlers mean the
 * sheet cannot be dragged on a laptop, which is exactly where it gets tested.
 * `setPointerCapture` keeps the drag alive when the finger leaves the handle,
 * which otherwise strands the sheet halfway.
 *
 * ── Why it is also a button ────────────────────────────────────────────────
 * Dragging is not available to somebody using a keyboard or a screen reader.
 * The handle is a real <button> that toggles between snap points, so the sheet
 * is fully operable without a pointer.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

export type SnapPoint = 'collapsed' | 'expanded';

interface DragSheetProps {
  children: ReactNode;
  /** Fraction of the viewport the sheet occupies at each stop. */
  collapsedFraction?: number;
  expandedFraction?: number;
  initial?: SnapPoint;
  /**
   * Raise the sheet to its tall stop when this becomes true.
   *
   * `initial` is read once, by useState, and never again — so a sheet told to
   * start collapsed stayed collapsed even when it filled with search results,
   * showing one and a half of them under a fold the rider had to discover by
   * dragging. This is the signal that says "there is something to read now".
   * It only ever raises: lowering is the rider's decision, and a sheet that
   * drops itself while they are reading is worse than one that never moves.
   */
  expandWhen?: boolean;
  className?: string;
}

export function DragSheet({
  /*
   * Measured against Bolt, which is the behaviour asked for.
   *
   * The first attempt had this the wrong way round: the sheet rested small and
   * the map filled the screen. That is backwards for a booking app. At rest a
   * rider is choosing a destination, not reading a map, so the sheet owns the
   * screen (~76%) and the map is a strip at the top confirming roughly where
   * they are. The map is something you pull DOWN to see, when you want it —
   * not the default state you have to work around.
   */
  children,
  collapsedFraction = 0.34,
  expandedFraction = 0.76,
  initial = 'expanded',
  expandWhen = false,
  className,
}: DragSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>(initial);

  useEffect(() => {
    if (expandWhen) setSnap('expanded');
  }, [expandWhen]);

  /*
   * A dragging sheet is a phone idea, and on a wide screen it is the wrong
   * one. Centred and capped at a readable width it became a floating card
   * marooned in the middle of the window with map on all four sides — which
   * is precisely the "map is taking the whole page" complaint, just at a
   * different screen size.
   *
   * From `md` up this becomes a side panel instead: full height, fixed width,
   * map beside it. That is what Uber and Bolt do on the web, and it is the
   * only arrangement where a mouse user can both read the panel and see a
   * useful amount of map at once. There is nothing to drag, because with the
   * panel beside the map rather than over it there is nothing in the way.
   */
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startY = useRef(0);
  const startTime = useRef(0);

  const reduceMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  ).current;

  /* Heights are computed from the viewport rather than fixed pixels: an
     iPhone SE and a desktop window are very different, and a sheet sized in
     pixels is either a sliver on one or covers the map on the other. */
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  );

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* The sheet starts above the tab bar, so the space actually available to it
     is the viewport minus that bar. Measuring fractions against the full
     viewport would push the expanded sheet off the top of the screen. */
  const TABBAR_PX = 96;
  const available = Math.max(240, viewportHeight - TABBAR_PX);

  const collapsedHeight = Math.round(available * collapsedFraction);
  const expandedHeight = Math.round(available * expandedFraction);
  const targetHeight = snap === 'expanded' ? expandedHeight : collapsedHeight;

  /* Dragging down is positive, so it subtracts from the height. Clamped so the
     sheet can never be dragged past either stop — an unclamped sheet can be
     flung off-screen and there is then no way to get it back. */
  const height = Math.min(
    expandedHeight,
    Math.max(collapsedHeight, targetHeight - dragOffset),
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    /* Ignore secondary buttons — a right-click drag is not a gesture. */
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    startTime.current = Date.now();
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragOffset(e.clientY - startY.current);
    },
    [dragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

      const travelled = e.clientY - startY.current;
      const elapsed = Math.max(1, Date.now() - startTime.current);
      const velocity = travelled / elapsed; // px per ms, positive = downward

      /* A quick flick counts even if it barely moved. Distance alone means a
         deliberate short flick does nothing, which feels broken; velocity
         alone means a slow careful drag never lands. Both, either way. */
      const flicked = Math.abs(velocity) > 0.4;
      const movedFar = Math.abs(travelled) > (expandedHeight - collapsedHeight) * 0.25;

      if (flicked || movedFar) {
        setSnap(travelled < 0 ? 'expanded' : 'collapsed');
      }

      setDragOffset(0);
      setDragging(false);
    },
    [dragging, expandedHeight, collapsedHeight],
  );

  const toggle = () => setSnap((s) => (s === 'expanded' ? 'collapsed' : 'expanded'));

  /* Desktop: a side panel, sitting in the page's flex row rather than floating
     over it. No fixed positioning, no measured height, no handle. */
  if (isDesktop) {
    return (
      <aside
        className={cn(
          'flex h-full w-[26rem] shrink-0 flex-col overflow-hidden border-r border-line bg-bg',
          className,
        )}
      >
        {/* pb-tabbar because the navigation is fixed to the bottom of the
            window at every width, so without it the last row of this panel
            sits permanently underneath the tabs and cannot be scrolled into
            view. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-gutter pb-tabbar pt-5">{children}</div>
      </aside>
    );
  }

  return (
    <div
      className={cn(
        /* mx-auto with a max width so a 27-inch monitor gets a panel rather
           than a sheet stretched across two feet of glass. */
        /* `bottom-tabbar` clears the fixed navigation, which is z-40 and would
           otherwise cover the lower part of the sheet — the rider would drag
           it up and find the last rows permanently hidden behind the tabs.
           The token already includes the home-indicator inset. */
        /* Full-bleed on a phone, inset panel from `sm` up. Inset on mobile
           reads as a floating card with the map showing down both sides —
           which is the look the rider already rejected. A sheet is attached
           to the bottom of the screen; a card floats above it. */
        'pointer-events-none fixed inset-x-0 bottom-tabbar z-20 mx-auto w-full max-w-lg px-0 sm:px-3',
        className,
      )}
    >
      <div
        className={cn(
          /* Sides and bottom borderless on mobile for the same reason: the
             sheet meets the screen edges and the tab bar, so a side border
             would draw a seam down the middle of nothing. */
          'pointer-events-auto flex flex-col overflow-hidden rounded-t-sheet border-x-0 border-b-0 border-t border-line bg-bg shadow-sheet sm:border-x sm:border-b',
          /* No transition while the finger is down — animating every pointer
             move makes the sheet lag behind the thumb. */
          !dragging && !reduceMotion && 'transition-[height] duration-300 ease-smooth',
        )}
        style={{ height }}
      >
        {/* Grab area */}
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={toggle}
          aria-expanded={snap === 'expanded'}
          aria-label={snap === 'expanded' ? 'Collapse panel' : 'Expand panel'}
          className={cn(
            'flex w-full shrink-0 cursor-grab touch-none items-center justify-center py-3',
            dragging && 'cursor-grabbing',
          )}
        >
          <span aria-hidden className="h-1.5 w-10 rounded-pill bg-line-strong" />
        </button>

        {/* Content scrolls; the sheet itself does not move with it. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
