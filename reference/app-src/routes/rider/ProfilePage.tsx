import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, Gift, Heart, LifeBuoy, LogOut, Settings, Shield, ShieldAlert, UserPlus } from 'lucide-react';

import { authApi, ratingsApi, safetyApi } from '@shared/api';
import { AvatarUpload } from '@shared/components/ui/AvatarUpload';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NoTripsArt } from '@shared/components/ui/Illustration';
import { Input } from '@shared/components/ui/Input';
import { Modal } from '@shared/components/ui/Modal';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { RatingStars } from '@shared/components/ui/Rating';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { TripCard } from '@/components/domain/TripCard';
import { useEmergencyContacts, useMyRides } from '@shared/hooks/queries';
import { ApiError } from '@shared/lib/http';
import { formatCurrency, fullName, initials } from '@shared/lib/utils';
import { useAuth } from '@shared/providers/AuthProvider';

/**
 * Rider profile.
 *
 * Same shape as the driver's, deliberately: centred photo, identity, stats,
 * history, then settings. Riders and drivers are often the same person in a
 * city like London, and a profile that reorganises itself between the two
 * apps makes them relearn it.
 *
 * The rider's own rating is shown because drivers rate riders too, and most
 * people have no idea that score exists until it starts costing them pickups.
 */
