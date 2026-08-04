/**
 * ACT — community advertising
 *
 * Everything the admin console needs to run advertising: create, edit, replace
 * the media, delete, switch on and off.
 *
 * ── Why uploads go through XMLHttpRequest rather than supabase.storage ─────
 * `supabase.storage.from(...).upload()` returns a plain promise. It resolves
 * when the whole file has landed and reports nothing before that. For a 200 kB
 * logo that is fine; for a 20 MB video on a phone it means thirty seconds of a
 * spinner that never moves, which is indistinguishable from a hang. People
 * cancel and retry, which makes it worse.
 *
 * XMLHttpRequest is the only browser API that exposes upload progress events —
 * `fetch()` still cannot stream a request body with progress in any shipping
 * browser. So the upload is posted directly to the Storage REST endpoint with
 * the session's access token, which is exactly what the JS client does
 * internally, plus the progress events it discards.
 */

import { supabase } from '@shared/lib/supabase';
import { KIND_LABEL, type BannerKind } from '@shared/api/banners';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Advert categories.
 *
 * Re-exported from api/banners rather than redeclared. They were declared
 * twice at first and immediately drifted: this file said 'restaurant' where
 * the database CHECK constraint says 'restaurant_promotion'. TypeScript could
 * not see the mismatch — both are just strings to it — so every save of a
 * restaurant advert would have failed at runtime with a constraint violation.
 * One declaration means that cannot happen again.
 */
export type AdvertKind = BannerKind;

export type Placement = 'landing_banner' | 'landing_hero' | 'taxi_home' | 'all';
export type MediaType = 'image' | 'video';

export interface Advert {
  id: string;
  kind: AdvertKind;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  media_type: MediaType;
  poster_url: string | null;
  placement: Placement;
  cta_label: string | null;
  cta_href: string | null;
  priority: number;
  sort_order: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdvertDraft {
  kind: AdvertKind;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  media_type: MediaType;
  poster_url: string | null;
  placement: Placement;
  cta_label: string | null;
  cta_href: string | null;
  priority: number;
  sort_order: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

/* Built from KIND_LABEL so the dropdown can never offer a value the database
   will reject, and a new category appears in both places at once. */
export const KIND_OPTIONS: Array<{ value: AdvertKind; label: string }> =
  (Object.keys(KIND_LABEL) as AdvertKind[]).map((value) => ({
    value,
    label: KIND_LABEL[value],
  }));

export const PLACEMENT_OPTIONS: Array<{ value: Placement; label: string }> = [
  { value: 'landing_banner', label: 'Landing page banner' },
  { value: 'landing_hero', label: 'Landing page hero' },
  { value: 'taxi_home', label: 'Taxi app home' },
  { value: 'all', label: 'Everywhere' },
];

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB

export const ACCEPT_ATTR = [...IMAGE_TYPES, ...VIDEO_TYPES].join(',');

export interface Rejection {
  reason: string;
}

/**
 * Decide whether a chosen file is usable, before a byte is uploaded.
 *
 * Checked on the extension as well as the MIME type because browsers disagree
 * about `.mov`: some report `video/quicktime`, some report an empty string.
 * Rejecting an otherwise valid file because the browser was vague would be a
 * bug the advertiser cannot work around.
 */
export function validateFile(file: File): { mediaType: MediaType } | Rejection {
  const name = file.name.toLowerCase();
  const byExtension = /\.(jpe?g|png|webp)$/.test(name)
    ? 'image'
    : /\.(mp4|webm|mov)$/.test(name)
      ? 'video'
      : null;

  const byMime = (IMAGE_TYPES as readonly string[]).includes(file.type)
    ? 'image'
    : (VIDEO_TYPES as readonly string[]).includes(file.type)
      ? 'video'
      : null;

  const mediaType = (byMime ?? byExtension) as MediaType | null;

  if (!mediaType) {
    return {
      reason:
        'That file type is not supported. Use a JPG, PNG or WebP image, or an MP4, WebM or MOV video.',
    };
  }

  const limit = mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const limitMb = limit / 1024 / 1024;
    return {
      reason:
        mediaType === 'video'
          ? `That video is ${mb} MB and the limit is ${limitMb} MB. Try a shorter clip, or export at 720p rather than 4K.`
          : `That image is ${mb} MB and the limit is ${limitMb} MB. Save it as a JPG at around 2000px wide.`,
    };
  }

  return { mediaType };
}

export function isRejection(v: { mediaType: MediaType } | Rejection): v is Rejection {
  return 'reason' in v;
}

/* -------------------------------------------------------------------------- */
/* Upload                                                                     */
/* -------------------------------------------------------------------------- */

const BUCKET = 'banners';

function storageUrl(path: string): string {
  const base = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined)?.replace(/\/+$/, '');
  return `${base}/storage/v1/object/${BUCKET}/${path}`;
}

