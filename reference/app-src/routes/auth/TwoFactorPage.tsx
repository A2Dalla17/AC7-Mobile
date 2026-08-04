import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { otpApi, type OtpDelivery, type OtpType } from '@shared/api';
import { Button } from '@shared/components/ui/Button';
import { ApiError } from '@shared/lib/http';
import { cn } from '@shared/lib/utils';
import { useAuth } from '@shared/providers/AuthProvider';
import { AuthShell } from './AuthShell';

const CODE_LENGTH = 6;

/**
 * OTP verification.
 *
 * Wired to internal/twofa:
 *   POST /api/v1/2fa/otp/send    { otp_type, delivery_method }
 *   POST /api/v1/2fa/otp/verify  { otp, otp_type, trust_device }
 *
 * `otp_type` comes from the `?type=` query param so the same screen serves
 * login verification, phone verification and the password-reset flow. The
 * backend enforces a 6-digit code (binding:"required,len=6").
 */
export function TwoFactorPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [searchParams] = useSearchParams();

  const otpType = (searchParams.get('type') as OtpType | null) ?? 'login';
  const delivery: OtpDelivery = searchParams.get('via') === 'email' ? 'email' : 'sms';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join('');

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);

    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError(null);

    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  /** Paste the whole code at once — what people actually do. */
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;

    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i];
    setDigits(next);

    inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleVerify() {
    if (code.length !== CODE_LENGTH) {
      setError(`Enter all ${CODE_LENGTH} digits.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await otpApi.verify(code, otpType);
      if (!result.verified) {
        setError('That code is incorrect. Please try again.');
        return;
      }
      navigate(role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : '/rider', {
        replace: true,
      });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.status === 400
            ? 'That code is incorrect or has expired.'
            : cause.userMessage
          : 'Unable to verify the code.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);

    try {
      await otpApi.send(otpType, delivery);
      setResent(true);
      setTimeout(() => setResent(false), 30_000);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.userMessage : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title="Verify it's you"
      subtitle={
        delivery === 'email'
          ? 'Enter the 6-digit code we emailed you.'
          : 'Enter the 6-digit code we sent to your phone.'
      }
    >
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <div className="flex gap-2.5" role="group" aria-label="Verification code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              aria-label={`Digit ${index + 1}`}
              value={digit}
              onChange={(e) => setDigit(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={cn(
                'h-14 w-full rounded-xl border bg-bg text-center text-xl font-semibold text-ink',
                'transition-colors duration-200 ease-smooth',
                'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ink/20',
                digit ? 'border-brand' : 'border-line',
              )}
            />
          ))}
        </div>

        <Button
          size="lg"
          fullWidth
          loading={submitting}
          onClick={handleVerify}
          disabled={code.length !== CODE_LENGTH}
        >
          Verify
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Didn't get it?{' '}
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending || resent}
            className="font-semibold text-brand-ink hover:text-brand-hover disabled:text-ink-subtle"
          >
            {resent ? 'Code sent' : resending ? 'Sending…' : 'Resend code'}
          </button>
        </p>
      </div>
    </AuthShell>
  );
}
