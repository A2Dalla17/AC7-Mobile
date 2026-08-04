/**
 * ACT — rider onboarding
 *
 * Two steps after the account exists: the phone number, then how we may
 * message them.
 *
 * ── Why the phone is asked here and not on the signup form ────────────────
 * Every extra field on a signup form loses people. Email and a password is
 * the smallest thing that creates an account; the number is asked immediately
 * afterwards, when they are already committed and can see why it matters — a
 * driver has to be able to ring them from outside the door.
 *
 * ── Why consent is its own screen ──────────────────────────────────────────
 * Under UK PECR, messaging a mobile needs consent you can evidence. A tick box
 * buried beside a phone field, pre-ticked and half-read, is not that. On its
 * own screen, unticked by default, with the choice of channel explicit, it is.
 * Skipping is allowed and costs the rider nothing — trip updates still appear
 * in the app.
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, Smartphone } from 'lucide-react';

import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { env } from '@shared/config/env';
import { supabase } from '@shared/lib/supabase';
import { cn } from '@shared/lib/utils';

type Channel = 'none' | 'whatsapp' | 'sms' | 'both';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'consent'>('phone');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<Channel>('none');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function onPhoneSubmit(e: FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      setError('Enter the mobile number a driver can reach you on.');
      return;
    }
    setError(null);
    setStep('consent');
  }

  async function finish(chosen: Channel) {
    setSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('complete_rider_onboarding', {
        p_phone: phone.trim(),
        p_channel: chosen,
      });
      if (rpcError) throw new Error(rpcError.message);
      navigate('/rider', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-gutter py-12">
      {/* Progress. Two steps is few enough to show as dots rather than
          "Step 1 of 2", which reads as bureaucracy. */}
      <div className="mb-8 flex items-center justify-center gap-2" aria-hidden>
        <span className="h-1.5 w-10 rounded-pill bg-brand" />
        <span
          className={cn('h-1.5 w-10 rounded-pill', step === 'consent' ? 'bg-brand' : 'bg-line')}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-tile border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger-ink"
        >
          {error}
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={onPhoneSubmit}>
          <span
            aria-hidden
            className="mb-5 grid h-12 w-12 place-items-center rounded-tile bg-brand-soft text-brand-ink"
          >
            <Phone size={22} />
          </span>

          <h1 className="text-h2 text-ink">What is your mobile number?</h1>
          <p className="mt-2 text-body text-ink-muted">
            Your driver needs a way to reach you when they arrive. We never show it to
            anyone else.
          </p>

          <Input
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            /* autoFocus is right here and almost nowhere else: this screen has
               exactly one field and the person arrived to fill it in. */
            autoFocus
            placeholder={`${env.phonePrefix} 7700 900123`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-6"
          />

          <Button type="submit" size="lg" className="mt-6 w-full">
            Continue
          </Button>
        </form>
      ) : (
        <div>
          <span
            aria-hidden
            className="mb-5 grid h-12 w-12 place-items-center rounded-tile bg-brand-soft text-brand-ink"
          >
            <MessageCircle size={22} />
          </span>

          <h1 className="text-h2 text-ink">How should we message you?</h1>
          <p className="mt-2 text-body text-ink-muted">
            Booking confirmations, your driver&rsquo;s arrival and receipts. Choose the
            one you actually read — you can change it later in Settings.
          </p>

          <div className="mt-6 space-y-3">
            <ChannelChoice
              label="WhatsApp"
              hint="Usually the quickest, and free on wifi."
              icon={<MessageCircle size={20} />}
              selected={channel === 'whatsapp'}
              onSelect={() => setChannel('whatsapp')}
            />
            <ChannelChoice
              label="SMS"
              hint="Works on any phone, with no data connection."
              icon={<Smartphone size={20} />}
              selected={channel === 'sms'}
              onSelect={() => setChannel('sms')}
            />
            <ChannelChoice
              label="Both"
              hint="WhatsApp first, SMS if it does not arrive."
              icon={<MessageCircle size={20} />}
              selected={channel === 'both'}
              onSelect={() => setChannel('both')}
            />
          </div>

          <p className="mt-4 text-caption leading-relaxed text-ink-subtle">
            These are messages about your trips, not marketing. We record your choice
            and the date you made it, and you can withdraw it at any time.
          </p>

          <Button
            size="lg"
            className="mt-6 w-full"
            disabled={channel === 'none' || saving}
            loading={saving}
            onClick={() => void finish(channel)}
          >
            Allow and continue
          </Button>

          {/* Skipping is a real option, phrased as one. "Not now" that quietly
              does nothing is worse than a button that says what it does. */}
          <button
            type="button"
            disabled={saving}
            onClick={() => void finish('none')}
            className="mt-3 min-h-11 w-full text-body-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Not now — I will use the app only
          </button>
        </div>
      )}
    </main>
  );
}

function ChannelChoice({
  label,
  hint,
  icon,
  selected,
  onSelect,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-card border p-4 text-left transition-colors',
        selected
          ? 'border-brand bg-brand-soft'
          : 'border-line bg-card hover:border-line-strong',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-tile',
          selected ? 'bg-brand text-white' : 'bg-surface text-ink-muted',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-body font-semibold', selected ? 'text-brand-ink' : 'text-ink')}>
          {label}
        </span>
        <span className="mt-0.5 block text-body-sm text-ink-muted">{hint}</span>
      </span>
    </button>
  );
}
