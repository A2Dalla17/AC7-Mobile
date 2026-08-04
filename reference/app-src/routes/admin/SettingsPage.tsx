import { useState } from 'react';
import { Gift, Globe, Percent, Save, ShieldCheck, Sun, Moon, Monitor } from 'lucide-react';

import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { PageHeader, SectionHeader } from '@shared/components/ui/PageHeader';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@shared/lib/utils';
import { useTheme, type ThemePreference } from '@shared/providers/ThemeProvider';

const THEMES: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

/**
 * Platform settings.
 *
 * Pricing and commission live in the backend config and are read at service
 * start. This screen surfaces them and explains where each is set — editing
 * them needs an endpoint that does not exist yet, so the fields are shown
 * read-only rather than pretending to save.
 */
export function SettingsPage() {
  const toast = useToast();
  const { preference, setPreference } = useTheme();

  const [commission, setCommission] = useState('20');
  const [cancellationFee, setCancellationFee] = useState('10');
  const [currency, setCurrency] = useState('GBP');

  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform-wide configuration. Values marked read-only are set in the backend environment."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Appearance ------------------------------------------------ */}
        <Card>
          <SectionHeader title="Appearance" description="Applies to your account on this device" />

          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreference(id)}
                aria-pressed={preference === id}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-tile border p-4 transition-all duration-200 ease-smooth',
                  preference === id
                    ? 'border-brand bg-brand-soft text-brand-ink'
                    : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                <Icon size={20} aria-hidden />
                <span className="text-caption font-medium">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* ---- Commercial ------------------------------------------------ */}
        <Card>
          <SectionHeader
            title="Commercial rules"
            description="Read from the backend environment at service start"
          />

          <div className="space-y-4">
            <Input
              label="Platform commission"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              leadingIcon={<Percent size={16} />}
              hint="Set by COMMISSION_RATE in backend/.env"
              readOnly
            />
            <Input
              label="Cancellation fee"
              value={cancellationFee}
              onChange={(e) => setCancellationFee(e.target.value)}
              leadingIcon={<Percent size={16} />}
              hint="Set by CANCELLATION_FEE_RATE"
              readOnly
            />
            <Input
              label="Default currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              leadingIcon={<Globe size={16} />}
              hint="Individual records carry their own currency_code"
              readOnly
            />
          </div>

          <p className="mt-4 rounded-tile bg-surface px-4 py-3 text-caption leading-relaxed text-ink-muted">
            These are read-only because no endpoint exists to change them at runtime. Editing
            them means updating <code className="text-ink">backend/.env</code> and restarting the
            services.
          </p>
        </Card>

        {/* ---- Driver referral programme ---------------------------------- */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Driver referral programme"
            description="What riders and drivers are shown in the app"
          />

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="edge-light relative shrink-0 overflow-hidden rounded-panel brand-gradient px-6 py-5 text-center text-white shadow-brand sm:w-56">
              <span
                aria-hidden
                className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur-sm"
              >
                <Gift size={20} />
              </span>
              <p className="mt-3 text-overline uppercase text-white/60">Add a new driver</p>
              <p className="tabular mt-1 text-amount-lg text-white">Up to £200</p>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-body leading-relaxed text-ink">
                Every rider and driver sees this offer on their profile and can share a referral
                code from <code className="text-ink-muted">/refer</code>. The bonus is paid into
                the referrer's AC7 wallet once the referred driver is approved and completes
                their qualifying trips.
              </p>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Row label="Headline offer" value="Up to £200 per approved driver" />
                <Row label="Code generation" value="GET /referrals/my-code, auto-created" />
                <Row label="Payout trigger" value="referrer_bonus_applied on the referral row" />
                <Row label="Per-referral amount" value="referrals.referrer_bonus, set backend-side" />
              </dl>

              <p className="mt-4 rounded-tile bg-warning-soft px-4 py-3 text-caption leading-relaxed text-ink">
                The £200 shown in the app is the advertised ceiling. The amount actually paid comes
                from <code className="text-ink-muted">referrals.referrer_bonus</code> per referral —
                if you change the offer, change it there too, or the app will promise more than the
                payout logic delivers.
              </p>
            </div>
          </div>
        </Card>

        {/* ---- Security -------------------------------------------------- */}
        <Card className="lg:col-span-2">
          <SectionHeader title="Security" description="How authentication is configured" />

          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label="Password hashing" value="bcrypt, cost 10" />
            <Row label="Token type" value="JWT, HS256" />
            <Row label="Token lifetime" value="24 hours" />
            <Row label="Refresh tokens" value="Not implemented — 401 signs the user out" />
            <Row label="Role enforcement" value="middleware.RequireRole, server-side" />
            <Row label="Rate limiting" value="Enabled, 100 req/min default" />
          </dl>

          <div className="mt-4 flex items-start gap-3 rounded-tile border border-brand/20 bg-brand-soft p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
            <p className="text-body-sm leading-relaxed text-ink">
              Authentication is handled entirely by the Go <code>auth</code> service. Supabase
              provides PostgreSQL only — its own auth system is not used, and the anon key plays
              no part in this platform.
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          leadingIcon={<Save size={16} />}
          onClick={() => toast.info('Appearance saved', 'Commercial rules are set in backend/.env.')}
        >
          Save changes
        </Button>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-tile bg-surface px-4 py-3">
      <dt className="text-body-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-body-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
