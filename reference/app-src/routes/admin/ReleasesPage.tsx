/**
 * AC7 Ride — Releases (admin)
 *
 * The operator's view during a rollout. One row per feature, showing where it
 * is on the ladder, how much of the audience has it, and how many distinct
 * users have hit an error in the last hour.
 *
 * ── Why the error count is "distinct users" and not "errors" ───────────────
 * Displayed as raw event volume, one user in a retry loop looks like a major
 * incident and one genuine widespread failure looks like a rounding error.
 * Distinct users is the number that correlates with how many people are
 * actually having a bad time, and it is also the number the circuit breaker
 * acts on — so the operator sees the same figure the automation sees, rather
 * than having to guess why it fired.
 *
 * ── Why Kill is styled as destructive and Promote is not ───────────────────
 * Promotion is reversible: drop the percentage back. Kill is the incident
 * action and demands a reason, because the reason is what the next person
 * reads at 3am when they find the feature switched off and no one awake to ask.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronUp,
  History,
  Loader2,
  Power,
  RefreshCw,
} from 'lucide-react';

import {
  flagAudit,
  flagHealth,
  killFlag,
  listFlags,
  nextStage,
  promoteFlag,
  setRolloutPercent,
  suggestedPercent,
  type FeatureFlag,
  type FlagAuditEntry,
  type FlagHealth,
  type FlagStage,
} from '@shared/api/releases';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { PageHeader, SectionHeader } from '@shared/components/ui/PageHeader';
import { useFlags } from '@shared/providers/FlagsProvider';
import { cn } from '@shared/lib/utils';

/* -------------------------------------------------------------------------- */

const STAGE_TONE: Record<FlagStage, 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'muted'> = {
  off: 'muted',
  internal: 'neutral',
  canary: 'warning',
  rollout: 'brand',
  ga: 'success',
  killed: 'danger',
};

const STAGE_LABEL: Record<FlagStage, string> = {
  off: 'Off',
  internal: 'Staff only',
  canary: 'Canary',
  rollout: 'Rolling out',
  ga: 'Everyone',
  killed: 'Killed',
};

/* -------------------------------------------------------------------------- */

