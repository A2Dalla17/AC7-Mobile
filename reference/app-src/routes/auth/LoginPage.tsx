import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
// DEMO_MODE — delete this import with src/dev/.
import { ApiError } from '@shared/lib/http';
import { cn } from '@shared/lib/utils';
import { useAuth } from '@shared/providers/AuthProvider';
import { AuthShell } from './AuthShell';

type Intent = 'rider' | 'driver';

/** The default home for an account, used when no intent was chosen. */
const HOME_FOR_ROLE = {
  rider: '/rider',
  driver: '/driver',
  admin: '/admin',
} as const;

/**
 * Where to land after signing in.
 *
 * ── Why the choice on this screen can override the account's home ─────────
 * An admin account is also a person who books taxis. Sending every admin
 * straight to the control centre meant there was no way to open the rider app
 * at all without editing the URL — which is exactly the complaint this fixes.
 *
 * The intent only ever picks between surfaces the account is already allowed
 * to open. It grants nothing: the route guards and, underneath them, row level
 * security still decide what the person can actually see. A rider selecting
 * "Driver" does not become a driver — they are sent to the application form,
 * because wanting to drive and being allowed to drive are different things.
 */
function destinationFor(role: 'rider' | 'driver' | 'admin' | undefined, intent: Intent | null): string {
  if (!role) return '/rider';

  if (intent === 'driver') {
    if (role === 'driver' || role === 'admin') return '/driver';
    return '/driver/application';
  }

  if (intent === 'rider') {
    /* Every signed-in role may use the rider app — drivers and admins book
       taxis too, and RequireAuth on /rider already allows all three. */
    return '/rider';
  }

  return HOME_FOR_ROLE[role];
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('expired') ? 'Your session expired. Please sign in again.' : null,
  );
  const [submitting, setSubmitting] = useState(false);

  /* Preselected from ?as= when they arrived from a link that already knew, and
     changeable here so nobody is trapped by an earlier tap. */
  const initialIntent = searchParams.get('as');
  const [intent, setIntent] = useState<Intent>(
    initialIntent === 'driver' ? 'driver' : 'rider',
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Lowercase is required: the backend looks users up with a plain
      // `WHERE email = $1`, which is case-sensitive in Postgres. Typing
      // "Ghaalabh10@" would never match a stored "ghaalabh10@".
      const user = await login({ email: email.trim().toLowerCase(), password });

      // Return the user to wherever the guard intercepted them, if that
      // destination is still valid for their role.
      const intended = (location.state as { from?: string } | null)?.from;
      /* `user` is null when the Supabase sign-in succeeded but no
         public.users row is linked to it yet. The rider app is the safe
         landing spot: it is the least-privileged surface, and the guard
         there will bounce them onward once the profile appears. */
      const home = destinationFor(user?.role, intent);
      navigate(intended ?? home, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.status === 401
            ? 'That email and password do not match.'
            : cause.userMessage
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to book a ride, track a trip, or manage your account."
      footer={
        <>
          New to AC7 Ride?{' '}
          <Link to="/register" className="font-semibold text-brand-ink hover:text-brand-hover">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Rider or driver.
            A segmented control rather than two separate sign-in screens: the
            credentials are identical, so splitting the form would duplicate
            everything to change one destination. */}
        <div>
          <span className="mb-1.5 block text-body-sm font-medium text-ink">
            I am signing in as
          </span>
          <div
            role="radiogroup"
            aria-label="Sign in as"
            className="flex gap-1 rounded-control bg-surface p-1"
          >
            {(
              [
                { value: 'rider' as const, label: 'Rider', icon: <User size={16} /> },
                { value: 'driver' as const, label: 'Driver', icon: <Car size={16} /> },
              ]
            ).map((option) => {
              const active = intent === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setIntent(option.value)}
                  className={cn(
                    'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control text-body-sm font-semibold transition-colors',
                    active
                      ? 'bg-card text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          leadingIcon={<Mail size={18} />}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          leadingIcon={<Lock size={18} />}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-card hover:text-ink"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-ink hover:text-brand-hover"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      {/* DEMO_MODE — delete this line and the component below with src/dev/. */}
    </AuthShell>
  );
}

