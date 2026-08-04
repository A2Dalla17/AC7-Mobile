import { supabase, friendlyError, isSupabaseConfigured } from '@shared/lib/supabase';

/**
 * Community advertising — the showcase carousel under the hero.
 *
 * ── One slot became several ────────────────────────────────────────────────
 * The homepage used to show a single banner. It now rotates through everything
 * live: featured businesses, restaurant and shop promotions, seasonal
 * campaigns, company announcements, and the Driver of the Quarter. `priority`
 * still decides who leads; `sort_order` decides reading order among equals.
 *
 * ── Why the spotlight window is derived, not scheduled ─────────────────────
 * For the first few days of each calendar quarter the Driver of the Quarter is
 * promoted to the front of the rotation. That window is computed from the date
 * on every page load rather than flipped by a scheduled job, because a cron
 * that fails silently leaves last quarter's winner leading the homepage for
 * three months and nobody notices until a customer mentions it.
 */

export type BannerKind =
  | 'advert'
  | 'promotion'
  | 'featured_business'
  | 'restaurant_promotion'
  | 'shop_promotion'
  | 'driver_of_quarter'
  | 'seasonal_campaign'
  | 'announcement';

export interface FeaturedBanner {
  id: string;
  kind: BannerKind;
  title: string;
  subtitle: string | null;
  body: string | null;
  /** The media URL — a photo or a video, depending on media_type. */
  image_url: string | null;
  /** Decides <img> vs <video>. Stored, never inferred from the file extension. */
  media_type: 'image' | 'video';
  /** Still frame shown while a video loads. Null for photos. */
  poster_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  priority: number;
  sort_order: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

/** The eyebrow shown above each slide's title. */
export const KIND_LABEL: Record<BannerKind, string> = {
  advert: 'Featured',
  promotion: 'Promotion',
  featured_business: 'Featured business',
  restaurant_promotion: 'Restaurant promotion',
  shop_promotion: 'Shop promotion',
  driver_of_quarter: 'Driver of the Quarter',
  seasonal_campaign: 'Seasonal campaign',
  announcement: 'Announcement',
};

/** How many slides the carousel will show at most. */
const MAX_SLIDES = 6;

/** How long the new quarter's spotlight leads the rotation. */
export const SPOTLIGHT_DAYS = 3;

export interface Quarter {
  index: number;
  label: string;
  start: Date;
  /** Exclusive — the instant the next quarter begins. */
  end: Date;
}

export function quarterFor(now: Date = new Date()): Quarter {
  const index = Math.floor(now.getMonth() / 3);
  return {
    index: index + 1,
    label: `Q${index + 1} ${now.getFullYear()}`,
    start: new Date(now.getFullYear(), index * 3, 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), index * 3 + 3, 1, 0, 0, 0, 0),
  };
}

/** True during the opening days of a quarter, when the spotlight leads. */
export function isSpotlightWindow(now: Date = new Date()): boolean {
  const elapsedDays = (now.getTime() - quarterFor(now).start.getTime()) / 86_400_000;
  return elapsedDays >= 0 && elapsedDays < SPOTLIGHT_DAYS;
}

/* -------------------------------------------------------------------------- */

