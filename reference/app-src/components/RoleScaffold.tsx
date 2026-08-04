import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';

import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { fullName, initials } from '@shared/lib/utils';
import { useAuth } from '@shared/providers/AuthProvider';
import { useRealtimeStatus } from '@shared/hooks/useRealtime';

/**
 * Temporary shell for the rider / driver / admin areas.
 *
 * Phase 1 delivers the foundations: real auth, a live WebSocket and an API
 * layer bound to actual endpoints. The full surfaces for each role land in
 * Phases 5–7. This scaffold proves the plumbing works end to end and is
 * replaced, not extended.
 */
export function RoleScaffold({
  area,
  description,
  next,
}: {
  area: string;
  description: string;
  next: string[];
}) {
  const { user, logout } = useAuth();
  const status = useRealtimeStatus();

  const statusTone =
    status === 'open'
      ? 'bg-success'
      : status === 'connecting' || status === 'reconnecting'
        ? 'bg-brand-300'
        : 'bg-ink-subtle';

  return (
    <div className="min-h-screen bg-surface">
      <header className="glass sticky top-0 z-50 border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-brand-ink">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-white"
            >
              A7
            </span>
            AC7 Ride
          </Link>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <span aria-hidden className={`h-2 w-2 rounded-full ${statusTone}`} />
              <span className="sr-only">Realtime connection:</span>
              {status}
            </span>

            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-semibold text-white"
            >
              {initials(user)}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              leadingIcon={<LogOut size={16} />}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-ink">{area}</p>
        <h1 className="mt-2 text-h1 text-ink">
          Welcome, {fullName(user) || user?.email}
        </h1>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-ink-muted">
          {description}
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <Card>
            <h2 className="text-h4 text-ink">Session</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Signed in as" value={user?.email ?? '—'} />
              <Row label="Role" value={user?.role ?? '—'} />
              <Row label="Verified" value={user?.is_verified ? 'Yes' : 'No'} />
              <Row label="Realtime" value={status} />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-muted">
              This data came from <code className="text-ink">GET /api/v1/auth/profile</code> —
              a live call to your Go backend, not a mock.
            </p>
          </Card>

          <Card>
            <h2 className="text-h4 text-ink">Coming next</h2>
            <ul className="mt-4 space-y-2.5">
              {next.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-ink-muted">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
