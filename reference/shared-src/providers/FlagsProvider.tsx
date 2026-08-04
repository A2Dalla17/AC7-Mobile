/**
 * AC7 Ride — flag distribution
 *
 * ── Why this polls instead of subscribing ──────────────────────────────────
 * Supabase Realtime's postgres_changes respects row level security, and
 * public.feature_flags is admin-only on purpose: the list of flag keys is a
 * list of everything you have not shipped yet. Opening that table up so the
 * client could subscribe to it would leak the roadmap to anyone who opened
 * devtools — a worse trade than a slower kill switch.
 *
 * So: poll. The interval, focus refetch and reconnect refetch together mean a
 * killed flag reaches an open tab within about a minute, and reaches a tab the
 * user has just returned to immediately. During an incident the operator is
 * usually also telling people to reload, which is instant.
 *
 * ── Why polling stops when the tab is hidden ───────────────────────────────
 * A backgrounded tab has no user to protect. Polling it burns the phone's
 * battery and adds database load proportional to abandoned tabs, which on a
 * consumer product is most of them. The visibility handler refetches on the
 * way back, so nothing is missed — it is deferred, not skipped.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchFlags,
  initialFlags,
  type FlagKey,
  type FlagMap,
} from '@shared/lib/flags';
import { supabase } from '@shared/lib/supabase';

/** How often an open, visible tab re-evaluates. */
const POLL_MS = 60_000;

interface FlagsContextValue {
  flags: FlagMap;
  /** True until the first live evaluation lands. Defaults are in use before that. */
  isLoading: boolean;
  /** Force a re-evaluation now — used by the admin console after a change. */
  refresh: () => Promise<void>;
}

const FlagsContext = createContext<FlagsContextValue | null>(null);

export function FlagsProvider({ children }: { children: ReactNode }) {
  /* Defaults merged with a recent cache, so the first paint is not a flash of
     every feature being off followed by them appearing. */
  const [flags, setFlags] = useState<FlagMap>(() => initialFlags());
  const [isLoading, setIsLoading] = useState(true);

  /* Guards against a slow response from an earlier evaluation overwriting a
     newer one — the classic out-of-order async bug. Without it, signing in can
     be immediately undone by the signed-out request that was still in flight. */
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    const next = await fetchFlags();

    if (mine === generation.current) {
      setFlags(next);
      setIsLoading(false);
    }
  }, []);

  /* First evaluation. */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Re-evaluate whenever identity changes: a rollout targeted at drivers must
     take effect the moment a driver signs in, not a minute later. */
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  /* Poll, but only while visible. */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      stop();
      timer = setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh(); // catch up on anything missed while hidden
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', () => void refresh());

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const value = useMemo<FlagsContextValue>(
    () => ({ flags, isLoading, refresh }),
    [flags, isLoading, refresh],
  );

  return <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>;
}

/* -------------------------------------------------------------------------- */

function useFlagsContext(): FlagsContextValue {
  const ctx = useContext(FlagsContext);
  if (!ctx) {
    throw new Error('useFlag must be used inside <FlagsProvider>');
  }
  return ctx;
}

/**
 * Is this feature on for the current user?
 *
 * Returns a plain boolean with no loading state, on purpose. A component that
 * has to branch three ways — on, off, still deciding — ends up rendering a
 * spinner where a button will be, and the layout jumps when the answer
 * arrives. Before the first evaluation this returns the safe default, which
 * for every new feature is `false`, so the pre-flag UI is what shows.
 */
export function useFlag(key: FlagKey): boolean {
  return useFlagsContext().flags[key];
}

/** The whole map — for the admin console and for debugging. */
export function useFlags(): FlagsContextValue {
  return useFlagsContext();
}

/**
 * Declarative gate.
 *
 *   <Flag name="school_runs" fallback={<ComingSoon />}>
 *     <SchoolRunsPanel />
 *   </Flag>
 *
 * Worth preferring over an inline ternary for whole sections: it keeps the flag
 * name adjacent to the thing it controls, so deleting the flag later is a
 * search for one string rather than an archaeology exercise.
 */
export function Flag({
  name,
  children,
  fallback = null,
}: {
  name: FlagKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{useFlag(name) ? children : fallback}</>;
}
