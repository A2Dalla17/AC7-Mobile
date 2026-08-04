import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MessageSquare, ScanLine } from 'lucide-react';

import { chatApi } from '@shared/api/chat';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState, ErrorState } from '@shared/components/ui/EmptyState';
import { NoNotificationsArt } from '@shared/components/ui/Illustration';
import { ScreenHeader } from '@shared/components/ui/PageHeader';
import { SkeletonList } from '@shared/components/ui/Skeleton';
import { useAuth } from '@shared/providers/AuthProvider';

/**
 * Conversation list, shared by riders and drivers.
 *
 * RLS decides which rows come back, so the same query serves both roles; only
 * the unread column and the copy differ. Keeping one component means a change
 * to how conversations look cannot land for one side and be forgotten for the
 * other, which is exactly how the two halves of a messaging feature drift apart.
 */
export function MessagesPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isDriver = role === 'driver';

  const threads = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => chatApi.threads(),
  });

  /* Keep the list current while it is open — a new message should not require
     a pull to refresh. */
  useEffect(() => {
    const unsubscribe = chatApi.subscribeToThreads(() => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    });
    return unsubscribe;
  }, [queryClient]);

  const items = threads.data ?? [];
  const base = isDriver ? '/driver' : '/rider';

  return (
    <div className="min-h-full bg-surface pb-tabbar">
      <ScreenHeader
        title="Messages"
        subtitle={isDriver ? 'Your passengers' : 'Your drivers'}
        onBack={false}
      />

      <section className="px-gutter pt-5">
        {threads.isLoading && <SkeletonList count={3} />}

        {threads.isError && (
          <ErrorState
            title="Couldn't load your messages"
            description="Check your connection and try again."
            onRetry={() => void threads.refetch()}
          />
        )}

        {!threads.isLoading && !threads.isError && items.length === 0 && (
          <Card padded={false}>
            <EmptyState
              art={<NoNotificationsArt />}
              title="No conversations yet"
              description={
                isDriver
                  ? 'When a passenger messages you about a job, it will appear here.'
                  : 'Message a driver from an active trip, or look one up by their code.'
              }
              action={
                isDriver ? undefined : (
                  <Link to="/d">
                    <Button leadingIcon={<ScanLine size={16} />}>Find a driver by code</Button>
                  </Link>
                )
              }
            />
          </Card>
        )}

        <ul className="stagger space-y-2.5">
          {items.map((thread) => {
            const unread = isDriver ? thread.driver_unread : thread.rider_unread;
            const when = thread.last_message_at ?? thread.created_at;

            return (
              <li key={thread.id}>
                <Link
                  to={`${base}/chat/${thread.id}`}
                  className="liftable flex items-center gap-3 rounded-card border border-line bg-card p-4 shadow-card"
                >
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink"
                  >
                    <MessageSquare size={18} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-body font-semibold text-ink">
                        {thread.subject ?? (isDriver ? 'Passenger' : 'Driver')}
                      </p>
                      <time
                        dateTime={when}
                        className="tabular shrink-0 text-micro text-ink-subtle"
                      >
                        {relativeTime(when)}
                      </time>
                    </div>
                    <p className="clamp-2 mt-0.5 text-body-sm text-ink-muted">
                      {thread.last_message ?? 'No messages yet'}
                    </p>
                  </div>

                  {unread > 0 ? (
                    <Badge tone="brand" size="sm">
                      {unread}
                    </Badge>
                  ) : (
                    <ChevronRight size={17} className="shrink-0 text-ink-subtle" aria-hidden />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * "4m", "2h", "Tue", "12 Mar" — the granularity people actually want, which
 * decreases as the message gets older. An exact timestamp on a message from
 * last month is noise.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return then.toLocaleDateString('en-GB', { weekday: 'short' });
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
