/**
 * ⚠️  TEMPORARY — DELETE WITH src/dev/ AND src/preview/  ⚠️
 *
 * A small always-visible marker so a fabricated session is never mistaken for
 * a real one. It also carries the role switcher, which saves going back to
 * /login every time you want to look at a different part of the app.
 *
 * Renders only when DEMO_ENABLED — that is, `vite dev` or a build with
 * VITE_PREVIEW_MODE=true. In any real build it is dead code.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, X } from 'lucide-react';

import type { UserRole } from '@shared/api/types';
import { PREVIEW_BUILD } from '@shared/preview/flag';
import { clearSession } from '@shared/lib/session';
import { cn } from '@shared/lib/utils';

import { DEMO_ENABLED, isDemoSession, startDemoSession } from './demoSession';

const ROLES: Array<{ role: UserRole; label: string; home: string }> = [
  { role: 'rider', label: 'Rider', home: '/app' },
  { role: 'driver', label: 'Driver', home: '/driver' },
  { role: 'admin', label: 'Admin', home: '/admin' },
];

export function DemoBanner() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!DEMO_ENABLED || !isDemoSession()) return null;

  const active = ROLES.find(({ role }) =>
    window.location.pathname.startsWith(role === 'rider' ? '/app' : `/${role}`),
  );

  function switchTo(role: UserRole, home: string) {
    startDemoSession(role);
    setOpen(false);
    /* Full reload: React Query holds the previous persona's responses, and
       invalidating every key by hand is more fragile than starting clean. */
    window.location.assign(home);
  }

  function exit() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-center pb-[calc(0.5rem+var(--safe-bottom))]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-pill border border-warning/40 bg-warning/95 px-1.5 py-1 shadow-lifted">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.6875rem] font-bold text-black/80 transition-colors hover:bg-black/10"
        >
          <FlaskConical size={12} aria-hidden />
          {PREVIEW_BUILD ? 'PREVIEW' : 'DEMO'} · {active?.label ?? 'sample data'}
        </button>

        {open &&
          ROLES.map(({ role, label, home }) => (
            <button
              key={role}
              type="button"
              onClick={() => switchTo(role, home)}
              className={cn(
                'rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors',
                active?.role === role ? 'bg-black/80 text-white' : 'text-black/70 hover:bg-black/10',
              )}
            >
              {label}
            </button>
          ))}

        {/* No exit in preview mode — there is no backend to sign in to, so
            signing out would strand the visitor on a dead login form. */}
        {!PREVIEW_BUILD && (
          <button
            type="button"
            onClick={exit}
            aria-label="Exit demo mode"
            className="grid h-6 w-6 place-items-center rounded-full text-black/60 transition-colors hover:bg-black/10 hover:text-black"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