export function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload one file, reporting progress from 0 to 1.
 *
 * Returns the storage path rather than a URL so the caller can decide between
 * a public URL and a signed one later without re-uploading.
 */
export function uploadWithProgress(
  file: Blob,
  path: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        reject(new Error('Your session has expired. Sign in again.'));
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', storageUrl(path), true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('x-upsert', 'true');
      /* One year. Every upload gets a fresh uuid filename, so a cached copy can
         never be stale — replacing media always produces a new URL. */
      xhr.setRequestHeader('cache-control', 'max-age=31536000');
      if (file.type) xhr.setRequestHeader('content-type', file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(1);
          resolve(path);
        } else {
          /* Storage returns JSON errors. The raw body is developer-facing, so
             translate the two an advertiser can actually cause. */
          let message = `Upload failed (${xhr.status}).`;
          try {
            const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
            const raw = body.message ?? body.error ?? '';
            if (/exceeded the maximum allowed size/i.test(raw)) {
              message = 'That file is larger than the bucket allows.';
            } else if (/mime type .* is not supported/i.test(raw)) {
              message = 'That file type is not allowed for adverts.';
            } else if (xhr.status === 403) {
              message = 'You do not have permission to upload advertisements.';
            } else if (raw) {
              message = raw;
            }
          } catch {
            /* Non-JSON body — keep the status message. */
          }
          reject(new Error(message));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading.'));
      xhr.onabort = () => reject(new Error('Upload cancelled.'));

      signal?.addEventListener('abort', () => xhr.abort(), { once: true });

      xhr.send(file);
    })();
  });
}

/**
 * Capture a still from a video for use as its poster.
 *
 * A <video> with no poster paints black until enough data arrives — on a
 * landing page that reads as broken. Seeks a little way in rather than to
 * frame zero, because the opening frame of a phone recording is usually black
 * or blurred while exposure settles.
 */
export function capturePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    const done = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      video.remove();
      resolve(blob);
    };

    /* If the browser cannot decode this container, none of the events below
       ever fire; without this the promise would hang and the save would appear
       frozen. */
    const timer = setTimeout(() => done(null), 8000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 4);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx || !canvas.width) return done(null);
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((b) => done(b), 'image/jpeg', 0.8);
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
  });
}

/** Shrink a large photo. Videos pass through — see the note in compliance.ts. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const MAX = 2400;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  return blob && blob.size < file.size ? blob : file;
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                       */
/* -------------------------------------------------------------------------- */

export const advertsApi = {
  /** Everything, live or not. Managers see drafts and expired campaigns too. */
  async list(): Promise<Advert[]> {
    const { data, error } = await supabase
      .from('featured_banners')
      .select('*')
      .order('is_active', { ascending: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(friendly(error.message));
    return (data ?? []) as Advert[];
  },

  async create(draft: AdvertDraft): Promise<Advert> {
    const { data, error } = await supabase
      .from('featured_banners')
      .insert(draft)
      .select()
      .single();
    if (error) throw new Error(friendly(error.message));
    return data as Advert;
  },

  async update(id: string, patch: Partial<AdvertDraft>): Promise<Advert> {
    const { data, error } = await supabase
      .from('featured_banners')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(friendly(error.message));
    return data as Advert;
  },

  async setActive(id: string, is_active: boolean): Promise<void> {
    const { error } = await supabase
      .from('featured_banners')
      .update({ is_active })
      .eq('id', id);
    if (error) throw new Error(friendly(error.message));
  },

  /**
   * Delete the advert, then its media.
   *
   * That order matters. If the row goes first and the file delete fails, the
   * result is an orphaned file — invisible, harmless, a few kilobytes. If the
   * file went first and the row delete failed, the advert would still be live
   * on the landing page pointing at a URL that 404s: a visible broken image
   * on the public site. Given one of the two has to fail first, it should be
   * the one nobody can see.
   */
  async remove(advert: Advert): Promise<void> {
    const { error } = await supabase.from('featured_banners').delete().eq('id', advert.id);
    if (error) throw new Error(friendly(error.message));

    const paths = [advert.image_url, advert.poster_url]
      .filter((u): u is string => Boolean(u))
      .map(pathFromPublicUrl)
      .filter((p): p is string => Boolean(p));

    if (paths.length) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  },
};

/** Recover the object path from a public URL so it can be deleted. */
function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

function friendly(message: string): string {
  if (/row-level security|violates row-level/i.test(message)) {
    return 'You do not have permission to manage advertisements.';
  }
  if (/duplicate key/i.test(message)) return 'That advert already exists.';
  return message;
}
