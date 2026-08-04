import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, Phone, User as UserIcon } from 'lucide-react';

import type { UserRole } from '@shared/api/types';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { ApiError } from '@shared/lib/http';
import { cn } from '@shared/lib/utils';
import { useAuth } from '@shared/providers/AuthProvider';
import { AuthShell } from './AuthShell';

type SignupRole = Exclude<UserRole, 'admin'>;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<SignupRole>('rider');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  /** Mirrors the backend's binding tags so users see errors before a round trip. */
  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!form.first_name.trim()) errors['first_name'] = 'Required';
    if (!form.last_name.trim()) errors['last_name'] = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errors['email'] = 'Enter a valid email address';
    if (!form.phone_number.trim()) errors['phone_number'] = 'Required';
    if (form.password.length < 8) errors['password'] = 'At least 8 characters';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await register({
        ...form,
        // Store lowercase. The backend's lookup is case-sensitive, so an
        // account created as "Ghaalabh10@" could never be signed into by
        // typing "ghaalabh10@" — and vice versa.
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone_number.trim(),
        role,
      });
      /* Null when email confirmation is on: the account exists but there is
         no session yet, so there is no role to branch on. Riders are the
         default; a driver signing up lands in the rider app until their
         profile row confirms the role. */
      /* A driver goes to their document checklist; a rider goes through
         onboarding to give a phone number and choose how we may message
         them. Neither can be skipped by deep-linking past it: the rider
         app checks onboarded_at. */
      navigate(user?.role === 'driver' ? '/driver/application' : '/onboarding', {
        replace: true,
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.status === 409
            ? 'An account with that email already exists.'
            : cause.userMessage
          : 'Unable to create your account. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for booking rides or driving with AC7."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-ink hover:text-brand-hover">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {/* Role selector */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">I want to</legend>
          <div className="grid grid-cols-2 gap-3">
            <RoleOption
              selected={role === 'rider'}
              onSelect={() => setRole('rider')}
              icon={<UserIcon size={20} />}
              title="Book rides"
              caption="Ride with AC7"
            />
            <RoleOption
              selected={role === 'driver'}
              onSelect={() => setRole('driver')}
              icon={<Car size={20} />}
              title="Drive"
              caption="Earn with AC7"
            />
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First name"
            autoComplete="given-name"
            value={form.first_name}
            onChange={(e) => set('first_name', e.target.value)}
            error={fieldErrors['first_name']}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            value={form.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            error={fieldErrors['last_name']}
          />
        </div>

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          error={fieldErrors['email']}
          placeholder="you@example.com"
          leadingIcon={<Mail size={18} />}
        />

        <Input
          label="Phone number"
          type="tel"
          autoComplete="tel"
          value={form.phone_number}
          onChange={(e) => set('phone_number', e.target.value)}
          error={fieldErrors['phone_number']}
          placeholder="+974 5000 0000"
          leadingIcon={<Phone size={18} />}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          error={fieldErrors['password']}
          hint="At least 8 characters"
          leadingIcon={<Lock size={18} />}
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Creating account' : 'Create account'}
        </Button>

        {role === 'driver' && (
          <p className="text-sm text-ink-muted">
            Driver accounts require document verification before you can accept rides. You
            will be guided through it after signing up.
          </p>
        )}
      </form>
    </AuthShell>
  );
}

function RoleOption({
  selected,
  onSelect,
  icon,
  title,
  caption,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border p-4 text-left transition-all duration-200 ease-smooth',
        selected
          ? 'border-brand bg-brand-soft shadow-xs'
          : 'border-line bg-bg hover:border-line-strong hover:bg-surface',
      )}
    >
      <span className={cn('block', selected ? 'text-brand-ink' : 'text-ink-muted')}>{icon}</span>
      <span className="mt-2.5 block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">{caption}</span>
    </button>
  );
}
