import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Gift, Share2, Users } from 'lucide-react';

import { referralsApi } from '@shared/api';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { cn, formatCurrency } from '@shared/lib/utils';

/**
 * Refer a driver.
 *
 * ── On the £200 ────────────────────────────────────────────────────────────
 * The headline is "up to £200" because the backend pays per referral from
 * `referrals.referrer_bonus`, and that bonus only lands once the referred
 * driver has completed their qualifying trips — `referrer_bonus_applied`.
 * So the amount actually earned varies, and the screen shows two figures:
 * what has been paid, and what is still pending. Promising a flat £200 for a
 * signup would be a claim the payout logic does not make.
 *
 * REFERRAL_BONUS below is presentational only. The real number comes from the
 * backend per referral; if you change the offer, change it there too and this
 * constant just keeps the marketing copy in step.
 *
 * Reads GET /referrals/my-code and /referrals/my-earnings.
 */

const REFERRAL_BONUS = 200;
const CURRENCY = 'GBP';

const STEPS = [
  {
    title: 'Share your code',
    body: 'Send it to anyone you know who drives — friends, family, other drivers at the rank.',
  },
  {
    title: 'They sign up as a driver',
    body: 'They enter your code when they create their account and upload their documents.',
  },
  {
    title: 'You both get paid',
    body: 'Once they are approved and finish their qualifying trips, the bonus lands in your wallet.',
  },
];

export function ReferPage() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const code = useQuery({
    queryKey: ['referrals', 'my-code'],
    queryFn: () => referralsApi.myCode(),
    retry: 1,
    staleTime: 30 * 60_000,
  });

  const earnings = useQuery({
    queryKey: ['referrals', 'my-earnings'],
    queryFn: () => referralsApi.myEarnings(),
    retry: 1,
  });

  const referralCode = code.data?.code;

  const shareText = referralCode
    ? `Drive with AC7 in London. Use my code ${referralCode} when you sign up and we both get a bonus.`
    : '';

  async function copy() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy', 'Select the code and copy it manually.');
    }
  }

  async function share() {
    if (!referralCode) return;

    const url = `${window.location.origin}/register?ref=${encodeURIComponent(referralCode)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Drive with AC7', text: shareText, url });
      } catch {
        /* The user dismissed the share sheet — not an error worth surfacing. */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      toast.success('Invite copied', 'Paste it into a message.');
    } catch {
      toast.error('Could not copy the invite');
    }
  }

  return (
    <div className="min-h-full bg-surface pb-tabbar">
      <ScreenHeader title="Refer a driver" />

      <div className="stagger">
        {/* ---- Offer ---------------------------------------------------- */}
        <section className="px-gutter pt-6">
          <div className="edge-light relative overflow-hidden rounded-panel brand-gradient px-6 py-7 text-center shadow-brand-lg">
            <svg
              aria-hidden
              viewBox="0 0 200 200"
              className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 opacity-[0.14]"
            >
              <circle cx="100" cy="100" r="42" fill="none" stroke="white" strokeWidth="1.5" />
              <circle cx="100" cy="100" r="66" fill="none" stroke="white" strokeWidth="1.5" />
              <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="1.5" />
            </svg>

            <div className="relative">
              <span
                aria-hidden
                className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/15 backdrop-blur-sm"
              >
                <Gift size={26} className="text-white" />
              </span>

              <p className="mt-4 text-overline uppercase text-white/60">Add a new driver</p>

              <p className="tabular mt-1.5 text-display text-white">
                Up to {formatCurrency(REFERRAL_BONUS, CURRENCY)}
              </p>

              <p className="mx-auto mt-3 max-w-[18rem] text-body-sm leading-relaxed text-white/80">
                For every driver you bring to AC7 who gets approved and completes their first
                trips in London.
              </p>
            </div>
          </div>
        </section>

        {/* ---- Code ----------------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader title="Your code" description="Share this with the driver" />

            {code.isLoading ? (
              <Skeleton className="h-16 rounded-tile" />
            ) : code.isError || !referralCode ? (
              <p className="text-body-sm leading-relaxed text-ink-muted">
                Your code isn't available right now. Pull down to retry, or contact support if it
                keeps happening.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-tile border border-dashed border-line-strong bg-surface px-4 py-4">
                  <code className="tabular min-w-0 flex-1 truncate text-h3 font-bold tracking-[0.12em] text-ink">
                    {referralCode}
                  </code>

                  <button
                    type="button"
                    onClick={() => void copy()}
                    aria-label="Copy your referral code"
                    className={cn(
                      'pressable inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-2',
                      'text-caption font-semibold transition-colors',
                      copied
                        ? 'bg-success-soft text-success-ink'
                        : 'bg-brand-soft text-brand-ink hover:brightness-95',
                    )}
                  >
                    {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <Button
                  size="lg"
                  fullWidth
                  className="mt-3"
                  leadingIcon={<Share2 size={17} />}
                  onClick={() => void share()}
                >
                  Share invite
                </Button>
              </>
            )}
          </Card>
        </section>

        {/* ---- Earnings so far ------------------------------------------ */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader title="Your referrals" description="Paid and pending" />

            {earnings.isLoading ? (
              <Skeleton className="h-20" />
            ) : !earnings.data || earnings.data.total_referrals === 0 ? (
              <div className="flex items-center gap-3 rounded-tile bg-surface px-4 py-4">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
                >
                  <Users size={18} />
                </span>
                <p className="text-body-sm leading-relaxed text-ink-muted">
                  No referrals yet. Share your code above and they'll show up here.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <Metric
                    tone="success"
                    value={formatCurrency(earnings.data.total_earnings, CURRENCY)}
                    label="Paid out"
                    caption={`${earnings.data.completed_referrals} completed`}
                  />
                  <Metric
                    tone="warning"
                    value={formatCurrency(earnings.data.pending_earnings, CURRENCY)}
                    label="Pending"
                    caption={`${earnings.data.pending_referrals} still qualifying`}
                  />
                </div>

                <p className="mt-3 text-micro leading-relaxed text-ink-subtle">
                  Pending bonuses are released once the driver you referred is approved and
                  completes their qualifying trips.
                </p>
              </>
            )}
          </Card>
        </section>

        {/* ---- How it works --------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader title="How it works" />

            <ol className="space-y-5">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3.5">
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-micro font-bold text-white"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">{step.title}</p>
                    <p className="mt-1 text-body-sm leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>

        {/* ---- Terms ----------------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <div className="rounded-card border border-line bg-card p-4">
            <p className="text-micro leading-relaxed text-ink-subtle">
              The bonus is paid per approved driver and varies with how many qualifying trips they
              complete, up to {formatCurrency(REFERRAL_BONUS, CURRENCY)}. Referrals must be new to
              AC7. Bonuses are credited to your AC7 wallet.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Metric({
  value,
  label,
  caption,
  tone,
}: {
  value: string;
  label: string;
  caption: string;
  tone: 'success' | 'warning';
}) {
  return (
    <div
      className={cn(
        'rounded-tile p-4',
        tone === 'success' ? 'bg-success-soft' : 'bg-warning-soft',
      )}
    >
      <p
        className={cn(
          'tabular truncate text-amount',
          tone === 'success' ? 'text-success-ink' : 'text-warning-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1.5 text-micro text-ink-subtle">{caption}</p>
    </div>
  );
}
