/**
 * ACT — the single authentication system
 *
 * ── Why this replaced two providers ────────────────────────────────────────
 * Before the merge there were two, and they did not merely differ in shape —
 * they authenticated against different servers.
 *
 *   AC7 Community  →  Supabase Auth.        Works today.
 *   AC7 Taxi       →  POST /api/v1/auth/login on the Go backend.
 *                     The Go backend is deployed nowhere, so this could not
 *                     succeed for anybody, ever.
 *
 * Merging the *interfaces* while leaving both backends would have produced one
 * provider that signed you into the landing site and then failed silently when
 * you pressed Book Taxi. So the unification is on Supabase, which is the one
 * that functions and is also the one every other system already trusts: row
 * level security, `current_user_id()`, the feature flag evaluator, driver code
 * lookup and chat all resolve identity from the Supabase JWT. Keeping a second
 * identity would have meant a signed-in taxi user whom RLS treats as anonymous.
 *
 * ── Why it exposes two vocabularies ────────────────────────────────────────
 * The taxi modules were written against `user / role / isAuthenticated /
 * login / logout`; the landing and adverts modules against `session / email /
 * isAdmin / signIn / signOut`. Both are served here rather than rewriting 18
 * call sites in a merge that already touches enough. They are views over one
 * session — not two sessions — so they cannot disagree.
 *
 * New code should prefer the taxi vocabulary; the ACT aliases are marked.
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
import type { Session } from '@supabase/supabase-js';

import type { User, UserRole } from '@shared/api/types';
import { supabase } from '@shared/lib/supabase';
import { clearSession, setSession as persistSession, updateUser as persistUser } from '@shared/lib/session';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  /**
   * Requested role. The database downgrades anything other than 'driver' to
   * 'rider' in the signup trigger, so a client asking for 'admin' gets a
   * rider account. Never treat this as authoritative.
   */
  role?: 'rider' | 'driver';
}

interface AuthContextValue {
  /* ---- canonical ---- */
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  /** True until the first session check completes. Guards flash-of-login. */
  isLoading: boolean;

  login: (payload: LoginPayload) => Promise<User | null>;
  register: (payload: RegisterPayload) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUser: (user: User) => void;

  /* ---- aliases used by the landing and adverts modules ---- */
  /** Raw Supabase session. Prefer `isAuthenticated`. */
  session: Session | null;
  /** Convenience for `user?.email`. */
  email: string | null;
  /** Convenience for `role === 'admin'`. */
  isAdmin: boolean;
  /** Alias of `login`, positional form. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Alias of `logout`. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* Guards out-of-order responses. Signing in fires a profile load; so does
     the token refresh that may already be in flight. Without this, the slower
     one wins and can restore the previous user. */
  const generation = useRef(0);

  /**
   * Load the public.users row behind the current Supabase session.
   *
   * auth.users and public.users are deliberately different tables with
   * different ids — public.users.id is referenced by twenty foreign keys and
   * could not be replaced by the auth uid without rewriting the schema. The
   * link is users.auth_id.
   */
  const loadProfile = useCallback(async (active: Session | null): Promise<User | null> => {
    const mine = ++generation.current;

    if (!active?.user) {
      if (mine === generation.current) {
        setUser(null);
        clearSession();
      }
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', active.user.id)
      .maybeSingle();

    /* A newer load started while this one was in flight. Drop the result
       rather than letting a stale profile overwrite a fresh one. */
    if (mine !== generation.current) return null;

    if (error || !data) {
      /* Authenticated with Supabase but no profile row — the signup trigger
         has not run, or the row was soft-deleted. Treat as signed out for
         product purposes rather than inventing a partial user: every screen
         downstream assumes a role, and there is not one. */
      setUser(null);
      clearSession();
      return null;
    }

    const profile = data as User;
    setUser(profile);

    /* Mirror into lib/session so lib/http.ts can attach a bearer token. The
       Go backend is not deployed yet; when it is, it must be configured to
       verify Supabase JWTs so this token is the only one in the system. */
    if (active.access_token) persistSession(active.access_token, profile);

    return profile;
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSessionState(data.session);
      await loadProfile(data.session);
      if (!cancelled) setIsLoading(false);
    });

    /* Fires on sign in, sign out and every silent token refresh — which is why
       the profile is reloaded here and not only at mount. */
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSessionState(next);
      void loadProfile(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(
    async ({ email, password }: LoginPayload) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(friendlyAuthError(error.message));

      setSessionState(data.session);
      return await loadProfile(data.session);
    },
    [loadProfile],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email.trim(),
        password: payload.password,
        options: {
          data: {
            first_name: payload.first_name,
            last_name: payload.last_name,
            phone_number: payload.phone_number ?? null,
            role: payload.role ?? 'rider',
          },
        },
      });
      if (error) throw new Error(friendlyAuthError(error.message));

      setSessionState(data.session);
      await loadProfile(data.session);
      return null;
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSessionState(null);
    setUser(null);
    clearSession();
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session);
  }, [loadProfile]);

  const updateUser = useCallback((next: User) => {
    setUser(next);
    persistUser(next);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await login({ email, password });
    },
    [login],
  );

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role ?? null;
    return {
      user,
      role,
      isAuthenticated: Boolean(session && user),
      isLoading,
      login,
      register,
      logout,
      refreshProfile,
      updateUser,

      session,
      email: user?.email ?? session?.user?.email ?? null,
      isAdmin: role === 'admin',
      signIn,
      signOut: logout,
    };
  }, [user, session, isLoading, login, register, logout, refreshProfile, updateUser, signIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/**
 * Supabase's messages are written for developers. These are the two a real
 * person actually hits, rewritten for someone standing in the street.
 */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Those details are not right. Check the email and password.';
  }
  if (m.includes('email not confirmed')) {
    return 'That account still needs its email confirmed.';
  }
  if (m.includes('user already registered')) {
    return 'There is already an account with that email.';
  }
  return message;
}
