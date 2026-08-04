import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { cn } from '@shared/lib/utils';

/**
 * QR rendering.
 *
 * ── Why the error-correction level is set to H ─────────────────────────────
 * A driver's QR is printed on a card that lives on a windscreen: it gets sun
 * bleached, rained on, and scanned at an angle through glass at night. Level H
 * carries enough redundancy to survive roughly 30% of the symbol being
 * unreadable, at the cost of a denser pattern. For a code that is scanned once
 * and thrown away, M would be right; for one that has to keep working for a
 * year on a dashboard, H is the only sensible choice.
 *
 * ── Why it draws to a canvas and not an <img> ──────────────────────────────
 * Canvas lets the driver download the code as a PNG to send to a printer,
 * which is what actually happens the first day someone joins.
 */

export interface QrCodeProps {
  /** The payload. For AC7 this is a deep link, so a generic scanner opens the app. */
  value: string;
  /** Rendered size in CSS pixels. Drawn at 2× for retina, then scaled down. */
  size?: number;
  className?: string;
  /** Accessible description; the canvas itself carries no text. */
  label?: string;
}

export function QrCode({ value, size = 200, className, label }: QrCodeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvas.current || !value) return;
    let cancelled = false;

    QRCode.toCanvas(canvas.current, value, {
      errorCorrectionLevel: 'H',
      margin: 2,
      // Physical pixels, so the code stays sharp when printed.
      width: size * 2,
      color: {
        // Pure black on pure white. Brand colours look better and scan worse:
        // most readers threshold on luminance and a mid-tone red narrows the
        // margin the decoder has to work with, especially in poor light.
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then(() => {
        if (!cancelled) setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-tile border border-line bg-surface p-4 text-center',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <p className="text-caption text-ink-muted">Could not draw the code</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      className={cn('rounded-tile bg-white', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Download the rendered QR as a PNG, so a driver can print it. */
export function downloadQr(canvasEl: HTMLCanvasElement | null, filename: string) {
  if (!canvasEl) return;
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = canvasEl.toDataURL('image/png');
  link.click();
}
