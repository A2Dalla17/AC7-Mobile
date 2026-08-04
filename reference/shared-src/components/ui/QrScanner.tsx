import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, Loader2 } from 'lucide-react';

import { cn } from '@shared/lib/utils';

/**
 * QR scanning using the browser's own BarcodeDetector.
 *
 * ── Why no scanning library ────────────────────────────────────────────────
 * The usual choices (html5-qrcode, zxing-js) add 300–500 kB of gzipped
 * JavaScript to decode a format the platform already decodes natively and in
 * hardware. On the mid-range Android phones most drivers actually use, that is
 * several seconds of parse time before the camera even opens.
 *
 * ── The cost of that decision, stated plainly ──────────────────────────────
 * BarcodeDetector is available in Chrome and Android WebView, and is NOT
 * available in Safari — so on an iPhone this component cannot scan. That is
 * acceptable only because scanning is never the sole route to a driver:
 * `supported` is reported to the caller, which falls back to typing the code.
 * A five-character code is a perfectly good input method, and iOS users can
 * also point the built-in Camera app at the QR, which opens the deep link
 * directly. If iOS scanning inside the app becomes a requirement, that is the
 * moment to take the bundle hit — not before.
 */

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
}

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

export function isQrScanningSupported(): boolean {
  return getDetectorCtor() !== null && typeof navigator?.mediaDevices?.getUserMedia === 'function';
}

export interface QrScannerProps {
  onResult: (value: string) => void;
  onError?: (message: string) => void;
  className?: string;
  /** Stop the camera without unmounting — used when a result sheet covers the view. */
  paused?: boolean;
}

type State = 'starting' | 'scanning' | 'denied' | 'unsupported' | 'failed';

export function QrScanner({ onResult, onError, className, paused = false }: QrScannerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | null>(null);
  const settled = useRef(false);

  const [state, setState] = useState<State>('starting');

  const stop = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (paused) {
      stop();
      return;
    }

    const Detector = getDetectorCtor();
    if (!Detector || typeof navigator?.mediaDevices?.getUserMedia !== 'function') {
      setState('unsupported');
      return;
    }

    let cancelled = false;
    settled.current = false;
    const detector = new Detector({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    async function start() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          // The rear camera is the one pointed at the windscreen card.
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }

        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        setState('scanning');
        tick();
      } catch (error) {
        if (cancelled) return;
        const name = (error as DOMException)?.name;
        const denied = name === 'NotAllowedError' || name === 'SecurityError';
        setState(denied ? 'denied' : 'failed');
        onError?.(
          denied
            ? 'Camera access was blocked. Allow it in your browser settings, or type the code instead.'
            : 'Could not start the camera. Type the code instead.',
        );
      }
    }

    async function tick() {
      if (cancelled || settled.current) return;
      const el = video.current;

      if (el && ctx && el.readyState >= 2 && el.videoWidth > 0) {
        canvas.width = el.videoWidth;
        canvas.height = el.videoHeight;
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);

        try {
          const found = await detector.detect(canvas);
          const value = found[0]?.rawValue;
          if (value && !settled.current) {
            // Guard against firing twice: detection runs every frame and a code
            // stays in view for many frames after the first read.
            settled.current = true;
            stop();
            onResult(value);
            return;
          }
        } catch {
          // A single failed frame is normal — motion blur, bad focus. Keep going.
        }
      }

      frame.current = requestAnimationFrame(() => void tick());
    }

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [paused, onResult, onError, stop]);

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-card bg-ink',
        className,
      )}
    >
      <video
        ref={video}
        playsInline
        muted
        aria-label="Camera viewfinder"
        className="h-full w-full object-cover"
      />

      {/* Reticle. Purely a hint about where to aim; detection uses the whole frame. */}
      {state === 'scanning' && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-2/3 w-2/3">
            {(
              [
                'left-0 top-0 border-l-4 border-t-4 rounded-tl-lg',
                'right-0 top-0 border-r-4 border-t-4 rounded-tr-lg',
                'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-lg',
                'right-0 bottom-0 border-r-4 border-b-4 rounded-br-lg',
              ] as const
            ).map((corner) => (
              <span key={corner} className={cn('absolute h-8 w-8 border-white/90', corner)} />
            ))}
          </div>
        </div>
      )}

      {state !== 'scanning' && (
        <div className="absolute inset-0 grid place-items-center bg-ink/80 px-6 text-center">
          {state === 'starting' ? (
            <p className="flex items-center gap-2 text-body-sm text-white/90">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Starting the camera
            </p>
          ) : (
            <div className="space-y-2">
              <CameraOff size={26} className="mx-auto text-white/70" aria-hidden />
              <p className="text-body-sm font-medium text-white">
                {state === 'denied'
                  ? 'Camera access blocked'
                  : state === 'unsupported'
                    ? 'Scanning is not available on this browser'
                    : 'Camera unavailable'}
              </p>
              <p className="text-caption text-white/70">Type the driver&rsquo;s code instead.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
