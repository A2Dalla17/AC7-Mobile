/**
 * Prepare a photo for upload.
 *
 * ── Why the browser resizes before uploading ───────────────────────────────
 * A phone camera produces 4–12 MB images. Uploading one over a shop's wifi
 * takes long enough that people assume the app has frozen and tap again, and
 * every visitor to the homepage then downloads that same file. The billboard
 * is at most 1600 CSS pixels wide, so anything beyond that is bytes nobody can
 * see. Resizing here turns a 9 MB upload into roughly 200 KB.
 *
 * ── Why the aspect ratio is not forced ─────────────────────────────────────
 * The frame is 21:9 on desktop and 4:3 on mobile, so there is no single
 * correct crop. The image is scaled to fit inside a bounding box and the CSS
 * covers the frame; cropping to one ratio here would guarantee the other
 * breakpoint cuts somebody's face in half.
 */

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1200;
const QUALITY = 0.85;

export interface PreparedImage {
  blob: Blob;
  /** Object URL for previewing. The caller must revoke it. */
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
  extension: 'jpg' | 'png';
}

export class ImageError extends Error {}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) {
    throw new ImageError('Use a JPG, PNG, WebP or AVIF image.');
  }
  /* Checked before decoding: a 200 MB file would otherwise be read into memory
     first and could crash the tab before we ever reject it. */
  if (file.size > 25 * 1024 * 1024) {
    throw new ImageError('That image is very large. Use one under 25 MB.');
  }

  const bitmap = await loadBitmap(file);

  const scale = Math.min(MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height, 1);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Could not process that image.');

  /* Without this, downscaling by more than about half produces visible
     aliasing on straight edges — shop signage and logos look ragged. */
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  /* Only an ImageBitmap holds decoded pixels that must be released by hand;
     an HTMLImageElement is collected normally and has no close(). */
  if ('close' in bitmap) bitmap.close();

  /* PNG keeps transparency, which logos need. Everything else becomes JPEG,
     which is far smaller for photographs. */
  const keepPng = file.type === 'image/png';
  const type = keepPng ? 'image/png' : 'image/jpeg';

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, keepPng ? undefined : QUALITY),
  );
  if (!blob) throw new ImageError('Could not process that image.');

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    bytes: blob.size,
    extension: keepPng ? 'png' : 'jpg',
  };
}

/**
 * createImageBitmap is faster and does not touch the DOM, but Safari only
 * gained it recently — the <img> path is the fallback, not the default.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Corrupt or unsupported encoding — fall through and let <img> try. */
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/** Human-readable file size for the upload preview. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