export function ReleasesPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [health, setHealth] = useState<Record<string, FlagHealth>>({});
  const [audit, setAudit] = useState<FlagAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { refresh: refreshLiveFlags } = useFlags();

  const load = useCallback(async () => {
    try {
      setError(null);
      const [f, h, a] = await Promise.all([listFlags(), flagHealth(60), flagAudit(30)]);

      setFlags(f);
      setHealth(Object.fromEntries(h.map((row) => [row.flag_key, row])));
      setAudit(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load releases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    /* Refresh while the page is open. During a rollout this is the screen
       somebody is watching, and a stale error count is the one number that
       must not be stale. */
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  /** Run an action, then reload both this page and the app's own flag state. */
  const act = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setBusy(key);
      try {
        setError(null);
        await fn();
        await load();
        await refreshLiveFlags();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That did not work.');
      } finally {
        setBusy(null);
      }
    },
    [load, refreshLiveFlags],
  );

  const atRisk = useMemo(
    () => flags.filter((f) => (health[f.key]?.distinct_users ?? 0) > 0 && f.stage !== 'killed'),
    [flags, health],
  );

  return (
    <div>
      <PageHeader
        title="Releases"
        description="Every feature ships dark. This is where it gets turned on — a few people first, everyone last, and off again in one click if it misbehaves."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} leadingIcon={<RefreshCw size={15} />}>
            Refresh
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-tile border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger-ink"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {atRisk.length > 0 && (
        <div
          role="status"
          className="mb-5 rounded-tile border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-warning-ink"
        >
          <strong>{atRisk.length} live feature{atRisk.length === 1 ? '' : 's'}</strong> reported
          errors in the last hour. Check the count against the breaker threshold before promoting
          anything further.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-body-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading releases
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              health={health[flag.key]}
              busy={busy === flag.key}
              onPromote={(stage, percent) =>
                act(flag.key, () => promoteFlag(flag.key, stage, percent))
              }
              onPercent={(p) => act(flag.key, () => setRolloutPercent(flag.key, p))}
              onKill={(reason) => act(flag.key, () => killFlag(flag.key, reason))}
            />
          ))}
        </div>
      )}

      <SectionHeader
        title="Recent changes"
        description="Who moved what, and when. Written by a database trigger, so it cannot be skipped."
        className="mt-10"
      />

      <Card tone="flat" padded={false} className="overflow-hidden">
        {audit.length === 0 ? (
          <p className="px-5 py-6 text-body-sm text-ink-muted">Nothing has changed yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                <History size={14} className="shrink-0 text-ink-subtle" aria-hidden />
                <span className="font-mono text-body-sm text-ink">{entry.flag_key}</span>
                <span className="text-body-sm text-ink-muted">
                  {entry.from_stage ?? '—'} → {entry.to_stage ?? '—'}
                  {entry.to_percent !== null && entry.to_percent !== entry.from_percent
                    ? ` at ${entry.to_percent}%`
                    : ''}
                </span>
                <Badge tone={entry.actor_label === 'system' ? 'danger' : 'neutral'} size="sm">
                  {entry.actor_label === 'system' ? 'circuit breaker' : 'admin'}
                </Badge>
                {entry.reason && (
                  <span className="text-caption text-ink-subtle">{entry.reason}</span>
                )}
                <time className="ml-auto text-caption tabular-nums text-ink-subtle">
                  {new Date(entry.at).toLocaleString('en-GB')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FlagRow({
  flag,
  health,
  busy,
  onPromote,
  onPercent,
  onKill,
}: {
  flag: FeatureFlag;
  health: FlagHealth | undefined;
  busy: boolean;
  onPromote: (stage: FlagStage, percent?: number) => void;
  onPercent: (percent: number) => void;
  onKill: (reason: string) => void;
}) {
  const [percent, setPercent] = useState(flag.rollout_percent);
  const [killing, setKilling] = useState(false);
  const [reason, setReason] = useState('');

  /* Keep the slider honest when the value changes underneath us — the circuit
     breaker or another admin can move it while this page is open. */
  useEffect(() => setPercent(flag.rollout_percent), [flag.rollout_percent]);

  const next = nextStage(flag.stage);
  const errorUsers = health?.distinct_users ?? 0;
  const showsPercent = flag.stage === 'canary' || flag.stage === 'rollout';

  /* The breaker fires at breaker_min_users. Showing how close we are turns an
     abstract threshold into something an operator can act on before it trips. */
  const nearThreshold = errorUsers > 0 && errorUsers >= flag.breaker_min_users - 1;

  return (
    <Card tone="flat" className={cn(busy && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-body font-semibold text-ink">{flag.key}</span>
            <Badge tone={STAGE_TONE[flag.stage]} size="sm">
              {STAGE_LABEL[flag.stage]}
            </Badge>
            {showsPercent && (
              <Badge tone="neutral" size="sm">
                {flag.rollout_percent}% of {flag.audience === 'all' ? 'users' : `${flag.audience}s`}
              </Badge>
            )}
            {flag.audience !== 'all' && !showsPercent && (
              <Badge tone="neutral" size="sm">
                {flag.audience}s only
              </Badge>
            )}
          </div>

          <p className="mt-1.5 text-body-sm text-ink-muted">{flag.description}</p>

          {flag.stage === 'killed' && flag.killed_reason && (
            <p className="mt-2 flex items-start gap-1.5 text-body-sm text-danger-ink">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
              {flag.killed_reason}
            </p>
          )}

          <p
            className={cn(
              'mt-2 text-caption tabular-nums',
              nearThreshold ? 'font-semibold text-danger-ink' : 'text-ink-subtle',
            )}
          >
            {errorUsers === 0
              ? 'No errors reported in the last hour'
              : `${errorUsers} user${errorUsers === 1 ? '' : 's'} hit errors in the last hour — breaker trips at ${flag.breaker_min_users}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {next && flag.stage !== 'ga' && (
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              leadingIcon={<ChevronUp size={15} />}
              onClick={() => onPromote(next, suggestedPercent(next))}
            >
              {flag.stage === 'killed' ? 'Restart on staff' : `Promote to ${STAGE_LABEL[next]}`}
            </Button>
          )}

          {flag.stage !== 'off' && flag.stage !== 'killed' && (
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              leadingIcon={<Power size={15} />}
              onClick={() => setKilling((v) => !v)}
            >
              Kill
            </Button>
          )}
        </div>
      </div>

      {/* Percentage control — only where a percentage means anything. */}
      {showsPercent && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <label htmlFor={`pct-${flag.key}`} className="text-body-sm text-ink-muted">
            Rollout
          </label>
          <input
            id={`pct-${flag.key}`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            disabled={busy}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="h-2 flex-1 accent-[rgb(var(--brand))]"
          />
          <span className="w-12 text-right text-body-sm font-semibold tabular-nums text-ink">
            {percent}%
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || percent === flag.rollout_percent}
            leadingIcon={<Check size={15} />}
            onClick={() => onPercent(percent)}
          >
            Apply
          </Button>
        </div>
      )}

      {/* Kill confirmation. The reason is required, not optional: an unexplained
          kill is indistinguishable from a mistake when someone finds it later. */}
      {killing && (
        <div className="mt-4 rounded-tile border border-danger/30 bg-danger-soft p-4">
          <label htmlFor={`reason-${flag.key}`} className="text-body-sm font-semibold text-danger-ink">
            Why is this being switched off?
          </label>
          <input
            id={`reason-${flag.key}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Fares coming back as NaN for airport trips"
            className="mt-2 h-11 w-full rounded-control border border-line bg-bg px-3 text-body text-ink"
          />
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={busy || reason.trim().length < 5}
              onClick={() => {
                onKill(reason.trim());
                setKilling(false);
                setReason('');
              }}
            >
              Switch it off
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setKilling(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
