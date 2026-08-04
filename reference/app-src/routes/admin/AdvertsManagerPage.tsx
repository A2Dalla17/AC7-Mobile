/**
 * ACT — Community Advertising (admin)
 *
 * Create, edit, replace media, switch on and off, delete.
 *
 * ── Why the editor is a panel and not a modal ──────────────────────────────
 * Uploading a 20 MB video takes tens of seconds. A modal invites the operator
 * to dismiss it — by pressing Escape, or clicking the backdrop — halfway
 * through, which cancels an upload they cannot see the state of. A panel
 * beside the list stays put, and the list stays readable while it works.
 *
 * ── Why deleting asks twice ────────────────────────────────────────────────
 * Deleting is the only action here that cannot be undone. Switching an advert
 * off achieves nearly everything deleting does and is reversible, so the
 * inactive toggle is the prominent control and delete is deliberately duller
 * and slower to reach.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video as VideoIcon,
  X,
} from 'lucide-react';

import {
  ACCEPT_ATTR,
  advertsApi,
  capturePoster,
  compressImage,
  isRejection,
  KIND_OPTIONS,
  MAX_VIDEO_BYTES,
  PLACEMENT_OPTIONS,
  publicUrl,
  uploadWithProgress,
  validateFile,
  type Advert,
  type AdvertDraft,
  type AdvertKind,
  type MediaType,
  type Placement,
} from '@shared/api/adverts';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { useAuth } from '@shared/providers/AuthProvider';
import { cn } from '@shared/lib/utils';

/* -------------------------------------------------------------------------- */

function emptyDraft(): AdvertDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    kind: 'advert',
    title: '',
    subtitle: null,
    body: null,
    image_url: null,
    media_type: 'image',
    poster_url: null,
    placement: 'landing_banner',
    cta_label: null,
    cta_href: null,
    priority: 10,
    sort_order: 0,
    starts_at: `${today}T00:00`,
    ends_at: null,
    is_active: true,
  };
}

function isLive(a: Advert): boolean {
  const now = Date.now();
  const started = new Date(a.starts_at).getTime() <= now;
  const ended = a.ends_at ? new Date(a.ends_at).getTime() <= now : false;
  return a.is_active && started && !ended;
}

/* -------------------------------------------------------------------------- */