export function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();

  const { data: contacts, refetch: refetchContacts } = useEmergencyContacts();
  const { data: rides, isLoading: loadingRides } = useMyRides({ per_page: 5 });

  const ratings = useQuery({
    queryKey: ['ratings', 'me'],
    queryFn: () => ratingsApi.myProfile(),
    retry: 1,
    staleTime: 5 * 60_000,
  });

  const [editing, setEditing] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone_number: user?.phone_number ?? '',
  });

  const [contact, setContact] = useState({ name: '', phone_number: '', relationship: '' });

  const trips = rides?.items ?? [];

  /* Lifetime totals, computed from the page we already have. The backend has
     no rider-summary endpoint, so this reflects recent trips rather than all
     time — labelled honestly below rather than dressed up as a lifetime stat. */
  const spend = useMemo(
    () =>
      trips
        .filter((r) => r.status === 'completed')
        .reduce((sum, r) => sum + (r.final_fare ?? r.estimated_fare ?? 0), 0),
    [trips],
  );

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const updated = await authApi.updateProfile(form);
      updateUser(updated);
      setEditing(false);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(
        'Could not save',
        error instanceof ApiError ? error.userMessage : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePhoto(profile_image: string | null) {
    try {
      const updated = await authApi.updateProfile({ profile_image });
      updateUser(updated);
      toast.success(profile_image ? 'Photo updated' : 'Photo removed');
    } catch (error) {
      toast.error(
        'Could not save your photo',
        error instanceof ApiError ? error.userMessage : undefined,
      );
    }
  }

  async function handleAddContact() {
    setSaving(true);
    try {
      await safetyApi.addContact({
        name: contact.name,
        phone_number: contact.phone_number,
        ...(contact.relationship ? { relationship: contact.relationship } : {}),
      });
      setContactOpen(false);
      setContact({ name: '', phone_number: '', relationship: '' });
      void refetchContacts();
      toast.success('Emergency contact added');
    } catch (error) {
      toast.error(
        'Could not add contact',
        error instanceof ApiError ? error.userMessage : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-surface pb-tabbar">
      <ScreenHeader
        title="Profile"
        onBack={false}
        /* The gear sits in the header rather than as a row in the list: it is
           the one control on this screen that leads somewhere else entirely,
           and people look for it top-right by habit. */
        trailing={
          <Link
            to="/rider/settings"
            aria-label="Settings"
            className="grid h-11 w-11 place-items-center rounded-control text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <Settings size={20} aria-hidden />
          </Link>
        }
      />

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
              caption="Your driver sees this photo at pickup"
            />

            <h1 className="mt-4 text-h2 text-ink">{fullName(user) || 'Your account'}</h1>
            <p className="mt-1 text-body-sm text-ink-muted">{user?.email}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Badge tone="brand">{user?.role}</Badge>
              {user?.is_verified ? (
                <Badge tone="success" dot>
                  Verified
                </Badge>
              ) : (
                <Badge tone="muted">Unverified</Badge>
              )}
            </div>

            {/* The rider's own score, as rated by drivers */}
            {ratings.data && ratings.data.total_ratings > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-pill border border-line bg-card px-4 py-2 shadow-xs">
                <RatingStars value={ratings.data.average_rating} size="sm" />
                <span className="tabular text-caption font-bold text-ink">
                  {ratings.data.average_rating.toFixed(2)}
                </span>
                <span className="text-[0.6875rem] text-ink-subtle">
                  from {ratings.data.total_ratings}{' '}
                  {ratings.data.total_ratings === 1 ? 'driver' : 'drivers'}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ---- Stats --------------------------------------------------- */}
        <section className="mt-6 px-gutter">
          {loadingRides ? (
            <Skeleton className="h-[5.5rem] rounded-panel" />
          ) : (
            <div className="grid grid-cols-3 divide-x divide-line rounded-panel border border-line bg-card py-4 shadow-card">
              {/* `meta.total` is the full count; trips.length is only this
                  page of five, so prefer the former when present. */}
              <Stat value={String(rides?.meta?.total ?? trips.length)} label="Trips" />
              <Stat value={formatCurrency(spend)} label="Recent spend" />
              <Stat
                value={
                  ratings.data && ratings.data.total_ratings > 0
                    ? ratings.data.average_rating.toFixed(2)
                    : '—'
                }
                label="Your rating"
              />
            </div>
          )}
        </section>

        {/* ---- Shortcuts ----------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <div className="grid grid-cols-4 gap-2.5">
            <Shortcut icon={<Heart size={19} />} label="Places" to="/rider/favourites" />
            <Shortcut icon={<Bell size={19} />} label="Alerts" to="/rider/notifications" />
            <Shortcut icon={<ShieldAlert size={19} />} label="Safety" to="/rider/safety" />
            <Shortcut icon={<LifeBuoy size={19} />} label="Help" to="/rider/support" />
          </div>
        </section>

        {/* ---- Trip history -------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card padded={false}>
            <div className="p-5 pb-3">
              <CardHeader
                title="Recent trips"
                description="Your last five journeys"
                action={
                  <Link
                    to="/rider/trips"
                    className="inline-flex items-center gap-0.5 text-caption font-semibold text-brand-ink"
                  >
                    All
                    <ChevronRight size={14} aria-hidden />
                  </Link>
                }
              />
            </div>

            {loadingRides ? (
              <div className="space-y-2 px-5 pb-5">
                <Skeleton className="h-24 rounded-card" />
                <Skeleton className="h-24 rounded-card" />
              </div>
            ) : trips.length === 0 ? (
              <EmptyState
                art={<NoTripsArt />}
                title="No trips yet"
                description="Book your first ride and it will appear here with the route and fare."
                action={
                  <Link to="/rider">
                    <Button>Book a ride</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2.5 px-5 pb-5">
                {trips.map((ride) => (
                  <li key={ride.id}>
                    <TripCard ride={ride} to={`/rider/track/${ride.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* ---- Refer a driver ------------------------------------------ */}
        <section className="mt-4 px-gutter">
          <Link
            to="/rider/refer"
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
                Know someone who drives? Refer them and you both get paid
              </span>
            </span>

            <ChevronRight size={18} aria-hidden className="shrink-0 text-white/70" />
          </Link>
        </section>

        {/* ---- Personal details ---------------------------------------- */}
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
              <form onSubmit={handleSaveProfile} className="space-y-4">
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
                  hint="Your driver calls this number if they cannot find you"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                />

                <p className="text-body-sm text-ink-muted">
                  Email addresses can't be changed here — contact support if you need to update
                  yours.
                </p>

                <div className="flex gap-3">
                  <Button type="submit" loading={saving}>
                    Save changes
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

        {/* ---- Emergency contacts -------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card>
            <CardHeader
              title="Emergency contacts"
              description="Notified automatically if you trigger an SOS during a trip."
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<UserPlus size={15} />}
                  onClick={() => setContactOpen(true)}
                >
                  Add
                </Button>
              }
            />

            {!contacts?.length ? (
              <p className="text-body text-ink-muted">
                No contacts yet. Adding one means help can reach the right person quickly.
              </p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-tile bg-surface px-4 py-3"
                  >
                    <Shield size={17} className="shrink-0 text-ink-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink">{entry.name}</p>
                      <p className="tabular text-body-sm text-ink-muted">{entry.phone_number}</p>
                    </div>
                    {entry.is_verified ? (
                      <Badge tone="success">Verified</Badge>
                    ) : (
                      <Badge tone="muted">Pending</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* ---- Actions -------------------------------------------------- */}
        <section className="mt-4 px-gutter">
          <Card padded={false}>
            <Link
              to="/rider/support"
              className="flex items-center gap-3 border-b border-line px-5 py-4 transition-colors hover:bg-surface"
            >
              <LifeBuoy size={18} className="shrink-0 text-ink-muted" aria-hidden />
              <span className="flex-1 text-body font-medium text-ink">Contact support</span>
              <ChevronRight size={17} className="shrink-0 text-ink-subtle" aria-hidden />
            </Link>

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
          AC7 Ride · London
        </p>
      </div>

      {/* ---- Add contact ---------------------------------------------- */}
      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Add emergency contact"
        description="They'll receive your location and trip details if you trigger an SOS."
        footer={
          <>
            <Button variant="ghost" onClick={() => setContactOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={!contact.name || !contact.phone_number}
              onClick={() => void handleAddContact()}
            >
              Add contact
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={contact.name}
            onChange={(e) => setContact({ ...contact, name: e.target.value })}
          />
          <Input
            label="Phone number"
            type="tel"
            placeholder="+44 7700 900000"
            value={contact.phone_number}
            onChange={(e) => setContact({ ...contact, phone_number: e.target.value })}
          />
          <Input
            label="Relationship"
            hint="Optional"
            value={contact.relationship}
            onChange={(e) => setContact({ ...contact, relationship: e.target.value })}
          />
        </div>
      </Modal>
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

function Shortcut({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="liftable group flex flex-col items-center gap-2 rounded-tile border border-line bg-card px-2 py-4"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink transition-transform duration-base ease-smooth group-hover:scale-110"
      >
        {icon}
      </span>
      <span className="text-[0.6875rem] font-semibold text-ink">{label}</span>
    </Link>
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
