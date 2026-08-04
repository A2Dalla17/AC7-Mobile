import { useCallback, useEffect, useState } from 'react';

/**
 * Site preferences, stored locally.
 *
 * ── Why this is real and not a decorative toggle ───────────────────────────
 * A cookie policy that describes choices the site does not actually offer is
 * worse than no policy: it is a written claim that is false. So the analytics
 * preference below genuinely gates whether any analytics is initialised, and
 * the default is off. Nothing non-essential runs until someone opts in.
 *
 * ── Why localStorage and not a cookie ──────────────────────────────────────
 * The preference itself never needs to reach the server, and a value that is
 * not sent with every request is one fewer thing to explain in the policy.
 */

export interface Preferences {
  /** Non-essential analytics. Off unless explicitly enabled. */
  analytics: boolean;
  /** Marketing and personalisation. Off unless explicitly enabled. */
  marketing: boolean;
  /** Honour the OS "reduce motion" setting, or force animations off entirely. */
  reduceMotion: boolean;
  /** Set once the person has answered the banner, so it stops appearing. */
  decided: boolean;
}

const STORAGE_KEY = 'act.preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  analytics: false,
  marketing: false,
  reduceMotion: false,
  decided: false,
};

export function readPreferences(): Preferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<Preferences>;
    /* Spread over the defaults rather than trusting the stored shape: a value
       written by an older version of the site is missing any key added since,
       and `undefined` in a boolean field silently becomes falsy in some places
       and breaks a toggle in others. */
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    /* Private browsing, a full quota, or corrupted JSON. Falling back to the
       defaults is always safe because the defaults are the private option. */
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent('act:preferences', { detail: preferences }));
  } catch {
    /* Nothing useful to do — the UI already reflects the choice in memory. */
  }
}

/**
 * Read and update preferences, staying in step across components.
 *
 * The custom event is what keeps the cookie banner, the settings page and the
 * footer consistent when any one of them changes a value. `storage` alone is
 * not enough: browsers do not fire it in the tab that made the change.
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);

  useEffect(() => {
    function sync() {
      setPreferences(readPreferences());
    }

    window.addEventListener('act:preferences', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('act:preferences', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...readPreferences(), ...patch };
    writePreferences(next);
    setPreferences(next);
  }, []);

  return { preferences, update };
}

/** Apply preferences that affect the document itself. */
export function applyPreferences(preferences: Preferences): void {
  document.documentElement.classList.toggle('reduce-motion', preferences.reduceMotion);
}
