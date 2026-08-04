import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Plus, ShieldAlert, ShieldCheck, Trash2, UserPlus } from 'lucide-react';

import { safetyApi } from '@shared/api';
import type { EmergencyContact } from '@shared/api/types';
import { Badge } from '@shared/components/ui/Badge';
import { Button, IconButton } from '@shared/components/ui/Button';
import { Card, CardHeader } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Input } from '@shared/components/ui/Input';
import { Modal } from '@shared/components/ui/Modal';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useToast } from '@shared/components/ui/Toast';
import { useGeolocation } from '@shared/hooks/useGeolocation';
import { ApiError } from '@shared/lib/http';

/**
 * Safety centre.
 *
 * The SOS control is deliberately large, always visible, and needs a confirm —
 * a false alarm wastes the safety team's time, but a control that is hard to
 * find in a crisis is worse. Confirmation is one tap, not a form.
 */
export function SafetyPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { position } = useGeolocation();

  const [sosOpen, setSosOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<EmergencyContact | null>(null);
  const [form, setForm] = useState({ name: '', phone_number: '', relationship: '' });

  const contacts = useQuery({
    queryKey: ['safety', 'contacts'],
    queryFn: () => safetyApi.contacts(),
    retry: 1,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['safety'] });

  const triggerSos = useMutation({
    mutationFn: () => safetyApi.triggerSos(position!),
    onSuccess: () => {
      setSosOpen(false);
      toast.success('Alert sent', 'Our safety team and your contacts have been notified.');
    },
    onError: (e) =>
      toast.error(
        'Alert could not be sent',
        e instanceof ApiError ? e.userMessage : 'Call local emergency services directly.',
      ),
  });

  const addContact = useMutation({
    mutationFn: () =>
      safetyApi.addContact({
        name: form.name.trim(),
        phone_number: form.phone_number.trim(),
        ...(form.relationship.trim() ? { relationship: form.relationship.trim() } : {}),
      }),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setForm({ name: '', phone_number: '', relationship: '' });
      toast.success('Contact added');
    },
    onError: (e) => toast.error('Could not add', e instanceof ApiError ? e.userMessage : undefined),
  });

  const removeContact = useMutation({
    mutationFn: (id: string) => safetyApi.removeContact(id),
    onSuccess: () => {
      invalidate();
      setRemoving(null);
      toast.info('Contact removed');
    },
    onError: (e) => toast.error('Could not remove', e instanceof ApiError ? e.userMessage : undefined),
  });

  const rows = contacts.data ?? [];

  return (
    <div className="min-h-full bg-surface pb-[calc(6rem+var(--safe-bottom))]">
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+var(--safe-top))]">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Safety</h1>
        <span className="w-11" />
      </header>

      {/* SOS */}
      <section className="px-5">
        <div className="rounded-card border border-danger/25 bg-danger-soft p-6 text-center">
          <button
            type="button"
            onClick={() => setSosOpen(true)}
            disabled={!position}
            className="pressable relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-danger text-white shadow-lifted disabled:opacity-50"
          >
            <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-full bg-danger/40" />
            <ShieldAlert size={36} className="relative" aria-hidden />
            <span className="sr-only">Send an emergency alert</span>
          </button>

          <h2 className="mt-4 text-h4 text-ink">Emergency SOS</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-body-sm leading-relaxed text-ink-muted">
            Sends your live location and trip details to the AC7 safety team and everyone on your
            contact list.
          </p>

          {!position && (
            <p className="mt-3 text-caption text-danger-ink">
              Location is unavailable — allow location access so help can find you.
            </p>
          )}
        </div>
      </section>

      {/* Contacts */}
      <section className="mt-5 px-5">
        <Card>
          <CardHeader
            title="Emergency contacts"
            description="Notified automatically when you trigger an SOS"
            action={
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<UserPlus size={15} />}
                onClick={() => setAddOpen(true)}
              >
                Add
              </Button>
            }
          />

          {contacts.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<UserPlus size={22} />}
              title="No contacts yet"
              description="Add someone who should know if you trigger an alert."
              action={
                <Button leadingIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
                  Add a contact
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className="group flex items-center gap-3 rounded-tile bg-surface px-4 py-3"
                >
                  <span
                    aria-hidden
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
                  >
                    <Phone size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{c.name}</p>
                    <p className="tabular truncate text-body-sm text-ink-muted">
                      {c.phone_number}
                      {c.relationship && ` · ${c.relationship}`}
                    </p>
                  </div>

                  {c.is_verified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="muted">Pending</Badge>
                  )}

                  <IconButton
                    label={`Remove ${c.name}`}
                    size="sm"
                    onClick={() => setRemoving(c)}
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 size={15} className="text-danger-ink" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* How it works */}
      <section className="mt-4 px-5">
        <Card>
          <CardHeader title="What else protects you" />
          <ul className="space-y-3.5">
            <Feature
              title="Share your trip"
              body="Send a live link from any active ride so someone can follow you to the door."
            />
            <Feature
              title="Verified drivers"
              body="Every driver is approved by our team before they can accept a single trip."
            />
            <Feature
              title="Trip records"
              body="Every ride is logged with route, driver and timings — available to support if anything goes wrong."
            />
          </ul>
        </Card>
      </section>

      {/* SOS confirm */}
      <Modal
        open={sosOpen}
        onClose={() => setSosOpen(false)}
        title="Send an emergency alert?"
        description="Your location goes to the AC7 safety team and your emergency contacts immediately. Only use this if you feel unsafe."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSosOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={triggerSos.isPending} onClick={() => triggerSos.mutate()}>
              Send alert
            </Button>
          </>
        }
      />

      {/* Add contact */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add emergency contact"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={addContact.isPending}
              disabled={!form.name.trim() || !form.phone_number.trim()}
              onClick={() => addContact.mutate()}
            >
              Add contact
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Fatima Hassan"
          />
          <Input
            label="Phone number"
            type="tel"
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            placeholder="+44 7700 900000"
          />
          <Input
            label="Relationship"
            hint="Optional"
            value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            placeholder="Sister"
          />
        </div>
      </Modal>

      {/* Remove contact */}
      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.name}?` : ''}
        description="They will no longer be notified if you trigger an SOS."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              loading={removeContact.isPending}
              onClick={() => removing && removeContact.mutate(removing.id)}
            >
              Remove
            </Button>
          </>
        }
      />
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-success-ink" aria-hidden />
      <div>
        <p className="text-body font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-body-sm leading-relaxed text-ink-muted">{body}</p>
      </div>
    </li>
  );
}
