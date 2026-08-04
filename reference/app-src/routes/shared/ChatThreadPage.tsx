import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, SendHorizonal, WifiOff } from 'lucide-react';

import { chatApi, type ChatMessage } from '@shared/api/chat';
import { driversApi } from '@shared/api/drivers';
import { Button } from '@shared/components/ui/Button';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { NoNotificationsArt } from '@shared/components/ui/Illustration';
import { Spinner } from '@shared/components/ui/Spinner';
import { useAuth } from '@shared/providers/AuthProvider';
import { cn } from '@shared/lib/utils';

/**
 * One conversation.
 *
 * ── How live and loaded messages are reconciled ────────────────────────────
 * History comes from a fetch; new messages arrive on a websocket. Both write
 * into the same React Query cache entry, keyed by message id, because the two
 * WILL overlap: a message you just sent arrives back over the socket a moment
 * after the insert returns it, and a socket event can land while the initial
 * fetch is still in flight. Deduplicating by id at the point of merge is the
 * only place that is cheap and correct — filtering on render would still leave
 * two entries in the cache.
 *
 * The socket is treated as an accelerator, never as the source of truth. A
 * phone that sleeps mid-journey silently misses events and gets no replay, so
 * the fetch on mount is what guarantees the conversation is complete.
 */
