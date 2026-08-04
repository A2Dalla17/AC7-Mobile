/**
 * AC7 Ride — theme
 *
 * Light is the default. The user can switch to dark or follow the OS.
 * The choice persists in localStorage and is applied before first paint by a
 * blocking script in index.html, which is what prevents the white flash a
 * dark-mode user would otherwise see on every load.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'ac7.theme';

interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually applied right now. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Convenience for a two-state switch. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'light';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

function apply(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');

  // Keeps the mobile browser chrome in step with the app.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0B0B0B' : '#FFFFFF');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolve(readPreference()));

  useEffect(() => {
    const next = resolve(preference);
    setTheme(next);
    apply(next);
    localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  // Follow the OS while the preference is 'system'.
  useEffect(() => {
    if (preference !== 'system') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = query.matches ? 'dark' : 'light';
      setTheme(next);
      apply(next);
    };

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);

  const toggle = useCallback(() => {
    setPreferenceState((current) => (resolve(current) === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
