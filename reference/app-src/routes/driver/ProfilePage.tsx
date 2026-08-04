import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Car, ChevronRight, FileText, Gift, LifeBuoy, LogOut, MessageSquareQuote,
  Monitor, Moon, ShieldCheck, Star, Sun,
} from 'lucide-react';

import { authApi, earningsApi, geoApi, ratingsApi } from '@shared/api';
import type { EarningsEntry } from '@shared/api/types';
import { AvatarUpload } from '@shared/components/ui/AvatarUpload';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NoTripsArt } from '@shared/components/ui/Illustration';
import { Input } from '@shared/components/ui/Input';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { RatingStars } from '@shared/components/ui/Rating';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { DriverCodeCard } from '@/components/domain/DriverCodeCard';
import { RatingBreakdown, RatingTags } from '@/components/domain/RatingBreakdown';
import { ApiError } from '@shared/lib/http';
import { cn, formatCurrency, formatDateTime, fullName, initials } from '@shared/lib/utils';
import { useDriverPresence } from '@shared/hooks/useDriverPresence';
import { useAuth } from '@shared/providers/AuthProvider';
import { useTheme, type ThemePreference } from '@shared/providers/ThemeProvider';

const THEMES: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'Auto', icon: Monitor },
];

/**
 * Driver profile.
 *
 * Structured as a public-facing card first, admin second. A driver's rating is
 * the thing that determines whether they keep getting work, so it sits above
 * the fold with its full distribution rather than as a number in a stat tile —
 * an average of 4.7 means something very different with two 1-star reviews in
 * it than with a smooth curve, and only the histogram shows which.
 *
 * Reads /geo/driver/status, /driver/ratings/me, /driver/earnings/history.
 */
