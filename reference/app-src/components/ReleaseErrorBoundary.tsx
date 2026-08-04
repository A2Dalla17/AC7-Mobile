/**
 * AC7 Ride — error boundary that attributes crashes to a feature
 *
 * ── Why this exists rather than one global boundary ────────────────────────
 * A single boundary at the root tells you "the app crashed". That is not
 * actionable: it does not say which of the four things you shipped this week
 * did it, so the only available response is a full rollback.
 *
 * Wrapping each flagged feature in its own boundary changes the response. The
 * crash is reported with a flag key, the circuit breaker switches off that one
 * feature, the rest of the app stays up, and the users who were not in the
 * rollout never knew anything happened.
 *
 *   <ReleaseErrorBoundary flag="school_runs" fallback={<Unavailable />}>
 *     <SchoolRunsPanel />
 *   </ReleaseErrorBoundary>
 *
 * ── Why it renders a fallback rather than rethrowing ───────────────────────
 * The point of containment is that the blast stays inside. Rethrowing to a
 * parent boundary would take down the page and undo the isolation this class
 * exists to provide.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import type { FlagKey } from '@shared/lib/flags';
import { report } from '@shared/lib/releaseReporting';

interface Props {
  /** The feature this subtree belongs to. Drives circuit breaker attribution. */
  flag?: FlagKey;
  children: ReactNode;
  /** What to show instead of the crashed subtree. */
  fallback?: ReactNode;
}

interface State {
  crashed: boolean;
}

export class ReleaseErrorBoundary extends Component<Props, State> {
  override state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    /* The component stack is far more useful than the message alone — it names
       the component that threw, which is usually enough to find the bug
       without reproducing it. Trimmed hard because the column is capped at 500
       characters and the top few frames carry nearly all the information. */
    const stack = (info.componentStack ?? '').split('\n').slice(0, 4).join(' <- ').trim();

    report('crash', `${error.message} | ${stack}`, this.props.flag);
  }

  override render(): ReactNode {
    if (!this.state.crashed) return this.props.children;

    return (
      this.props.fallback ?? (
        <div
          role="status"
          className="rounded-tile border border-line bg-surface p-4 text-body-sm text-ink-muted"
        >
          This part of the page is temporarily unavailable.
        </div>
      )
    );
  }
}
