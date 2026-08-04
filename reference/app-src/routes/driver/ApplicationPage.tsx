/**
 * ACT — driver application
 *
 * The form someone fills in to be allowed to drive. It is long because the
 * legal requirements are long; the job of the design is to make a long form
 * feel finishable.
 *
 * ── Why the checklist is a checklist and not one giant form ────────────────
 * Nobody completes this in one sitting. A driver photographs their MOT at the
 * garage, their bank statement at home, and their passport when they find it.
 * So every upload saves immediately and independently, the page always shows
 * what is left, and there is no "submit or lose everything" cliff. Submission
 * is a separate, deliberate act at the end.
 *
 * ── Why the vehicle type is chosen first ───────────────────────────────────
 * It decides everything else. A cyclist asked for an MOT certificate will
 * assume the form is broken and leave. The requirements come from the
 * database, so a bicycle simply never renders those rows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Car,
  Check,
  CheckCircle2,
  Clock,
  FileUp,
  Loader2,
  Send,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';

import {
  CATEGORY_LABEL,
  compliance as fetchCompliance,
  documentStatus,
  myDriverRecord,
  saveCompliance,
  STATUS_LABEL,
  submitApplication,
  uploadDocument,
  type ApplicationStatus,
  type DocStatus,
  type DocumentRow,
  type DriverCompliance,
  type VehicleCategory,
} from '@shared/api/compliance';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { PageHeader, SectionHeader } from '@shared/components/ui/PageHeader';
import { cn } from '@shared/lib/utils';

/* -------------------------------------------------------------------------- */

const STATUS_TONE: Record<DocStatus, 'muted' | 'warning' | 'success' | 'danger'> = {
  missing: 'muted',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  expired: 'danger',
};