export function AdvertsManagerPage() {
  const { role } = useAuth();
  const canManage = role === 'admin' || (role as string) === 'ad_manager';

  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [editing, setEditing] = useState<Advert | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setAdverts(await advertsApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load advertisements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const say = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  };

  const toggle = async (a: Advert) => {
    try {
      await advertsApi.setActive(a.id, !a.is_active);
      say(a.is_active ? 'Switched off.' : 'Switched on.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change that.');
    }
  };

  const destroy = async (a: Advert) => {
    try {
      await advertsApi.remove(a);
      say('Deleted.');
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that.');
    }
  };

  const liveCount = useMemo(() => adverts.filter(isLive).length, [adverts]);

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Community Advertising" />
        <Card tone="flat">
          <p className="text-body-sm text-ink-muted">
            Your account cannot manage advertisements. Ask an administrator for the
            Advertisement Manager role.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Community Advertising"
        description={`${liveCount} advert${liveCount === 1 ? '' : 's'} showing on the site right now.`}
        actions={
          <Button
            leadingIcon={<Plus size={16} />}
            onClick={() => setEditing('new')}
            disabled={editing === 'new'}
          >
            Upload advertisement
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-tile border border-danger/30 bg-danger-soft px-4 py-3 text-body-sm text-danger-ink"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-5 flex items-center gap-2.5 rounded-tile border border-accent/30 bg-accent-soft px-4 py-3 text-body-sm text-accent-ink"
        >
          <CheckCircle2 size={17} aria-hidden />
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-body-sm text-ink-muted">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Loading advertisements
            </div>
          ) : adverts.length === 0 ? (
            <Card tone="flat">
              <p className="text-body-sm text-ink-muted">
                Nothing yet. Press <strong className="text-ink">Upload advertisement</strong> to
                add the first one.
              </p>
            </Card>
          ) : (
            adverts.map((a) => (
              <Card key={a.id} tone="flat" className="overflow-hidden p-0">
                <div className="flex flex-col sm:flex-row">
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/9] w-full shrink-0 bg-surface sm:aspect-auto sm:h-auto sm:w-48">
                    {a.image_url ? (
                      a.media_type === 'video' ? (
                        <>
                          <img
                            src={a.poster_url ?? undefined}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-pill bg-black/60 px-2 py-0.5 text-micro text-white backdrop-blur-sm">
                            <VideoIcon size={11} aria-hidden />
                            Video
                          </span>
                        </>
                      ) : (
                        <img
                          src={a.image_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="grid h-full w-full place-items-center text-ink-subtle">
                        <ImageIcon size={22} aria-hidden />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body font-semibold text-ink">{a.title}</span>
                        <Badge tone={isLive(a) ? 'success' : 'muted'} size="sm">
                          {isLive(a) ? 'Showing now' : a.is_active ? 'Scheduled / ended' : 'Off'}
                        </Badge>
                        <Badge tone="neutral" size="sm">
                          {PLACEMENT_OPTIONS.find((p) => p.value === a.placement)?.label ??
                            a.placement}
                        </Badge>
                      </div>
                      {a.subtitle && (
                        <p className="mt-1 text-body-sm text-ink-muted">{a.subtitle}</p>
                      )}
                      <p className="mt-1.5 text-caption tabular-nums text-ink-subtle">
                        {a.starts_at.slice(0, 10)} → {a.ends_at ? a.ends_at.slice(0, 10) : 'no end date'}
                        {' · priority '}
                        {a.priority}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        leadingIcon={<Pencil size={14} />}
                        onClick={() => setEditing(a)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        leadingIcon={a.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        onClick={() => void toggle(a)}
                      >
                        {a.is_active ? 'Switch off' : 'Switch on'}
                      </Button>

                      {confirmDelete === a.id ? (
                        <>
                          <Button size="sm" variant="danger" onClick={() => void destroy(a)}>
                            Delete for good
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          leadingIcon={<Trash2 size={14} />}
                          onClick={() => setConfirmDelete(a.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Editor */}
        {editing && (
          <AdvertEditor
            key={editing === 'new' ? 'new' : editing.id}
            advert={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={async (message) => {
              setEditing(null);
              say(message);
              await load();
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AdvertEditor({
  advert,
  onCancel,
  onSaved,
  onError,
}: {
  advert: Advert | null;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<AdvertDraft>(() =>
    advert
      ? {
          kind: advert.kind,
          title: advert.title,
          subtitle: advert.subtitle,
          body: advert.body,
          image_url: advert.image_url,
          media_type: advert.media_type,
          poster_url: advert.poster_url,
          placement: advert.placement,
          cta_label: advert.cta_label,
          cta_href: advert.cta_href,
          priority: advert.priority,
          sort_order: advert.sort_order,
          starts_at: advert.starts_at.slice(0, 16),
          ends_at: advert.ends_at ? advert.ends_at.slice(0, 16) : null,
          is_active: advert.is_active,
        }
      : emptyDraft(),
  );

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<MediaType>('image');
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Object URLs are not garbage collected. Without this, choosing six files in
     one session leaks six decoded videos. */
  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = (chosen: File | undefined) => {
    if (!chosen) return;
    setFileError(null);

    const verdict = validateFile(chosen);
    if (isRejection(verdict)) {
      setFileError(verdict.reason);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreviewType(verdict.mediaType);
    setPreview(URL.createObjectURL(chosen));
  };

  const save = async () => {
    if (!draft.title.trim()) {
      onError('Give the advertisement a title.');
      return;
    }
    if (!advert && !file) {
      onError('Choose an image or a video.');
      return;
    }
    if (draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) {
      onError('The end date has to be after the start date.');
      return;
    }

    setSaving(true);
    abortRef.current = new AbortController();

    try {
      const next: AdvertDraft = { ...draft };

      if (file) {
        const verdict = validateFile(file);
        if (isRejection(verdict)) throw new Error(verdict.reason);

        setProgress(0);
        const id = crypto.randomUUID();

        if (verdict.mediaType === 'video') {
          const ext = file.name.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
          const path = await uploadWithProgress(
            file,
            `${id}.${ext}`,
            setProgress,
            abortRef.current.signal,
          );
          next.image_url = publicUrl(path);
          next.media_type = 'video';

          const poster = await capturePoster(file);
          if (poster) {
            const posterPath = await uploadWithProgress(poster, `${id}-poster.jpg`, () => undefined);
            next.poster_url = publicUrl(posterPath);
          }
        } else {
          const blob = await compressImage(file);
          const path = await uploadWithProgress(
            blob,
            `${id}.jpg`,
            setProgress,
            abortRef.current.signal,
          );
          next.image_url = publicUrl(path);
          next.media_type = 'image';
          next.poster_url = null;
        }
      }

      /* Datetime-local gives "2026-08-02T09:00" with no zone. Postgres would
         read that as UTC; the operator meant London. Converting through Date
         attaches the browser's zone, which is the one they are looking at. */
      const payload: AdvertDraft = {
        ...next,
        starts_at: new Date(next.starts_at).toISOString(),
        ends_at: next.ends_at ? new Date(next.ends_at).toISOString() : null,
        subtitle: next.subtitle?.trim() || null,
        body: next.body?.trim() || null,
        cta_label: next.cta_label?.trim() || null,
        cta_href: next.cta_href?.trim() || null,
      };

      if (advert) {
        await advertsApi.update(advert.id, payload);
        await onSaved('Advertisement updated.');
      } else {
        await advertsApi.create(payload);
        await onSaved('Advertisement published.');
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save that.');
    } finally {
      setSaving(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const set = <K extends keyof AdvertDraft>(key: K, value: AdvertDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const shownMedia = preview ?? draft.image_url;
  const shownType = preview ? previewType : draft.media_type;

  return (
    <Card className="h-fit lg:sticky lg:top-8">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-h3 text-ink">
          {advert ? 'Edit advertisement' : 'New advertisement'}
        </h2>
        <button type="button" onClick={onCancel} aria-label="Close" className="text-ink-subtle hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {/* Media */}
        <div>
          <span className="mb-1.5 block text-body-sm font-medium text-ink">
            Image or video
          </span>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            id="advert-media"
            onChange={(e) => pick(e.target.files?.[0])}
          />

          {shownMedia ? (
            <div className="relative overflow-hidden rounded-tile border border-line">
              {shownType === 'video' ? (
                <video
                  src={shownMedia}
                  className="aspect-[16/9] w-full bg-black object-cover"
                  muted
                  loop
                  playsInline
                  autoPlay
                  controls
                />
              ) : (
                <img
                  src={shownMedia}
                  alt="Preview of this advertisement"
                  className="aspect-[16/9] w-full object-cover"
                />
              )}
              <label
                htmlFor="advert-media"
                className="absolute right-2 top-2 cursor-pointer rounded-pill bg-black/60 px-3 py-1.5 text-micro font-medium text-white backdrop-blur-sm hover:bg-black/75"
              >
                Replace
              </label>
            </div>
          ) : (
            <label
              htmlFor="advert-media"
              className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 rounded-tile border-2 border-dashed border-line-strong bg-surface text-ink-muted transition-colors hover:border-brand hover:text-brand-ink"
            >
              <Upload size={24} aria-hidden />
              <span className="text-body-sm font-medium">Choose a file</span>
              <span className="text-micro text-ink-subtle">
                JPG, PNG, WebP · MP4, WebM, MOV up to {MAX_VIDEO_BYTES / 1024 / 1024} MB
              </span>
            </label>
          )}

          {fileError && (
            <p role="alert" className="mt-2 text-body-sm text-danger-ink">
              {fileError}
            </p>
          )}

          {progress !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-caption text-ink-muted">
                <span>Uploading</span>
                <span className="tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <div
                className="mt-1 h-2 overflow-hidden rounded-pill bg-surface"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              >
                <div
                  className="h-full rounded-pill bg-brand transition-[width] duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <Input
          label="Title"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Mama's Kitchen — 20% off"
        />

        <Input
          label="Short line (optional)"
          value={draft.subtitle ?? ''}
          onChange={(e) => set('subtitle', e.target.value)}
          placeholder="Halal Somali food on Uxbridge Road"
        />

        <div>
          <label htmlFor="advert-body" className="mb-1.5 block text-body-sm font-medium text-ink">
            Description (optional)
          </label>
          <textarea
            id="advert-body"
            rows={3}
            value={draft.body ?? ''}
            onChange={(e) => set('body', e.target.value)}
            className="w-full rounded-control border border-line bg-bg px-3 py-2 text-body text-ink"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Type"
            value={draft.kind}
            onChange={(v) => set('kind', v as AdvertKind)}
            options={KIND_OPTIONS}
          />
          <Select
            label="Where it shows"
            value={draft.placement}
            onChange={(v) => set('placement', v as Placement)}
            options={PLACEMENT_OPTIONS}
          />
          <Input
            label="Starts"
            type="datetime-local"
            value={draft.starts_at}
            onChange={(e) => set('starts_at', e.target.value)}
          />
          <Input
            label="Ends (optional)"
            type="datetime-local"
            value={draft.ends_at ?? ''}
            onChange={(e) => set('ends_at', e.target.value || null)}
          />
          <Input
            label="Priority"
            type="number"
            value={String(draft.priority)}
            onChange={(e) => set('priority', Number(e.target.value) || 0)}
            hint="Higher shows first"
          />
          <Input
            label="Link (optional)"
            value={draft.cta_href ?? ''}
            onChange={(e) => set('cta_href', e.target.value)}
            placeholder="https://"
          />
        </div>

        <label className="flex items-center gap-3 rounded-tile border border-line bg-surface p-3">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--brand))]"
          />
          <span className="text-body-sm text-ink">
            Active
            <span className="block text-caption text-ink-subtle">
              Switching this off hides it without deleting it.
            </span>
          </span>
        </label>

        <div className="flex gap-2 pt-1">
          <Button onClick={() => void save()} loading={saving} disabled={saving} className="flex-1">
            {advert ? 'Save changes' : 'Publish'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  const id = `sel-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-body-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-11 w-full rounded-control border border-line bg-bg px-3 text-body text-ink',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