export function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState('');
  const [live, setLive] = useState(true);

  const scroller = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);

  /* A "new" thread is addressed by driver code rather than id, so the lookup
     result can link straight here without first creating an empty conversation
     that would litter the list if the person changed their mind. */
  const driverCode = params.get('driver');

  const resolved = useQuery({
    queryKey: ['chat', 'resolve', threadId ?? driverCode],
    enabled: Boolean(user) && Boolean(threadId || driverCode),
    queryFn: async () => {
      if (threadId && threadId !== 'new') return chatApi.thread(threadId);
      if (!driverCode || !user) return null;

      const driver = await driversApi.lookupByCode(driverCode);
      if (!driver) throw new Error('That driver code does not exist.');

      // lookup_driver_by_code deliberately does not return the driver's row id,
      // so the thread is opened by code through a dedicated call rather than by
      // widening the public lookup's return type.
      const { data, error } = await import('@shared/lib/supabase').then(({ supabase }) =>
        supabase.rpc('open_thread_with_driver_code', { p_code: driverCode }),
      );
      if (error) throw new Error(error.message);
      return chatApi.thread(data as string);
    },
  });

  const thread = resolved.data ?? null;

  const messages = useQuery({
    queryKey: ['chat', 'messages', thread?.id],
    enabled: Boolean(thread?.id),
    queryFn: () => chatApi.messages(thread!.id),
  });

  /* -- Live -------------------------------------------------------------- */
  useEffect(() => {
    if (!thread?.id) return;

    const unsubscribe = chatApi.subscribeToThread(thread.id, (incoming) => {
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', thread.id], (current) => {
        const list = current ?? [];
        if (list.some((m) => m.id === incoming.id)) return list;
        return [...list, incoming];
      });
    });

    setLive(true);
    return () => {
      unsubscribe();
      setLive(false);
    };
  }, [thread?.id, queryClient]);

  /* Clear the unread badge on open. */
  useEffect(() => {
    if (!thread?.id || !role) return;
    void chatApi
      .markRead(thread.id, role === 'driver' ? 'driver' : 'rider')
      .then(() => queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] }))
      .catch(() => {
        /* A failed read receipt is not worth interrupting the conversation. */
      });
  }, [thread?.id, role, queryClient]);

  const send = useMutation({
    mutationFn: (body: string) => chatApi.send(thread!.id, user!.id, body),
    onSuccess: (message) => {
      setDraft('');
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', thread!.id], (current) => {
        const list = current ?? [];
        return list.some((m) => m.id === message.id) ? list : [...list, message];
      });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });

  const items = messages.data ?? [];

  /* Pin to the newest message. useLayoutEffect so it happens before paint —
     with useEffect the list visibly jumps on every incoming message. */
  useLayoutEffect(() => {
    foot.current?.scrollIntoView({ block: 'end' });
  }, [items.length]);

  const grouped = useMemo(() => groupByDay(items), [items]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-gutter py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back to messages"
            className="pressable -ml-1 grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-surface"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h5 text-ink">
              {thread?.subject ?? (role === 'driver' ? 'Passenger' : 'Your driver')}
            </h1>
            <p className="text-micro text-ink-subtle">
              {live ? 'Messages appear here instantly' : 'Reconnecting'}
            </p>
          </div>
          {!live && <WifiOff size={16} className="text-warning-ink" aria-label="Offline" />}
        </div>
      </header>

      <div ref={scroller} className="mx-auto w-full max-w-lg flex-1 px-gutter py-4">
        {(resolved.isLoading || messages.isLoading) && (
          <div className="grid place-items-center py-16">
            <Spinner size="lg" className="text-brand-ink" />
          </div>
        )}

        {resolved.isError && (
          <p className="rounded-tile bg-danger-soft px-4 py-3 text-body-sm text-danger-ink">
            {(resolved.error as Error).message}
          </p>
        )}

        {!messages.isLoading && items.length === 0 && thread && (
          <EmptyState
            art={<NoNotificationsArt />}
            title="No messages yet"
            description="Say hello — they will get this straight away."
          />
        )}

        <ol className="space-y-4">
          {grouped.map(([day, dayMessages]) => (
            <li key={day}>
              <p className="mb-3 text-center text-micro uppercase tracking-wide text-ink-subtle">
                {day}
              </p>
              <ol className="space-y-1.5">
                {dayMessages.map((message, index) => {
                  const mine = message.sender_id === user.id;
                  const previous = dayMessages[index - 1];
                  /* Consecutive messages from the same person square off the
                     inner corner, so a burst reads as one utterance. */
                  const sequential = previous?.sender_id === message.sender_id;
                  return (
                    <li key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[78%] px-3.5 py-2.5',
                          mine
                            ? 'rounded-[1.1rem] rounded-br-md bg-brand text-white'
                            : 'rounded-[1.1rem] rounded-bl-md border border-line bg-card text-ink',
                          sequential && (mine ? 'rounded-tr-md' : 'rounded-tl-md'),
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words text-body-sm leading-relaxed">
                          {message.body}
                        </p>
                        <time
                          dateTime={message.created_at}
                          className={cn(
                            'mt-1 block text-right text-micro tabular',
                            mine ? 'text-white/70' : 'text-ink-subtle',
                          )}
                        >
                          {new Date(message.created_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
        <div ref={foot} />
      </div>

      {/* Composer */}
      <form
        className="sticky bottom-0 border-t border-line bg-bg/95 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() && thread) send.mutate(draft);
        }}
      >
        <div className="mx-auto flex max-w-lg items-end gap-2 px-gutter py-3 pb-[calc(0.75rem+var(--safe-bottom))]">
          <label htmlFor="chat-draft" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-draft"
            rows={1}
            value={draft}
            disabled={!thread || send.isPending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter makes a new line — the convention every
              // messaging app uses, so muscle memory carries over.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (draft.trim() && thread) send.mutate(draft);
              }
            }}
            placeholder="Message"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-[1.25rem] border border-line bg-card px-4 py-3 text-body-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-50"
          />
          <Button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim() || !thread}
            loading={send.isPending}
            className="h-11 w-11 shrink-0 rounded-full p-0"
          >
            <SendHorizonal size={17} aria-hidden />
          </Button>
        </div>

        {send.isError && (
          <p className="px-gutter pb-2 text-center text-caption text-danger-ink">
            {(send.error as Error).message}
          </p>
        )}
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Group messages under Today / Yesterday / a date, the way people read them. */
function groupByDay(messages: ChatMessage[]): Array<[string, ChatMessage[]]> {
  const today = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toDateString();

  const buckets = new Map<string, ChatMessage[]>();

  for (const message of messages) {
    const stamp = new Date(message.created_at).toDateString();
    const label =
      stamp === today
        ? 'Today'
        : stamp === yesterday
          ? 'Yesterday'
          : new Date(message.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
            });

    const existing = buckets.get(label);
    if (existing) existing.push(message);
    else buckets.set(label, [message]);
  }

  return [...buckets.entries()];
}
