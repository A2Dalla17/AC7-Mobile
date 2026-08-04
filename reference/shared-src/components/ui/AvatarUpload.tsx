import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';

import { cn } from '@shared/lib/utils';
import { Avatar } from './Avatar';

/**
 * Centred profile photo with an upload affordance.
 *
 * ── How the image reaches the backend ──────────────────────────────────────
 * `users.profile_image` is a plain `*string` column and the auth service has
 * no multipart endpoint, so the image is downscaled here and sent as a data
 * URL through the existing `PUT /auth/profile`. That keeps the Go backend
 * untouched, which is the constraint.
 *
 * It is not what you would ship at scale: a data URL lives in the users row
 * and is re-sent on every profile read. The mitigation is aggressive — the
 * image is cropped square and resized to 512px at JPEG q0.82, which lands
 * around 40–60 kB regardless of what the camera produced. A 4 MB photo from a
 * modern phone would otherwise be ~5.5 MB once base64-encoded.
 *
 * The real fix is a presigned upload. `pkg/storage` already exists and is
 * S3-compatible — it is wired to `internal/documents` for driver licences.
 * An `/auth/profile/avatar` endpoint reusing it would let this component POST
 * the blob and store only a URL. Worth doing before launch.
 */

const MAX_INPUT_BYTES = 8 * 1024 * 1024; // reject before decoding
const OUTPUT_SIZE = 512;
const OUTPUT_QUALITY = 0.82;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function AvatarUpload({
  src,
  initials,
  name,
  onChange,
  onRemove,
  disabled = false,
  caption,
  className,
}: {
  src?: string | null;
  initials: string;
  /** Used for the accessible label — "Change Amina's photo". */
  name?: string;
  onChange: (dataUrl: string) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
  disabled?: boolean;
  caption?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.includes(file.type) && !file.type.startsWith('image/')) {
      setError('Choose a JPG, PNG or WebP image.');
      return;
    }

    if (file.size > MAX_INPUT_BYTES) {
      setError('That image is over 8 MB. Try a smaller one.');
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await squareDownscale(file);
      setPreview(dataUrl);
      await onChange(dataUrl);
    } catch {
      setError("That image couldn't be read. Try another.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? src;

  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="relative">
        <Avatar
          src={shown}
          initials={initials}
          size="2xl"
          className="ring-4 ring-bg shadow-lifted"
        />

        {/* Dim + spinner while the resize and request are in flight */}
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45">
            <Loader2 size={22} className="animate-spin text-white" aria-hidden />
          </span>
        )}

        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
          aria-label={name ? `Change ${name}'s photo` : 'Change profile photo'}
          className={cn(
            'pressable absolute bottom-0 right-0 grid h-10 w-10 place-items-center rounded-full',
            'brand-gradient text-white shadow-brand ring-4 ring-bg',
            'transition-transform duration-quick ease-spring hover:scale-105',
            'disabled:opacity-50 disabled:hover:scale-100',
          )}
        >
          <Camera size={17} aria-hidden />
        </button>

        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            /* Reset so re-picking the same file still fires a change event. */
            e.target.value = '';
          }}
        />
      </div>

      {caption && !error && (
        <p className="mt-3 max-w-[16rem] text-micro leading-relaxed text-ink-subtle">{caption}</p>
      )}

      {error && (
        <p role="alert" className="mt-3 max-w-[16rem] text-micro text-danger-ink">
          {error}
        </p>
      )}

      {shown && onRemove && !busy && (
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            void onRemove();
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-micro font-semibold text-ink-muted transition-colors hover:text-danger-ink"
        >
          <Trash2 size={12} aria-hidden />
          Remove photo
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Centre-crop to a square, resize to OUTPUT_SIZE, re-encode as JPEG.
 *
 * Centre-crop rather than letterbox because a circular avatar mask would put
 * the letterbox bars inside the circle. Cropping from the centre keeps the
 * subject of a portrait photo, which is where people put their face.
 */
async function squareDownscale(file: File): Promise<string> {
  const bitmap = await loadBitmap(file);

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  ctx.imageSmoothingQuality = 'high';
  /* JPEG has no alpha; without this, transparent PNGs come out black. */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  if ('close' in bitmap) (bitmap as ImageBitmap).close();

  return canvas.toDataURL('image/jpeg', OUTPUT_QUALITY);
}

/**
 * createImageBitmap handles EXIF orientation and is far faster, but Safari
 * only gained it recently — so fall back to an <img> decode.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    /* Revoking after decode() is safe — the bitmap is already in memory. */
    URL.revokeObjectURL(url);
  }
}
