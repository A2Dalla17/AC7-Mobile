/**
 * AC7 Ride — global error capture for release health
 *
 * Feeds public.release_events so the circuit breaker has something to act on.
 * Two sources React cannot see on its own:
 *
 *   window.onerror              — synchronous throws outside a React tree
 *   unhandledrejection          — a promise nobody caught, which is how most
 *                                 failed fetches actually surface
 *
 * React's own render errors arrive through the error boundary instead; see
 * components/ReleaseErrorBoundary.tsx.
 *
 * ── Why this is throttled in the client as well as the database ────────────
 * The per-minute dedupe index means a flood costs one row. It does not stop the
 * flood being *sent*. A render loop throwing sixty times a second would put
 * sixty requests a second on a phone's radio and the user's data allowance,
 * for no benefit, so the client refuses to send more than one report per key
 * per minute of its own accord. The database constraint remains the thing that
 * is actually load-bearing — this is only politeness toward the user's battery.
 */

import { reportReleaseEvent, type FlagKey, type ReleaseEventKind } from '@shared/lib/flags';

const RECENT = new Map<string, number>();
const THROTTLE_MS = 60_000;

/** True if this exact report has not been sent in the last minute. */
function shouldSend(signature: string): boolean {
  const now = Date.now();
  const last = RECENT.get(signature);

  if (last !== undefined && now - last < THROTTLE_MS) return false;

  RECENT.set(signature, now);

  // Bound the map. A page that generates thousands of distinct error strings
  // would otherwise leak memory through the very code meant to be diagnosing
  // it.
  if (RECENT.size > 200) {
    for (const [k, t] of RECENT) {
      if (now - t > THROTTLE_MS) RECENT.delete(k);
    }
  }

  return true;
}

export function report(
  kind: ReleaseEventKind,
  detail: string,
  flagKey?: FlagKey,
): void {
  const signature = `${kind}:${flagKey ?? '-'}:${detail.slice(0, 120)}`;
  if (!shouldSend(signature)) return;

  void reportReleaseEvent(kind, detail, flagKey);
}

let installed = false;

export function installReleaseErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    // Resource load failures (a missing image) also fire this event but have
    // no `error` object. They are not release regressions worth killing a
    // feature over.
    if (!event.error) return;

    const message = event.error instanceof Error ? event.error.message : String(event.error);
    report('crash', `${message} @ ${event.filename ?? '?'}:${event.lineno ?? 0}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'unknown';

    report('error', `unhandled rejection: ${message}`);
  });
}
