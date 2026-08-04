import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';

import { Logo } from '@shared/components/ui/Logo';
import { Button } from '@shared/components/ui/Button';
import { Container } from '@shared/components/ui/Container';
import { useAuth } from '@shared/providers/AuthProvider';
import { usePageMeta } from '@shared/lib/seo';

/**
 * Admin sign in — email and password, then the access PIN.
 *
 * ── Why not an emailed code ────────────────────────────────────────────────
 * Recorded so it is not tried again by accident. Supabase's default template
 * sends a magic LINK rather than a typed code, and that link redirects to the
 * project's configured Site URL. The sign-in then completes on the server but
 * the session lands wherever that URL points — not in the browser the person
 * is using. Opening the built site from disk, or from any host that is not the
 * configured Site URL, means it silently never arrives.
 *
 * A password depends on nothing but the database, which is the right trade for
 * a console with two users that has to work everywhere.
 *
 * ── No sign-up form ────────────────────────────────────────────────────────
 * Admin accounts are created deliberately in the Supabase dashboard. A public
 * sign-up on the page that controls the homepage would be a way in, not a
 * convenience.
 */
export function SignInPage() {
  usePageMeta('Sign in');

  const location = useLocation();
  const { signIn, session, isAdmin, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isLoading && session && isAdmin) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/admin/adverts'} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      /* No navigate() — signing in fires onAuthStateChange, the role loads,
         and the redirect above takes over. Pushing a route before the role
         has arrived would bounce off the guard and land back here. */
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container size="narrow" className="py-20">
      <div className="mx-auto max-w-sm">
        <div className="flex justify-center">
          <Logo showMeaning />
        </div>

        <div className="mt-8 rounded-card border border-line bg-card p-7 shadow-card">
          <span
            aria-hidden
            className="grid h-11 w-11 place-items-center rounded-tile bg-brand-soft text-brand-ink"
          >
            <Lock size={20} />
          </span>

          <h1 className="mt-4 text-h3 text-ink">Admin sign in</h1>
          <p className="mt-1.5 text-body-sm text-ink-muted">
            Then your four-digit access code.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-body-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-control border border-line bg-bg px-3.5 text-body text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-body-sm font-medium text-ink">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-control border border-line bg-bg px-3.5 text-body text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-tile bg-danger-soft px-3.5 py-2.5 text-body-sm text-danger-ink"
              >
                {error}
              </p>
            )}

            {session && !isAdmin && !isLoading && (
              <p className="rounded-tile bg-warning-soft px-3.5 py-2.5 text-body-sm text-warning-ink">
                Signed in, but this account is not an administrator.
              </p>
            )}

            <Button type="submit" variant="primary" fullWidth loading={busy}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-5 flex items-start gap-2 text-caption leading-relaxed text-ink-subtle">
          <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0 text-brand-ink" />
          Forgotten the password? Reset it in the Supabase dashboard under Authentication →
          Users → your account → Reset password. There is no public sign-up.
        </p>
      </div>
    </Container>
  );
}
