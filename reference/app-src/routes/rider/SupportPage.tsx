import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, CreditCard, LifeBuoy, Mail, MapPin,
  MessageCircle, Phone, Send, ShieldAlert, User,
} from 'lucide-react';

import { Button, IconButton } from '@shared/components/ui/Button';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@shared/lib/utils';

const TOPICS = [
  { id: 'trip', label: 'A trip', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'safety', label: 'Safety', icon: ShieldAlert },
  { id: 'account', label: 'Account', icon: User },
];

const FAQ = [
  {
    q: 'How is my fare calculated?',
    a: 'A base fare, plus a rate per kilometre and per minute for the vehicle type you chose. When demand is high a surge multiplier applies — it is always shown before you confirm, never added afterwards.',
  },
  {
    q: 'Why was I charged a cancellation fee?',
    a: 'Cancelling is free until a driver accepts. After that, a fee may apply because the driver has already started travelling to you. The exact amount is shown before you confirm the cancellation.',
  },
  {
    q: 'How do I get a receipt?',
    a: 'Open the trip from Trips and the full breakdown is there — fare, distance, discounts and payment method. Receipts are also emailed automatically after each completed trip.',
  },
  {
    q: 'I left something in the car',
    a: 'Open the trip in Trips and contact the driver through the app. If you cannot reach them, message support with the trip and we will pass on your details.',
  },
  {
    q: 'How do I become a driver?',
    a: 'Create an account and choose "Drive" when signing up. You will be asked for your licence, vehicle details and insurance. Our team reviews every application before you can accept trips.',
  },
];

/**
 * Support.
 *
 * The FAQ comes first because most questions are answered there, and a person
 * who finds their answer in five seconds is better served than one who waits
 * for a reply. The contact form is below, not hidden behind a tab.
 */
export function SupportPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [topic, setTopic] = useState('trip');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState<number | null>(0);
  const [sending, setSending] = useState(false);

  function submit() {
    setSending(true);
    // The support service (internal/support) is not reachable in this
    // configuration, so route the person to email rather than silently fail.
    setTimeout(() => {
      setSending(false);
      window.location.href = `mailto:support@ac7ride.com?subject=${encodeURIComponent(
        `[${topic}] ${subject}`,
      )}&body=${encodeURIComponent(message)}`;
      toast.info('Opening your email app', 'We reply within a few hours.');
    }, 400);
  }

  return (
    <div className="min-h-full bg-surface pb-[calc(6rem+var(--safe-bottom))]">
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+var(--safe-top))]">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Support</h1>
        <span className="w-11" />
      </header>

      {/* Quick contact */}
      <section className="px-5">
        <div className="grid grid-cols-3 gap-2.5">
          <QuickAction icon={<MessageCircle size={19} />} label="Live chat" sub="Fastest" />
          <QuickAction
            icon={<Phone size={19} />}
            label="Call us"
            sub="24/7"
            href="tel:+442080000000"
          />
          <QuickAction
            icon={<Mail size={19} />}
            label="Email"
            sub="Few hours"
            href="mailto:support@ac7ride.com"
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-5 px-5">
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardHeader title="Common questions" description="Most answers are here" />
          </div>

          <ul className="divide-y divide-line">
            {FAQ.map((item, i) => (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface"
                >
                  <span className="flex-1 text-body font-medium text-ink">{item.q}</span>
                  <ChevronDown
                    size={17}
                    aria-hidden
                    className={cn(
                      'shrink-0 text-ink-subtle transition-transform duration-200 ease-smooth',
                      open === i && 'rotate-180',
                    )}
                  />
                </button>

                {open === i && (
                  <p className="animate-fade-in px-5 pb-4 text-body-sm leading-relaxed text-ink-muted">
                    {item.a}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Contact form */}
      <section className="mt-4 px-5">
        <Card>
          <CardHeader title="Still need help?" description="Tell us what happened" />

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">What is this about?</p>
              <div className="grid grid-cols-4 gap-2">
                {TOPICS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTopic(id)}
                    aria-pressed={topic === id}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-tile border p-3 transition-all duration-200 ease-smooth',
                      topic === id
                        ? 'border-brand bg-brand-soft text-brand-ink'
                        : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                    )}
                  >
                    <Icon size={17} aria-hidden />
                    <span className="text-[0.6875rem] font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Charged twice for one trip"
            />

            <div>
              <label htmlFor="support-message" className="mb-1.5 block text-sm font-medium text-ink">
                Message
              </label>
              <textarea
                id="support-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what happened, including the date and time if you know it."
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-body text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ink/20"
              />
            </div>

            <Button
              size="lg"
              fullWidth
              leadingIcon={<Send size={16} />}
              loading={sending}
              disabled={!subject.trim() || !message.trim()}
              onClick={submit}
            >
              Send message
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <section className="mt-4 px-5">
        <div className="flex items-center gap-3 rounded-card bg-card p-4">
          <LifeBuoy size={18} className="shrink-0 text-brand-ink" aria-hidden />
          <p className="text-body-sm leading-relaxed text-ink-muted">
            In an emergency during a trip, use the SOS button rather than support — it reaches the
            safety team immediately.
          </p>
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href?: string;
}) {
  const content = (
    <>
      <span
        aria-hidden
        className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink"
      >
        {icon}
      </span>
      <span className="mt-2 block text-caption font-semibold text-ink">{label}</span>
      <span className="block text-[0.6875rem] text-ink-muted">{sub}</span>
    </>
  );

  const classes =
    'pressable flex flex-col items-center rounded-card border border-line bg-card p-4 text-center transition-colors hover:border-line-strong';

  return href ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <button type="button" className={classes}>
      {content}
    </button>
  );
}
