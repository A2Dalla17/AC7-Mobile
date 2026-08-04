import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Car,
  MessageSquare,
  QrCode as QrIcon,
  ScanLine,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';

import {
  describePresence,
  driversApi,
  isDriverCode,
  normaliseDriverCode,
  type DriverPublicProfile,
} from '@shared/api/drivers';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { QrScanner, isQrScanningSupported } from '@shared/components/ui/QrScanner';
import { NoResultsArt } from '@shared/components/ui/Illustration';
import { Spinner } from '@shared/components/ui/Spinner';
import { useAuth } from '@shared/providers/AuthProvider';
import { cn } from '@shared/lib/utils';

/**
 * Find a driver by their code.
 *
 * This page is deliberately reachable without signing in, from the landing
 * page and from the /d/:code deep link a driver's QR encodes. Someone being
 * offered a lift by a car that says AC7 on the side should be able to check it
 * is really one of ours before they get in, and requiring an account first
 * would defeat the entire point of the feature.
 *
 * Messaging the driver does require an account, because a message has to come
 * from somebody. That gate appears only after the driver has been found, so the
 * check itself is never blocked.
 */
export function DriverLookupPage() {
  const { code: codeFromUrl } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [entry, setEntry] = useState(codeFromUrl ?? '');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<DriverPublicProfile | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: (value: string) => driversApi.lookupByCode(value),
    onSuccess: (driver, value) => {
      setResult(driver);
      setNotFound(driver ? null : normaliseDriverCode(value));
      if (driver) setScanning(false);
    },
    onError: () => setNotFound(entry),
  });

  const runLookup = useCallback(
    (value: string) => {
      const normalised = normaliseDriverCode(value);
      setEntry(normalised);
      setResult(null);
      setNotFound(null);
      lookup.mutate(normalised);
    },
    [lookup],
  );

  /* A /d/AC700042 deep link resolves immediately — the person scanned a code,
     they should not then have to press a button. */
  useEffect(() => {
    if (codeFromUrl) runLookup(codeFromUrl);
    // Only on first mount for a given URL code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  const onScan = useCallback(
    (raw: string) => {
      setScanning(false);
      runLookup(raw);
    },
    [runLookup],
  );

  const canSubmit = isDriverCode(normaliseDriverCode(entry));

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-gutter py-3.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="pressable -ml-1 grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-surface"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
          <div>
            <h1 className="text-h4 text-ink">Find a driver</h1>
            <p className="text-caption text-ink-muted">Check a code before you get in</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-gutter py-5">
        {/* ---- Entry -------------------------------------------------- */}
        <Card>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) runLookup(entry);
            }}
          >
            <Input
              label="Driver code"
              inputSize="lg"
              value={entry}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="AC700042"
              leadingIcon={<Search size={17} aria-hidden />}
              onChange={(event) => {
                setEntry(event.target.value.toUpperCase());
                setNotFound(null);
              }}
              hint="Every AC7 driver has a code on their windscreen card."
            />

            <div className="mt-3.5 flex gap-2">
              <Button type="submit" fullWidth disabled={!canSubmit} loading={lookup.isPending}>
                Check this driver
              </Button>
              {isQrScanningSupported() && (
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Scan a QR code"
                  onClick={() => {
                    setScanning((open) => !open);
                    setResult(null);
                    setNotFound(null);
                  }}
                >
                  <ScanLine size={18} aria-hidden />
                </Button>
              )}
            </div>
          </form>
        </Card>

        {scanning && (
          <Card>
            <p className="mb-3 text-body-sm text-ink-muted">
              Point the camera at the QR code on the driver&rsquo;s card.
            </p>
            <QrScanner onResult={onScan} paused={!scanning} />
          </Card>
        )}

        {/* ---- Result ------------------------------------------------- */}
        {lookup.isPending && (
          <div className="grid place-items-center py-10">
            <Spinner size="lg" className="text-brand-ink" />
          </div>
        )}

        {result && (
          <DriverResultCard
            driver={result}
            canMessage={isAuthenticated}
            onMessage={() => navigate(`/rider/chat/new?driver=${result.driver_code}`)}
            onSignIn={() => navigate('/login', { state: { from: `/d/${result.driver_code}` } })}
          />
        )}

        {notFound && !lookup.isPending && (
          <Card>
            <div className="py-6 text-center">
              <NoResultsArt className="mx-auto mb-4 h-24 w-24 text-ink-subtle" />
              <p className="text-body font-medium text-ink">No driver with code {notFound}</p>
              <p className="mx-auto mt-1.5 max-w-xs text-body-sm text-ink-muted">
                Check the code on the card again. If a car is showing AC7 branding and the code
                does not match, do not get in — call the control centre.
              </p>
              <a
                href="tel:+447833172989"
                className="mt-4 inline-flex text-body-sm font-medium text-brand-ink underline underline-offset-4"
              >
                Call the control centre
              </a>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DriverResultCard({
  driver,
  canMessage,
  onMessage,
  onSignIn,
}: {
  driver: DriverPublicProfile;
  canMessage: boolean;
  onMessage: () => void;
  onSignIn: () => void;
}) {
  const presence = describePresence(driver.presence);
  const name = `${driver.first_name} ${driver.last_initial}`.trim();

  const since = new Date(driver.member_since).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Card>
      {/* Centred hero — the photo is what a person actually compares against
          the face in front of them, so it leads. */}
      <div className="flex flex-col items-center pb-1 pt-2 text-center">
        <Avatar src={driver.profile_image ?? undefined} initials={driver.first_name.slice(0, 2)} size="xl" />

        <h2 className="mt-3.5 text-h3 text-ink">{name}</h2>

        <div className="mt-1.5 flex items-center gap-2">
          <Badge tone="brand" size="sm">
            <ShieldCheck size={11} aria-hidden />
            {driver.driver_code}
          </Badge>
          <Badge tone={presence.tone} size="sm" dot pulse={driver.presence === 'available'}>
            {presence.label}
          </Badge>
        </div>

        <p className="mt-2 text-body-sm text-ink-muted">{presence.detail}</p>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
        <Stat
          icon={<Star size={14} aria-hidden />}
          label="Rating"
          value={driver.rating ? Number(driver.rating).toFixed(2) : '—'}
        />
        <Stat label="Trips" value={driver.total_rides?.toLocaleString('en-GB') ?? '0'} />
        <Stat
          icon={<Car size={14} aria-hidden />}
          label="Vehicle"
          value={driver.vehicle_model || 'Not set'}
        />
      </dl>

      {driver.bio && (
        <p className="mt-4 rounded-tile bg-surface px-3.5 py-3 text-body-sm leading-relaxed text-ink-muted">
          {driver.bio}
        </p>
      )}

      <p className="mt-4 text-center text-caption text-ink-subtle">
        Driving with AC7 since {since}
        {driver.years_experience ? ` · ${driver.years_experience} years' experience` : ''}
      </p>

      <div className="mt-4 border-t border-line pt-4">
        {canMessage ? (
          <Button fullWidth onClick={onMessage} leadingIcon={<MessageSquare size={17} />}>
            Message {driver.first_name}
          </Button>
        ) : (
          <Button fullWidth variant="secondary" onClick={onSignIn}>
            Sign in to message {driver.first_name}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center justify-center gap-1 text-micro uppercase tracking-wide text-ink-subtle">
        {icon}
        {label}
      </dt>
      <dd className={cn('mt-1 truncate text-body font-semibold text-ink')}>{value}</dd>
    </div>
  );
}

export { QrIcon };
