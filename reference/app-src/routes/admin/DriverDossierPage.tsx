/**
 * ACT — driver vetting (admin)
 *
 * Every applicant, their code, their documents and the decision.
 *
 * ── Why documents open through a signed URL rather than an <img src> ───────
 * The bucket is private, so there is no permanent URL to embed. Each view
 * mints a link that dies in five minutes. That is deliberate: a permanent URL
 * to a passport scan survives being pasted into a support chat, forwarded in
 * an email or logged by a proxy, and stays fetchable by anyone who ever saw
 * it. A five-minute link bounds every one of those.
 *
 * ── Why rejection needs a reason ───────────────────────────────────────────
 * The reason is shown to the driver on their checklist. "Rejected" with no
 * explanation produces a support call and a re-upload of the identical file.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  Eye,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import {
  adminDriverDocuments,
  adminListDrivers,
  CATEGORY_LABEL,
  compliance as fetchCompliance,
  documentStatus,
  documentUrl,
  reviewApplication,
  reviewDocument,
  STATUS_LABEL,
  type AdminDriverRow,
  type ApplicationStatus,
  type DocumentRow,
  type DriverCompliance,
} from '@shared/api/compliance';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { PageHeader, SectionHeader } from '@shared/components/ui/PageHeader';
import { cn } from '@shared/lib/utils';

const APP_TONE: Record<ApplicationStatus, 'muted' | 'warning' | 'success' | 'danger' | 'brand'> = {
  draft: 'muted',
  submitted: 'warning',
  more_info: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

export function DriverDossierPage() {
  const [rows, setRows] = useState<AdminDriverRow[]>([]);
  const [selected, setSelected] = useState<AdminDriverRow | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await adminListDrivers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load drivers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.driver_code?.toLowerCase().includes(q) ||
        r.vehicle_plate?.toLowerCase().includes(q) ||
        r.vehicle_model?.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const waiting = rows.filter((r) => r.application_status === 'submitted').length;

  if (selected) {
    return (
      <DriverDetail
        driver={selected}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        description="Every applicant, their code and their documents. Nobody can go online until they are approved here."
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

      {waiting > 0 && (
        <div className="mb-5 rounded-tile border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-warning-ink">
          <strong>{waiting}</strong> application{waiting === 1 ? '' : 's'} waiting for review.
        </div>
      )}

      <div className="mb-5 flex items-center gap-2 rounded-control border border-line bg-card px-3">
        <Search size={16} className="text-ink-subtle" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by driver code, plate or model"
          aria-label="Search drivers"
          className="h-11 flex-1 bg-transparent text-body text-ink outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-body-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading drivers
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-body-sm text-ink-muted">No drivers yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              tone="flat"
              interactive
              onClick={() => setSelected(r)}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* The driver code, prominent — it is how the control centre
                      and riders refer to this person. */}
                  <span className="rounded-control bg-brand-soft px-2 py-0.5 font-mono text-body font-bold text-brand-ink">
                    {r.driver_code}
                  </span>
                  <Badge tone={APP_TONE[r.application_status]} size="sm">
                    {STATUS_LABEL[r.application_status]}
                  </Badge>
                  <Badge tone="neutral" size="sm">
                    {CATEGORY_LABEL[r.vehicle_category]}
                  </Badge>
                </div>
                <p className="mt-1.5 text-body-sm text-ink-muted">
                  {[r.vehicle_make, r.vehicle_model, r.vehicle_color, r.vehicle_plate]
                    .filter(Boolean)
                    .join(' · ') || 'No vehicle details yet'}
                </p>
              </div>
              <Button size="sm" variant="outline">
                Open
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DriverDetail({ driver, onBack }: { driver: AdminDriverRow; onBack: () => void }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [stored, setStored] = useState<Array<{ id: string; doc_type: string; storage_path: string }>>(
    [],
  );
  const [comp, setComp] = useState<DriverCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [rows, files, c] = await Promise.all([
        documentStatus(driver.id),
        adminDriverDocuments(driver.id),
        fetchCompliance(driver.id),
      ]);
      setDocs(rows);
      setStored(files as Array<{ id: string; doc_type: string; storage_path: string }>);
      setComp(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this driver.');
    } finally {
      setLoading(false);
    }
  }, [driver.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      setError(null);
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const view = async (docType: string) => {
    const f = stored.find((s) => s.doc_type === docType);
    if (!f) return;
    const url = await documentUrl(f.storage_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const outstanding = docs.filter(
    (d) => d.is_required && ['missing', 'rejected', 'expired'].includes(d.status),
  );

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={16} aria-hidden />
        All drivers
      </button>

      <PageHeader
        title={driver.driver_code}
        description={`${CATEGORY_LABEL[driver.vehicle_category]} · ${STATUS_LABEL[driver.application_status]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="success"
              disabled={busy || outstanding.length > 0}
              leadingIcon={<ShieldCheck size={15} />}
              onClick={() => void act(() => reviewApplication(driver.id, 'approved'))}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  reviewApplication(driver.id, 'more_info', 'Some documents need replacing.'),
                )
              }
            >
              Ask for more
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              leadingIcon={<ShieldX size={15} />}
              onClick={() => void act(() => reviewApplication(driver.id, 'rejected'))}
            >
              Reject
            </Button>
          </div>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-tile border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger-ink"
        >
          {error}
        </div>
      )}

      {outstanding.length > 0 && (
        <div className="mb-5 rounded-tile border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-warning-ink">
          Cannot approve yet — {outstanding.length} required document
          {outstanding.length === 1 ? '' : 's'} outstanding.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-body-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading
        </div>
      ) : (
        <>
          <SectionHeader title="Details" />
          <Card tone="flat" className="mb-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Detail label="Driver code" value={driver.driver_code} mono />
            <Detail label="Vehicle" value={[driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(' ')} />
            <Detail label="Number plate" value={driver.vehicle_plate} mono />
            <Detail label="Date of birth" value={comp?.date_of_birth} />
            <Detail label="National Insurance" value={comp?.national_insurance_no} mono />
            <Detail label="Driving licence" value={comp?.dvla_licence_no} mono />
            <Detail label="PHV driver licence" value={comp?.phv_driver_licence_no} mono />
            <Detail label="PHV vehicle licence" value={comp?.phv_vehicle_licence_no} mono />
            <Detail label="Insurance" value={comp?.insurance_provider} />
            <Detail label="Policy number" value={comp?.insurance_policy_no} mono />
            <Detail
              label="Hire and reward cover"
              value={comp?.insurance_is_hire_and_reward ? 'Confirmed by driver' : 'NOT confirmed'}
              warn={!comp?.insurance_is_hire_and_reward}
            />
            <Detail label="MOT expires" value={comp?.mot_expiry} />
            <Detail label="DBS certificate" value={comp?.dbs_certificate_no} mono />
            <Detail label="Submitted" value={comp?.submitted_at?.slice(0, 10)} />
          </Card>

          <SectionHeader title="Documents" />
          <div className="space-y-3">
            {docs.map((d) => {
              const file = stored.find((s) => s.doc_type === d.doc_type);
              return (
                <Card key={d.doc_type} tone="flat">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText size={15} className="text-ink-subtle" aria-hidden />
                        <span className="text-body font-semibold text-ink">{d.label}</span>
                        {!d.is_required && (
                          <Badge tone="neutral" size="sm">
                            Optional
                          </Badge>
                        )}
                        <Badge
                          tone={
                            d.status === 'approved'
                              ? 'success'
                              : d.status === 'pending'
                                ? 'warning'
                                : d.status === 'missing'
                                  ? 'muted'
                                  : 'danger'
                          }
                          size="sm"
                        >
                          {d.status}
                        </Badge>
                      </div>
                      {d.expires_on && (
                        <p className="mt-1 text-caption text-ink-subtle">Expires {d.expires_on}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {file && (
                        <Button
                          size="sm"
                          variant="outline"
                          leadingIcon={<Eye size={15} />}
                          onClick={() => void view(d.doc_type)}
                        >
                          View
                        </Button>
                      )}
                      {file && d.status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="success"
                          disabled={busy}
                          onClick={() => void act(() => reviewDocument(file.id, 'approved'))}
                        >
                          Approve
                        </Button>
                      )}
                      {file && d.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            void act(() =>
                              reviewDocument(file.id, 'rejected', 'Not clear enough — please re-upload.'),
                            )
                          }
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  warn,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
      <span className="text-body-sm text-ink-muted">{label}</span>
      <span
        className={cn(
          'text-right text-body-sm',
          mono && 'font-mono',
          warn ? 'font-semibold text-danger-ink' : 'text-ink',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}
