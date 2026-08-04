/**
 * ACT — rider settings
 *
 * ── Why this is a list of destinations and not one long form ───────────────
 * Settings screens fail by becoming a wall. Grouping into Account, Payment,
 * Safety and so on means somebody looking for "change my language" scans six
 * headings instead of forty rows. Each group opens its own screen, so no
 * single view is ever longer than a thumb's reach.
 *
 * ── Why Log out sits alone at the bottom ───────────────────────────────────
 * It is the one irreversible-feeling action here. Putting it in a group
 * invites a mis-tap while browsing; alone, below everything, in danger
 * colouring, it can only be reached deliberately.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FileText,
  Gift,
  Globe,
  Languages,
  MessageCircle,
  LifeBuoy,
  Lock,
  LogOut,
  MapPin,
  Moon,
  Navigation,
  ShieldCheck,
  ShoppingBag,
  Sun,
  UserCog,
  Wallet,
} from 'lucide-react';

import { Card } from '@shared/components/ui/Card';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { useTheme } from '@shared/providers/ThemeProvider';
import { useAuth } from '@shared/providers/AuthProvider';
import { cn } from '@shared/lib/utils';

export function RiderSettingsPage() {
  const { logout, email, user } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<'root' | 'account'>('root');

  if (section === 'account') {
    return <AccountSection onBack={() => setSection('root')} />;
  }

  return (
    <div className="pb-tabbar">
      <ScreenHeader title="Settings" />

      <div className="space-y-6 px-gutter">
        {email && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
            <span>
              Signed in as <span className="font-medium text-ink">{email}</span>
            </span>
            {user?.rider_code && (
              <span className="rounded-pill bg-surface px-2 py-0.5 font-mono text-caption text-brand-ink">
                {user.rider_code}
              </span>
            )}
          </div>
        )}

        {/* Finish setting up.
            Shown only while onboarded_at is null. A prompt that never goes
            away is ignored within a day; one that disappears the moment it is
            satisfied still gets read the second time it appears. */}
        {user && !user.onboarded_at && (
          <Link
            to="/onboarding"
            className="flex items-center gap-3.5 rounded-card border border-warning/30 bg-warning-soft p-4"
          >
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-tile bg-warning/15 text-warning-ink"
            >
              <UserCog size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-warning-ink">
                Finish setting up your account
              </span>
              <span className="mt-0.5 block text-body-sm text-warning-ink/80">
                Add your mobile number and choose how we message you.
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-warning-ink" aria-hidden />
          </Link>
        )}

        <Group>
          <Row
            icon={<UserCog size={19} />}
            label="Account"
            hint="Messages, calendar, language and theme"
            onClick={() => setSection('account')}
          />
          {/* Payment and Wallet were two rows going to the same screen, which
              reads as two features and is really one. Merged. */}
          <Row
            icon={<Wallet size={19} />}
            label="Payment and wallet"
            hint="Cards, balance and receipts"
            to="/rider/wallet"
          />
          <Row icon={<Gift size={19} />} label="Your promotions" to="/rider/refer" />
        </Group>

        <Group>
          <Row icon={<MapPin size={19} />} label="Saved places" to="/rider/favourites" />
          <Row icon={<ShieldCheck size={19} />} label="Safety" to="/rider/safety" />
          <Row icon={<LifeBuoy size={19} />} label="Support" to="/rider/support" />
        </Group>

        {/*
          Navigation.

          This lived on the rider home screen and did not belong there. A
          rider's home screen is for booking a car; a link that launches a
          driving app is noise between them and that. It matters to drivers,
          so that is where it is prominent — but riders who drive too can
          still reach it here, which is where anybody would think to look for
          a setting they only occasionally want.

          An external link rather than a route: it leaves the app, and a row
          that looks identical to Saved places but navigates somewhere else
          entirely would be a small lie.
        */}
        <Group heading="Navigation">
          <ExternalRow
            icon={<Navigation size={19} />}
            label="Open Waze"
            hint="Live traffic, police and hazards"
            href="https://waze.com/ul"
            tint="#33CCFF"
          />
        </Group>

        <Group>
          <Row
            icon={<ShoppingBag size={19} />}
            label="AC7 Deliveries"
            hint="Food, shops and community delivery"
            locked
          />
        </Group>

        <Group>
          <Row icon={<Lock size={19} />} label="Privacy" to="/privacy" />
          <Row icon={<ShieldCheck size={19} />} label="Sign in and security" to="/rider/profile" />
          <Row icon={<FileText size={19} />} label="Legal" to="/terms" />
        </Group>

        <button
          type="button"
          onClick={() => {
            void logout();
            navigate('/login', { replace: true });
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-card border border-danger/30 bg-danger-soft text-body font-semibold text-danger-ink transition-colors hover:bg-danger/10"
        >
          <LogOut size={17} aria-hidden />
          Log out
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const CHANNEL_LABEL: Record<'none' | 'whatsapp' | 'sms' | 'both', string> = {
  none: 'Not set — app only',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  both: 'WhatsApp and SMS',
};

function AccountSection({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  /* Theme lives in ThemeProvider, not the cookie-preferences store —
     they are different concerns and were briefly conflated here. */
  const { preference, setPreference } = useTheme();

  return (
    <div className="pb-tabbar">
      <ScreenHeader title="Account" onBack={onBack} />

      <div className="space-y-6 px-gutter">
        <Group heading="Communication">
          <Row icon={<Bell size={19} />} label="Notifications" to="/rider/notifications" />
          <Row
            icon={<MessageCircle size={19} />}
            label="WhatsApp and SMS"
            hint={CHANNEL_LABEL[user?.messaging_channel ?? 'none']}
            to="/onboarding"
          />
          <Row icon={<CalendarDays size={19} />} label="Calendar" hint="Sync scheduled rides" />
          <Row icon={<Languages size={19} />} label="Language" hint="English (UK)" />
        </Group>

        <div>
          <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wide text-ink-subtle">
            Theme
          </h2>
          <Card tone="flat" padded={false} className="overflow-hidden">
            <div className="grid grid-cols-3 gap-1 p-1.5">
              {(
                [
                  { value: 'light', label: 'Light', icon: <Sun size={17} /> },
                  { value: 'dark', label: 'Dark', icon: <Moon size={17} /> },
                  { value: 'system', label: 'Auto', icon: <Globe size={17} /> },
                ] as const
              ).map((option) => {
                const active = preference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPreference(option.value)}
                    className={cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-tile transition-colors',
                      active
                        ? 'bg-brand-soft text-brand-ink'
                        : 'text-ink-muted hover:bg-surface hover:text-ink',
                    )}
                  >
                    {option.icon}
                    <span className="text-body-sm font-semibold">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>
          <p className="mt-2 px-1 text-caption text-ink-subtle">
            Auto follows your phone, switching to dark in the evening.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Group({ heading, children }: { heading?: string; children: React.ReactNode }) {
  return (
    <div>
      {heading && (
        <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wide text-ink-subtle">
          {heading}
        </h2>
      )}
      <Card tone="flat" padded={false} className="divide-y divide-line overflow-hidden">
        {children}
      </Card>
    </div>
  );
}

/**
 * A row that leaves the application.
 *
 * Visually a sibling of Row, but with the outbound arrow rather than the
 * chevron. The chevron promises "another screen in this app"; using it for a
 * link that opens Waze would teach the rider that the chevron cannot be
 * trusted, and every row after it becomes a guess.
 */
function ExternalRow({
  icon,
  label,
  hint,
  href,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  href: string;
  tint?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-surface"
    >
      <span
        aria-hidden
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-tile',
          tint ? 'text-white' : 'text-ink-muted',
        )}
        {...(tint ? { style: { background: tint } } : {})}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-body-sm text-ink-muted">{hint}</span>}
      </span>
      <ExternalLink size={16} className="shrink-0 text-ink-subtle" aria-hidden />
    </a>
  );
}

function Row({
  icon,
  label,
  hint,
  to,
  onClick,
  locked,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
  locked?: boolean;
}) {
  const body = (
    <span className="flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left">
      <span aria-hidden className="shrink-0 text-ink-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-body font-medium text-ink">
          {label}
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-micro text-ink-subtle">
              <Lock size={10} aria-hidden />
              Coming soon
            </span>
          )}
        </span>
        {hint && <span className="mt-0.5 block text-body-sm text-ink-muted">{hint}</span>}
      </span>
      {!locked && <ChevronRight size={17} className="shrink-0 text-ink-subtle" aria-hidden />}
    </span>
  );

  if (locked) return <div className="opacity-70">{body}</div>;
  if (to) return <Link to={to} className="block hover:bg-surface">{body}</Link>;
  return (
    <button type="button" onClick={onClick} className="block w-full hover:bg-surface">
      {body}
    </button>
  );
}