export function DriverProfilePage() {
  /* The code and QR come from the driver's own row, not from the profile
     endpoint — it is the drivers table that owns them. */
  const presence = useDriverPresence();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { user, logout, updateUser } = useAuth();
  const { preference, setPreference } = useTheme();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone_number: user?.phone_number ?? '',
  });

  const driver = useQuery({
    queryKey: ['driver', 'status'],
    queryFn: () => geoApi.driverStatus(),
    retry: 1,
  });

  const ratings = useQuery({
    queryKey: ['driver', 'ratings', 'me'],
    queryFn: () => ratingsApi.myDriverProfile(),
    retry: 1,
    staleTime: 5 * 60_000,
  });

  const history = useQuery({
    queryKey: ['driver', 'recent-trips'],
    queryFn: () => earningsApi.history({ per_page: 5 }),
    retry: 1,
  });

  const save = useMutation({
    mutationFn: () => authApi.updateProfile(form),
    onSuccess: (updated) => {
      updateUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['driver'] });
      setEditing(false);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error('Could not save', e instanceof ApiError ? e.userMessage : undefined),
  });

  async function savePhoto(profile_image: string | null) {
    try {
      const updated = await authApi.updateProfile({ profile_image });
      updateUser(updated);
      toast.success(profile_image ? 'Photo updated' : 'Photo removed');
    } catch (e) {
      toast.error('Could not save your photo', e instanceof ApiError ? e.userMessage : undefined);
    }
  }

  const d = driver.data;
  const trips = history.data?.items ?? [];

  return (
    <div className="min-h-full bg-surface pb-tabbar">
      <ScreenHeader title="Profile" onBack={false} />

      <div className="stagger">
        {/* ---- Identity — centred ------------------------------------- */}
        <section className="relative px-gutter pt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-brand/[0.08] to-transparent"
          />

          <div className="relative flex flex-col items-center">
            <AvatarUpload
              src={user?.profile_image}
              initials={initials(user)}
              name={user?.first_name}
              onChange={(dataUrl) => savePhoto(dataUrl)}
              onRemove={() => savePhoto(null)}
              caption="Riders see this photo when you accept their trip"
            />

            <h1 className="mt-4 text-h2 text-ink">{fullName(user) || 'Driver'}</h1>
            <p className="mt-1 text-body-sm text-ink-muted">{user?.email}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {d?.approval_status && <ApprovalBadge status={d.approval_status} />}
              {d?.rating ? (
                <Badge tone="brand">
                  <Star size={11} className="fill-current" aria-hidden />
                  {d.rating.toFixed(2)}
                </Badge>
              ) : null}
              {d?.is_online && (
                <Badge tone="success" dot pulse>
                  Online
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* ---- Lifetime stats ---------------------------------------- */}
        <section className="mt-6 px-gutter">
          {driver.isLoading ? (
            <Skeleton className="h-[5.5rem] rounded-panel" />
          ) : (
            <div className="grid grid-cols-3 divide-x divide-line rounded-panel border border-line bg-card py-4 shadow-card">
              <Stat value={d?.rating ? d.rating.toFixed(2) : '—'} label="Rating" />
              <Stat value={d?.total_rides?.toLocaleString() ?? '—'} label="Trips" />
              <Stat
                value={ratings.data ? ratings.data.total_ratings.toLocaleString() : '—'}
                label="Reviews"
              />
            </div>
          )}
        </section>

        {/* ---- Driver code and QR ------------------------------------ */}
        {presence.driverCode && (
          <section className="mt-4 px-gutter">
            <DriverCodeCard code={presence.driverCode} />
          </section>
        )}

        {/* ---- Rating breakdown -------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader
              title="Your rating"
              description="How riders have scored your last trips"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/driver/ratings')}
                  trailingIcon={<ChevronRight size={14} />}
                >
                  All
                </Button>
              }
            />

            {ratings.isLoading ? (
              <Skeleton className="h-28" />
            ) : !ratings.data || ratings.data.total_ratings === 0 ? (
              <p className="text-body-sm leading-relaxed text-ink-muted">
                No ratings yet. Riders can score you once a trip completes — your average appears
                here after the first one.
              </p>
            ) : (
              <>
                <RatingBreakdown profile={ratings.data} />

                {ratings.data.top_tags?.length > 0 && (
                  <div className="mt-5 border-t border-line pt-4">
                    <p className="mb-2.5 text-overline uppercase text-ink-subtle">
                      What riders mention
                    </p>
                    <RatingTags tags={ratings.data.top_tags} />
                  </div>
                )}
              </>
            )}
          </Card>
        </section>

        {/* ---- Recent reviews ---------------------------------------- */}
        {ratings.data?.recent_ratings && ratings.data.recent_ratings.length > 0 && (
          <section className="mt-4 px-gutter">
            <Card padded={false}>
              <div className="p-5 pb-2">
                <CardHeader title="Recent reviews" />
              </div>

              <ul className="divide-y divide-line">
                {ratings.data.recent_ratings.slice(0, 4).map((review) => (
                  <li key={review.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <RatingStars value={review.score} size="sm" />
                      <span className="text-[0.6875rem] text-ink-subtle">
                        {formatDateTime(review.created_at)}
                      </span>
                    </div>

                    {review.comment && (
                      <p className="mt-2 flex gap-2 text-body-sm leading-relaxed text-ink-muted">
                        <MessageSquareQuote
                          size={14}
                          aria-hidden
                          className="mt-0.5 shrink-0 text-ink-subtle"
                        />
                        {review.comment}
                      </p>
                    )}

                    {review.tags && review.tags.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {review.tags.map((tag) => (
                          <li
                            key={tag}
                            className="rounded-pill bg-surface px-2 py-0.5 text-[0.6875rem] text-ink-muted"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {/* ---- Trip history ------------------------------------------ */}
        <section className="mt-4 px-gutter">
          <Card padded={false}>
            <div className="p-5 pb-2">
              <CardHeader
                title="Recent trips"
                description="Your last five completed jobs"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/driver/trips')}
                    trailingIcon={<ChevronRight size={14} />}
                  >
                    All
                  </Button>
                }
              />
            </div>

            {history.isLoading ? (
              <div className="space-y-2 px-5 pb-5">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : trips.length === 0 ? (
              <EmptyState
                art={<NoTripsArt />}
                title="No trips yet"
                description="Once you complete a job it appears here with what you earned."
                action={<Button onClick={() => navigate('/driver')}>Go online</Button>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {trips.map((entry) => (
                  <TripRow key={entry.id} entry={entry} />
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* ---- Personal details -------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader
              title="Personal details"
              action={
                !editing && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )
              }
            />

            {editing ? (
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  save.mutate();
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="First name"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                  <Input
                    label="Last name"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
                <Input
                  label="Phone number"
                  type="tel"
                  hint="Riders call this number if they cannot find you"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                />
                <div className="flex gap-3">
                  <Button type="submit" loading={save.isPending}>
                    Save
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="space-y-3.5">
                <Row label="Name" value={fullName(user) || '—'} />
                <Row label="Email" value={user?.email ?? '—'} />
                <Row label="Phone" value={user?.phone_number || '—'} />
              </dl>
            )}
          </Card>
        </section>

        {/* ---- Vehicle ------------------------------------------------ */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader title="Vehicle" description="Shown to riders when you accept a trip" />

            {driver.isLoading ? (
              <Skeleton className="h-24" />
            ) : !d?.vehicle_model ? (
              <p className="text-body text-ink-muted">
                No vehicle on file. Add one before you can accept rides.
              </p>
            ) : (
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink"
                >
                  <Car size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {d.vehicle_model} · {d.vehicle_color}
                  </p>
                  <p className="tabular mt-0.5 text-body-sm text-ink-muted">
                    {d.vehicle_plate} · {d.vehicle_year}
                  </p>
                </div>
              </div>
            )}

            {d?.license_number && (
              <dl className="mt-4 border-t border-line pt-4">
                <Row label="Licence number" value={d.license_number} />
              </dl>
            )}
          </Card>
        </section>

        {/* ---- Refer a driver ----------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Link
            to="/driver/refer"
            className="liftable edge-light relative flex w-full items-center gap-4 overflow-hidden rounded-panel brand-gradient p-5 text-left text-white shadow-brand"
          >
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur-sm"
            >
              <Gift size={22} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-h4 text-white">Earn up to £200</span>
              <span className="mt-0.5 block text-caption leading-relaxed text-white/75">
                For every driver you refer who completes their first trips
              </span>
            </span>

            <ChevronRight size={18} aria-hidden className="shrink-0 text-white/70" />
          </Link>
        </section>

        {/* ---- Appearance --------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader title="Appearance" />
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreference(id)}
                  aria-pressed={preference === id}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-tile border p-4 transition-all duration-base ease-smooth',
                    preference === id
                      ? 'border-brand-ink bg-brand-soft text-brand-ink'
                      : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  <Icon size={19} aria-hidden />
                  <span className="text-caption font-medium">{label}</span>
                </button>
              ))}
            </div>
          </Card>
        </section>

        {/* ---- Links --------------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card padded={false}>
            <LinkRow
              icon={<FileText size={18} />}
              label="Documents"
              onClick={() => navigate('/driver/documents')}
            />
            <LinkRow
              icon={<ShieldCheck size={18} />}
              label="Safety"
              onClick={() => navigate('/driver/safety')}
            />
            <LinkRow
              icon={<Gift size={18} />}
              label="Refer a driver"
              onClick={() => navigate('/driver/refer')}
            />
            <LinkRow
              icon={<LifeBuoy size={18} />}
              label="Get help"
              href="mailto:support@ac7ride.com"
            />
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-danger-soft"
            >
              <LogOut size={18} className="shrink-0 text-danger-ink" aria-hidden />
              <span className="flex-1 text-body font-medium text-danger-ink">Sign out</span>
            </button>
          </Card>
        </section>

        <p className="mt-6 text-center text-overline uppercase text-ink-subtle">
          AC7 Drive · London
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2 text-center">
      <p className="tabular truncate text-body-lg font-bold tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
    </div>
  );
}

function TripRow({ entry }: { entry: EarningsEntry }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success-soft text-success-ink"
      >
        <Car size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-ink">
          {formatCurrency(entry.net_amount)}
          {entry.tip_amount ? (
            <span className="ml-1.5 text-caption font-normal text-success-ink">
              +{formatCurrency(entry.tip_amount)} tip
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-caption text-ink-subtle">{formatDateTime(entry.created_at)}</p>
      </div>

      <p className="tabular shrink-0 text-caption text-ink-subtle">
        fare {formatCurrency(entry.gross_amount)}
      </p>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-body text-ink-muted">{label}</dt>
      <dd className="truncate text-body font-medium text-ink">{value}</dd>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <span className="flex-1 text-body font-medium text-ink">{label}</span>
      <ChevronRight size={17} className="shrink-0 text-ink-subtle" aria-hidden />
    </>
  );

  const classes =
    'flex w-full items-center gap-3 border-b border-line px-5 py-4 text-left transition-colors hover:bg-surface';

  if (href) {
    return (
      <a href={href} className={classes}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'success' | 'danger' | 'brand'; label: string }> = {
    approved: { tone: 'success', label: 'Approved' },
    rejected: { tone: 'danger', label: 'Rejected' },
    pending: { tone: 'brand', label: 'Pending review' },
  };
  const e = map[status] ?? map.pending!;
  return <Badge tone={e.tone}>{e.label}</Badge>;
}