export const bannersApi = {
  /**
   * Everything currently live, ordered for the carousel.
   *
   * The RLS policy already filters to rows that are active and inside their
   * date range, so this does not repeat those conditions — duplicating them
   * would mean two places to change when the rule changes.
   *
   * An empty list is an ordinary outcome, not an error: a new site has no
   * advertisers yet. The component handles that by showing the invitation to
   * advertise rather than a gap.
   */
  async showcase(now: Date = new Date()): Promise<FeaturedBanner[]> {
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase
      .from('featured_banners')
      .select('*')
      /* Only what is aimed at this surface. RLS already hides inactive and
         out-of-window rows, so placement is the one filter left. */
      .in('placement', ['landing_banner', 'all'])
      .order('priority', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('starts_at', { ascending: false })
      .limit(MAX_SLIDES);

    if (error) throw new Error(friendlyError(error));

    const live = (data ?? []) as FeaturedBanner[];
    if (live.length === 0) return [];

    /* Outside its window the quarterly driver stays in the rotation but does
       not lead it, so a paid campaign is not buried behind a spotlight that
       ran three months ago. */
    if (isSpotlightWindow(now)) return live;

    const spotlight = live.filter((b) => b.kind === 'driver_of_quarter');
    const rest = live.filter((b) => b.kind !== 'driver_of_quarter');
    return [...rest, ...spotlight];
  },
};

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Everything below is admin-only, and that is enforced by row level security
 * on the server — not by hiding the screen. A non-admin calling these gets
 * zero rows or a permission error from Postgres, which is the correct place
 * for the check to live.
 */

/**
 * Grab a still from a video file, in the browser, for use as its poster.
 *
 * Seeks a little way in rather than to zero: the first frame of a phone
 * recording is very often black or a blur while exposure settles, and a black
 * poster is worse than none because it looks like a broken embed.
 *
 * Everything here is best-effort — a codec the browser cannot decode simply
 * yields null and the advert plays without a poster.
 */
async function capturePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    const done = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      video.remove();
      resolve(blob);
    };

    /* If the browser cannot decode this file, nothing below ever fires.
       Without a timeout the promise would hang and the upload would appear
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

export type MediaType = 'image' | 'video';

export interface BannerInput {
  kind: BannerKind;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  media_type: MediaType;
  poster_url: string | null;
  is_active: boolean;
  priority: number;
  sort_order: number;
  ends_at: string | null;
}

const BUCKET = 'banners';

/**
 * Ceiling for an advert video.
 *
 * This bucket is public and the landing page is the first thing a visitor
 * loads, so the file size is multiplied by the audience: it is a bandwidth
 * bill for AC7 and a data allowance for whoever is standing at a bus stop.
 * Twenty megabytes comfortably holds the ten to twenty seconds an advert
 * should be, and the limit is enforced by the bucket as well as here — this
 * check exists to give a useful message rather than a raw storage error.
 */
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

export const bannersAdminApi = {
  /** Every banner, live or not, newest first. */
  async list(): Promise<FeaturedBanner[]> {
    const { data, error } = await supabase
      .from('featured_banners')
      .select('*')
      .order('priority', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(friendlyError(error));
    return (data ?? []) as FeaturedBanner[];
  },

  /**
   * Upload artwork and return its public URL.
   *
   * The filename is randomised rather than taken from the upload. Two shops
   * both sending "logo.jpg" would otherwise collide, and a filename chosen by
   * an uploader is a small attack surface for path tricks.
   */
  async uploadImage(blob: Blob, extension: string): Promise<string> {
    const name = `${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(name, blob, {
      contentType: blob.type,
      /* One year: the filename is unique per upload, so a cached copy can
         never be stale — replacing an image always produces a new URL. */
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) throw new Error(friendlyError(error));

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl;
  },

  /**
   * Upload an advert video, and a still frame to show while it loads.
   *
   * Returns both URLs. The poster is captured in the browser from the video
   * the advertiser just chose, so it costs them nothing and always matches
   * the clip — a hand-picked poster drifts out of sync the moment the video
   * is replaced.
   */
  async uploadVideo(file: File): Promise<{ url: string; posterUrl: string | null }> {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error(
        `That video is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is 20 MB — ` +
          'try a shorter clip, or export it at 720p rather than 4K.',
      );
    }

    const ext = file.type === 'video/webm' ? 'webm' : 'mp4';
    const name = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(name, file, {
      contentType: file.type || 'video/mp4',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error(friendlyError(error));

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);

    let posterUrl: string | null = null;
    try {
      const poster = await capturePoster(file);
      if (poster) posterUrl = await this.uploadImage(poster, 'jpg');
    } catch {
      /* A missing poster is cosmetic — the advert still plays. Never fail the
         upload over it. */
    }

    return { url: data.publicUrl, posterUrl };
  },

  async create(input: BannerInput): Promise<FeaturedBanner> {
    const { data, error } = await supabase
      .from('featured_banners')
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(friendlyError(error));
    return data as FeaturedBanner;
  },

  async update(id: string, patch: Partial<BannerInput>): Promise<FeaturedBanner> {
    const { data, error } = await supabase
      .from('featured_banners')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(friendlyError(error));
    return data as FeaturedBanner;
  },

  async setActive(id: string, is_active: boolean) {
    return this.update(id, { is_active });
  },

  /**
   * Remove a banner and its artwork.
   *
   * The row goes first. If the image delete fails afterwards the advert has
   * still disappeared from the site, which is what the admin asked for — an
   * orphaned file in storage is tidy-up, not a failure worth reporting.
   */
  async remove(banner: FeaturedBanner): Promise<void> {
    const { error } = await supabase.from('featured_banners').delete().eq('id', banner.id);
    if (error) throw new Error(friendlyError(error));

    const path = banner.image_url?.split(`/${BUCKET}/`)[1];
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
  },
};
