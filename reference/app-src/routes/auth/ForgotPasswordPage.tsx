import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';

import { otpApi } from '@shared/api';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { ApiError } from '@shared/lib/http';
import { AuthShell } from './AuthShell';

/**
 * Password reset — partial, and honest about it.
 *
 * What the backend actually supports (internal/twofa):
 *   ✓ POST /api/v1/2fa/otp/send   with otp_type "password_reset"
 *   ✓ POST /api/v1/2fa/otp/verify with otp_type "password_reset"
 *   ✗ an endpoint that accepts the new password
 *
 * The OTP endpoints require authentication, so they cannot serve a
 * logged-out user. Until `internal/auth` grows a reset handler, this screen
 * tells the user the truth and routes them to support rather than showing a
 * fake "check your email" state that leads nowhere.
 *
 * See docs/AC7-ARCHITECTURE-AUDIT.md §4.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'unavailable'>('idle');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');

    try {
      // Will 401 for a logged-out user — which is the accurate outcome today.
      await otpApi.send('password_reset', 'email');
      navigate('/two-factor?type=password_reset&via=email');
    } catch (error) {
      if (error instanceof ApiError) setStatus('unavailable');
      else setStatus('unavailable');
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll help you get back into your account."
      footer={
        <Link to="/login" className="font-semibold text-brand-ink hover:text-brand-hover">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {status === 'unavailable' && (
          <div
            role="alert"
            className="rounded-xl border border-line-strong bg-surface px-4 py-4 text-sm"
          >
            <p className="font-semibold text-ink">Self-service reset isn't available yet</p>
            <p className="mt-1.5 leading-relaxed text-ink-muted">
              Password reset needs an endpoint that doesn't exist on this deployment. Email{' '}
              <a
                href="mailto:support@ac7ride.com"
                className="font-medium text-brand-ink hover:text-brand-hover"
              >
                support@ac7ride.com
              </a>{' '}
              and we'll reset it for you.
            </p>
          </div>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          leadingIcon={<Mail size={18} />}
        />

        <Button type="submit" size="lg" fullWidth loading={status === 'sending'}>
          Continue
        </Button>
      </form>
    </AuthShell>
  );
}
