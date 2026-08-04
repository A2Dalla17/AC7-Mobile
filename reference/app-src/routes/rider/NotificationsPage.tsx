import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, Car, CheckCheck, CreditCard, Gift, ShieldAlert, Star,
} from 'lucide-react';

import { notificationsApi } from '@shared/api';
import { env } from '@shared/config/env';
import type { Notification } from '@shared/api/types';
import { Button, IconButton } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { cn, formatRelative } from '@shared/lib/utils';

/** Icon and tint per notification type, so the list is scannable. */
function iconFor(type: string) {
  const t = type.toLowerCase();
  if (t.includes('ride') || t.includes('trip') || t.includes('driver'))
    return { icon: <Car size={17} />, tone: 'brand' as const };
  if (t.includes('payment') || t.includes('wallet') || t.includes('refund'))
    return { icon: <CreditCard size={17} />, tone: 'success' as const };
  if (t.includes('promo') || t.includes('gift') || t.includes('referral'))
    return { icon: <Gift size={17} />, tone: 'brand' as const };
  if (t.includes('safety') || t.includes('sos') || t.includes('emergency'))
    return { icon: <ShieldAlert size={17} />, tone: 'danger' as const };
  if (t.includes('rating') || t.includes('review'))
    return { icon: <Star size={17} />, tone: 'brand' as const };
  return { icon: <Bell size={17} />, tone: 'muted' as const };
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ per_page: 50 }),
    retry: 1,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows = notifications.data?.items ?? [];
  const unread = rows.filter((n) => !n.is_read);

  // Group by day so a long list stays readable.
  const groups = rows.reduce<Record<string, Notification[]>>((acc, n) => {
    const d = new Date(n.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const key =
      d.toDateString() === today.toDateString()
        ? 'Today'
        : d.toDateString() === yesterday.toDateString()
          ? 'Yesterday'
          : d.toLocaleDateString(env.locale, { day: 'numeric', month: 'long' });

    (acc[key] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div className="min-h-full bg-surface pb-[calc(6rem+var(--safe-bottom))]">
      <header className="flex items-center justify-between px-5 pb-4 pt-[calc(1rem+var(--safe-top))]">
        <IconButton label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>

        <div className="text-center">
          <h1 className="text-body-lg font-bold tracking-[-0.02em] text-ink">Notifications</h1>
          {unread.length > 0 && (
            <p className="text-[0.6875rem] text-brand-ink">{unread.length} unread</p>
          )}
        </div>

        {unread.length > 0 ? (
          <IconButton
            label="Mark all as read"
            onClick={() => unread.forEach((n) => markRead.mutate(n.id))}
          >
            <CheckCheck size={18} />
          </IconButton>
        ) : (
          <span className="w-11" />
        )}
      </header>

      <section className="px-5">
        {notifications.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bell size={22} />}
              title="Nothing new"
              description="Trip updates, payment receipts and offers will appear here."
              action={<Button onClick={() => navigate('/rider')}>Book a ride</Button>}
            />
          </Card>
        ) : (
          Object.entries(groups).map(([day, items]) => (
            <div key={day} className="mb-6">
              <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-ink-subtle">
                {day}
              </h2>

              <ul className="space-y-2">
                {items.map((n) => {
                  const { icon, tone } = iconFor(n.type);

                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => !n.is_read && markRead.mutate(n.id)}
                        className={cn(
                          'flex w-full gap-3 rounded-card border p-4 text-left transition-all duration-200 ease-smooth',
                          n.is_read
                            ? 'border-line bg-card'
                            : 'border-brand/25 bg-brand/[0.04] hover:border-brand/40',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                            tone === 'brand' && 'bg-brand-soft text-brand-ink',
                            tone === 'success' && 'bg-success-soft text-success',
                            tone === 'danger' && 'bg-danger-soft text-danger',
                            tone === 'muted' && 'bg-surface text-ink-muted',
                          )}
                        >
                          {icon}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span
                              className={cn(
                                'text-body leading-snug',
                                n.is_read ? 'font-medium text-ink' : 'font-semibold text-ink',
                              )}
                            >
                              {n.title}
                            </span>
                            <span className="shrink-0 text-[0.6875rem] text-ink-subtle">
                              {formatRelative(n.created_at)}
                            </span>
                          </span>

                          <span className="mt-1 block text-body-sm leading-relaxed text-ink-muted">
                            {n.body}
                          </span>
                        </span>

                        {!n.is_read && (
                          <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