const STATUS_TEXT: Record<DocStatus, string> = {
  missing: 'Not uploaded',
  pending: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

const CATEGORY_ICON = { car: Car, motorbike: Bike, bicycle: Bike } as const;

export function ApplicationPage() {
  const [driverId, setDriverId] = useState<string | null>(null);
  const [category, setCategory] = useState<VehicleCategory>('car');
  const [appStatus, setAppStatus] = useState<ApplicationStatus>('draft');
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [comp, setComp] = useState<Partial<DriverCompliance>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const driver = (await myDriverRecord()) as
        | { id: string; vehicle_category: VehicleCategory; application_status: ApplicationStatus }
        | null;

      if (!driver) {
        setError('No driver record is linked to this account yet.');
        setLoading(false);
        return;
      }

      setDriverId(driver.id);
      setCategory(driver.vehicle_category);
      setAppStatus(driver.application_status);

      const [rows, c] = await Promise.all([
        documentStatus(driver.id),
        fetchCompliance(driver.id),
      ]);
      setDocs(rows);
      setComp(c ?? { driver_id: driver.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your application.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const required = useMemo(() => docs.filter((d) => d.is_required), [docs]);
  const done = useMemo(
    () => required.filter((d) => d.status === 'approved' || d.status === 'pending').length,
    [required],
  );
  const outstanding = useMemo(
    () => required.filter((d) => ['missing', 'rejected', 'expired'].includes(d.status)),
    [required],
  );

  const locked = appStatus === 'submitted' || appStatus === 'approved';

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      setError(null);
      await submitApplication();
      setNotice('Sent. We will review it and let you know.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-body-sm text-ink-muted">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        Loading your application
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Become a driver"
        description="We have to check a few things before you can take your first trip. Upload as you go — everything saves on its own."
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

      {notice && (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-tile border border-accent/30 bg-accent-soft px-4 py-3 text-body-sm text-accent-ink"
        >
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{notice}</span>
        </div>
      )}

      {/* Where the application stands */}
      <Card tone="flat" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-caption uppercase tracking-wide text-ink-subtle">Status</p>
            <p className="mt-1 text-h3 text-ink">{STATUS_LABEL[appStatus]}</p>
          </div>
          <div className="text-right">
            <p className="text-caption uppercase tracking-wide text-ink-subtle">Documents</p>
            <p className="mt-1 text-h3 tabular-nums text-ink">
              {done} <span className="text-ink-subtle">/ {required.length}</span>
            </p>
          </div>
        </div>

        <div
          className="mt-4 h-2 overflow-hidden rounded-pill bg-surface"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={required.length}
          aria-label="Documents provided"
        >
          <div
            className="h-full rounded-pill bg-brand transition-[width] duration-500"
            style={{ width: `${required.length ? (done / required.length) * 100 : 0}%` }}
          />
        </div>
      </Card>

      {/* Vehicle type */}
      <SectionHeader
        title="What will you drive?"
        description="This decides which documents we need from you."
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {(['car', 'motorbike', 'bicycle'] as const).map((c) => {
          const Icon = CATEGORY_ICON[c];
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              disabled={locked}
              onClick={async () => {
                if (locked || !driverId) return;
                setCategory(c);
                await supabaseSetCategory(driverId, c);
                await load();
              }}
              className={cn(
                'flex items-center gap-3 rounded-card border p-4 text-left transition',
                active
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-card text-ink hover:border-line-strong',
                locked && 'cursor-not-allowed opacity-60',
              )}
              aria-pressed={active}
            >
              <Icon size={22} aria-hidden />
              <span className="text-body font-semibold">{CATEGORY_LABEL[c]}</span>
              {active && <Check size={17} className="ml-auto" aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* Reference numbers */}
      <SectionHeader
        title="Your details"
        description="Numbers only here — the documents themselves go below."
      />
      <Card tone="flat" className="mb-8 grid gap-4 sm:grid-cols-2">
        <Field
          label="Date of birth"
          type="date"
          value={comp.date_of_birth ?? ''}
          disabled={locked}
          onSave={(v) => persist({ date_of_birth: v })}
        />
        <Field
          label="National Insurance number"
          placeholder="QQ 12 34 56 C"
          value={comp.national_insurance_no ?? ''}
          disabled={locked}
          onSave={(v) => persist({ national_insurance_no: v })}
        />

        {category !== 'bicycle' && (
          <>
            <Field
              label="Driving licence number"
              value={comp.dvla_licence_no ?? ''}
              disabled={locked}
              onSave={(v) => persist({ dvla_licence_no: v })}
            />
            <Field
              label="Driving licence expiry"
              type="date"
              value={comp.dvla_licence_expiry ?? ''}
              disabled={locked}
              onSave={(v) => persist({ dvla_licence_expiry: v })}
            />
            <Field
              label="Insurance provider"
              value={comp.insurance_provider ?? ''}
              disabled={locked}
              onSave={(v) => persist({ insurance_provider: v })}
            />
            <Field
              label="Insurance policy number"
              value={comp.insurance_policy_no ?? ''}
              disabled={locked}
              onSave={(v) => persist({ insurance_policy_no: v })}
            />
            <Field
              label="Insurance expiry"
              type="date"
              value={comp.insurance_expiry ?? ''}
              disabled={locked}
              onSave={(v) => persist({ insurance_expiry: v })}
            />
            <Field
              label="MOT expiry"
              type="date"
              value={comp.mot_expiry ?? ''}
              disabled={locked}
              onSave={(v) => persist({ mot_expiry: v })}
            />

            {/* This one is a question, not a field, because getting it wrong
                is the most expensive mistake in the industry. */}
            <label className="sm:col-span-2 flex items-start gap-3 rounded-tile border border-warning/30 bg-warning-soft p-4">
              <input
                type="checkbox"
                checked={comp.insurance_is_hire_and_reward ?? false}
                disabled={locked}
                onChange={(e) => persist({ insurance_is_hire_and_reward: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]"
              />
              <span className="text-body-sm text-warning-ink">
                <strong>My insurance covers hire and reward.</strong> Ordinary private
                insurance stops covering you the moment a passenger or a delivery pays.
                If you are not certain, ring your insurer before ticking this.
              </span>
            </label>
          </>
        )}

        {category === 'car' && (
          <>
            <Field
              label="TfL private hire driver licence number"
              value={comp.phv_driver_licence_no ?? ''}
              disabled={locked}
              onSave={(v) => persist({ phv_driver_licence_no: v })}
            />
            <Field
              label="Driver licence expiry"
              type="date"
              value={comp.phv_driver_licence_expiry ?? ''}
              disabled={locked}
              onSave={(v) => persist({ phv_driver_licence_expiry: v })}
            />
            <Field
              label="TfL private hire vehicle licence number"
              value={comp.phv_vehicle_licence_no ?? ''}
              disabled={locked}
              onSave={(v) => persist({ phv_vehicle_licence_no: v })}
            />
            <Field
              label="Vehicle licence expiry"
              type="date"
              value={comp.phv_vehicle_licence_expiry ?? ''}
              disabled={locked}
              onSave={(v) => persist({ phv_vehicle_licence_expiry: v })}
            />
          </>
        )}
      </Card>

      {/* Documents */}
      <SectionHeader
        title="Documents"
        description="Photograph them with your phone — we shrink them for you, so a slow connection is fine."
      />
      <div className="space-y-3">
        {docs.map((d) => (
          <DocumentRowCard
            key={d.doc_type}
            row={d}
            driverId={driverId}
            locked={locked}
            onUploaded={load}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 mt-8 -mx-5 border-t border-line bg-card/95 px-5 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        {outstanding.length > 0 ? (
          <p className="mb-3 text-body-sm text-ink-muted">
            <strong className="text-ink">{outstanding.length} still needed:</strong>{' '}
            {outstanding.map((d) => d.label).join(', ')}
          </p>
        ) : (
          <p className="mb-3 flex items-center gap-2 text-body-sm text-accent-ink">
            <ShieldCheck size={16} aria-hidden />
            Everything is here. You can send it for review.
          </p>
        )}

        <Button
          size="lg"
          disabled={outstanding.length > 0 || locked || submitting}
          loading={submitting}
          leadingIcon={<Send size={17} />}
          onClick={() => void onSubmit()}
          className="w-full sm:w-auto"
        >
          {appStatus === 'submitted'
            ? 'Sent — waiting for review'
            : appStatus === 'approved'
              ? 'Approved'
              : 'Send for review'}
        </Button>
      </div>
    </div>
  );

  async function persist(patch: Partial<DriverCompliance>) {
    if (!driverId) return;
    setComp((c) => ({ ...c, ...patch }));
    try {
      await saveCompliance(driverId, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }
}

/* -------------------------------------------------------------------------- */

async function supabaseSetCategory(driverId: string, category: VehicleCategory) {
  const { supabase } = await import('@shared/lib/supabase');
  await supabase.from('drivers').update({ vehicle_category: category }).eq('id', driverId);
}

/* -------------------------------------------------------------------------- */

function Field({
  label,
  value,
  onSave,
  type = 'text',
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <Input
      label={label}
      type={type}
      value={local}
      placeholder={placeholder ?? ''}
      disabled={disabled ?? false}
      onChange={(e) => setLocal(e.target.value)}
      /* Saved on blur rather than per keystroke: a write per character would
         be a request per character, and on a phone in a car that is both slow
         and expensive. */
      onBlur={() => local !== value && onSave(local)}
    />
  );
}

/* -------------------------------------------------------------------------- */

function DocumentRowCard({
  row,
  driverId,
  locked,
  onUploaded,
}: {
  row: DocumentRow;
  driverId: string | null;
  locked: boolean;
  onUploaded: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState(row.expires_on ?? '');
  const [err, setErr] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !driverId) return;
    setBusy(true);
    setErr(null);
    try {
      await uploadDocument(driverId, row.doc_type, file, row.has_expiry ? expiry : null);
      await onUploaded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card tone="flat" className={cn(busy && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-semibold text-ink">{row.label}</span>
            {!row.is_required && (
              <Badge tone="neutral" size="sm">
                Optional
              </Badge>
            )}
            <Badge tone={STATUS_TONE[row.status]} size="sm">
              {STATUS_TEXT[row.status]}
            </Badge>
          </div>

          {row.description && (
            <p className="mt-1.5 text-body-sm text-ink-muted">{row.description}</p>
          )}

          {row.status === 'rejected' && row.reject_reason && (
            <p className="mt-2 flex items-start gap-1.5 text-body-sm text-danger-ink">
              <X size={14} className="mt-0.5 shrink-0" aria-hidden />
              {row.reject_reason}
            </p>
          )}

          {row.status === 'expired' && (
            <p className="mt-2 flex items-start gap-1.5 text-body-sm text-danger-ink">
              <Clock size={14} className="mt-0.5 shrink-0" aria-hidden />
              This expired on {row.expires_on}. Upload the current one.
            </p>
          )}

          {err && <p className="mt-2 text-body-sm text-danger-ink">{err}</p>}

          {row.has_expiry && !locked && (
            <label className="mt-3 flex items-center gap-2 text-body-sm text-ink-muted">
              Expires
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="h-10 rounded-control border border-line bg-bg px-2.5 text-body text-ink"
              />
            </label>
          )}
        </div>

        <div className="shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button
            size="sm"
            variant={row.status === 'missing' ? 'primary' : 'outline'}
            disabled={locked || busy}
            loading={busy}
            leadingIcon={row.status === 'missing' ? <Upload size={15} /> : <FileUp size={15} />}
            onClick={() => inputRef.current?.click()}
          >
            {row.status === 'missing' ? 'Upload' : 'Replace'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
