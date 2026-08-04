import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@shared/lib/supabase';

/**
 * Rider ↔ driver chat.
 *
 * Messages arrive over Supabase Realtime, which streams the write-ahead log to
 * subscribed clients. Two things about that are worth knowing before changing
 * anything here:
 *
 * 1. Realtime respects RLS. A client only receives rows it could have read with
 *    a SELECT, so subscribing to the whole chat_messages table is safe — the
 *    server filters per-subscriber. The extra `filter` below is a bandwidth
 *    optimisation, not a security control.
 *
 * 2. The socket is not a delivery guarantee. A phone that sleeps mid-journey
 *    misses events entirely and gets no replay. So the thread view always
 *    fetches history on mount and treats the socket purely as an accelerator;
 *    correctness comes from the fetch, liveness from the subscription.
 */

export interface ChatThread {
  id: string;
  rider_id: string;
  driver_id: string;
  ride_id: string | null;
  subject: string | null;
  last_message: string | null;
  last_message_at: string | null;
  rider_unread: number;
  driver_unread: number;
  closed_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export const chatApi = {
  /** Threads for the signed-in person; RLS decides whether that is as rider or driver. */
  async threads(): Promise<ChatThread[]> {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .is('closed_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async thread(threadId: string): Promise<ChatThread | null> {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Newest-first from the database, reversed for display.
   *
   * Ordering descending and slicing is what makes "last 50 messages" a cheap
   * indexed query; ascending would read the whole conversation to find its end.
   */
  async messages(threadId: string, limit = 50): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []).reverse();
  },

  async send(threadId: string, senderId: string, body: string): Promise<ChatMessage> {
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Write a message first.');
    if (trimmed.length > 2000) throw new Error('That message is too long.');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ thread_id: threadId, sender_id: senderId, body: trimmed })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Find or create the thread between this rider and this driver.
   *
   * A partial unique index enforces one open thread per pair, so a duplicate
   * insert raises 23505 rather than quietly creating a second conversation that
   * makes earlier messages look lost. That collision is expected under a double
   * tap, so it is handled by re-reading rather than surfaced as an error.
   */
  async openThreadWithDriver(riderId: string, driverId: string, rideId?: string | null) {
    const existing = await supabase
      .from('chat_threads')
      .select('*')
      .eq('rider_id', riderId)
      .eq('driver_id', driverId)
      .is('closed_at', null)
      .maybeSingle();

    if (existing.data) return existing.data as ChatThread;

    const { data, error } = await supabase
      .from('chat_threads')
      .insert({ rider_id: riderId, driver_id: driverId, ride_id: rideId ?? null })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const retry = await supabase
          .from('chat_threads')
          .select('*')
          .eq('rider_id', riderId)
          .eq('driver_id', driverId)
          .is('closed_at', null)
          .single();
        if (retry.data) return retry.data as ChatThread;
      }
      throw new Error(error.message);
    }

    return data as ChatThread;
  },

  /** Zero the caller's unread counter for a thread. */
  async markRead(threadId: string, as: 'rider' | 'driver') {
    const patch = as === 'rider' ? { rider_unread: 0 } : { driver_unread: 0 };
    const { error } = await supabase.from('chat_threads').update(patch).eq('id', threadId);
    if (error) throw new Error(error.message);
  },

  /**
   * Live messages for one thread.
   *
   * Returns the unsubscribe function. Callers must invoke it on unmount —
   * a leaked channel keeps a websocket subscription open for the life of the
   * tab and will re-deliver into a component that no longer exists.
   */
  subscribeToThread(threadId: string, onMessage: (message: ChatMessage) => void): () => void {
    const channel: RealtimeChannel = supabase
      .channel(`chat:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => onMessage(payload.new as ChatMessage),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  /** Live thread-list updates, for the unread badge on the tab bar. */
  subscribeToThreads(onChange: () => void): () => void {
    const channel = supabase
      .channel('chat:threads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () =>
        onChange(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
