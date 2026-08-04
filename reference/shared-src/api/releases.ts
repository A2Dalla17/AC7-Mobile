/**
 * AC7 Ride — release control API (admin)
 *
 * Everything here goes through Supabase RPC rather than table writes, because
 * the stage machine lives in the database. promote_flag() is what refuses to
 * let a release jump from internal straight to everybody; if the console wrote
 * to the table directly, that rule would only exist in the UI, and the UI is
 * not the only thing that can issue an UPDATE.
 */

import { supabase } from '@shared/lib/supabase';
import type { FlagKey } from '@shared/lib/flags';

export type FlagStage = 'off' | 'internal' | 'canary' | 'rollout' | 'ga' | 'killed';

export interface FeatureFlag {
  key: string;
  description: string;
  stage: FlagStage;
  rollout_percent: number;
  audience: 'all' | 'rider' | 'driver' | 'admin';
  include_anonymous: boolean;
  fallback: boolean;
  breaker_enabled: boolean;
  breaker_min_users: number;
  breaker_window_mins: number;
  killed_at: string | null;
  killed_reason: string | null;
  updated_at: string;
}

export interface FlagHealth {
  flag_key: string;
  stage: FlagStage;
  rollout_percent: number;
  events: number;
  distinct_users: number;
  last_event_at: string | null;
}

export interface FlagAuditEntry {
  id: number;
  flag_key: string;
  actor_label: string;
  from_stage: string | null;
  to_stage: string | null;
  from_percent: number | null;
  to_percent: number | null;
  reason: string;
  at: string;
}

/** The next stage in the ladder, or null at the top. Mirrors promote_flag(). */
export function nextStage(stage: FlagStage): FlagStage | null {
  const ladder: FlagStage[] = ['off', 'internal', 'canary', 'rollout', 'ga'];
  if (stage === 'killed') return 'internal'; // a killed flag restarts on staff only
  const i = ladder.indexOf(stage);
  return i >= 0 && i < ladder.length - 1 ? (ladder[i + 1] as FlagStage) : null;
}

/**
 * Suggested percentage when entering a stage.
 *
 * These are starting points, not a schedule — the operator can set anything.
 * 5% for a canary is small enough that a bad release harms a handful of people
 * and large enough that, at AC7's volume, somebody actually exercises it.
 */
export function suggestedPercent(stage: FlagStage): number {
  switch (stage) {
    case 'canary':
      return 5;
    case 'rollout':
      return 25;
    case 'ga':
      return 100;
    default:
      return 0;
  }
}

export async function listFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('key');

  if (error) throw new Error(error.message);
  return (data ?? []) as FeatureFlag[];
}

export async function flagHealth(windowMins = 60): Promise<FlagHealth[]> {
  const { data, error } = await supabase.rpc('flag_health', {
    p_window_mins: windowMins,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as FlagHealth[];
}

export async function flagAudit(limit = 40): Promise<FlagAuditEntry[]> {
  const { data, error } = await supabase
    .from('feature_flag_audit')
    .select('*')
    .order('at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as FlagAuditEntry[];
}

export async function promoteFlag(
  key: string,
  stage: FlagStage,
  percent?: number,
  reason = '',
): Promise<void> {
  const { error } = await supabase.rpc('promote_flag', {
    p_key: key,
    p_stage: stage,
    p_percent: percent ?? null,
    p_reason: reason,
  });

  if (error) throw new Error(error.message);
}

/** Change the percentage without changing stage. */
export async function setRolloutPercent(key: string, percent: number): Promise<void> {
  const { error } = await supabase
    .from('feature_flags')
    .update({ rollout_percent: Math.max(0, Math.min(100, Math.round(percent))) })
    .eq('key', key);

  if (error) throw new Error(error.message);
}

/** The incident button. Always available, from any stage. */
export async function killFlag(key: string, reason: string): Promise<void> {
  return promoteFlag(key, 'killed', undefined, reason || 'killed by admin');
}

/** Type guard so the admin page can link a row back to a known client flag. */
export function isKnownFlag(key: string, known: readonly string[]): key is FlagKey {
  return known.includes(key);
}
