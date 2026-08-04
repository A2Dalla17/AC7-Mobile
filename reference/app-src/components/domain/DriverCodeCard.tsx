import { useRef, useState } from 'react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';

import { driverCodeUrl } from '@shared/api/drivers';
import { Button } from '@shared/components/ui/Button';
import { QrCode } from '@shared/components/ui/QrCode';
import { cn } from '@shared/lib/utils';

/**
 * A driver's own code and QR, shown on their profile.
 *
 * ── What the QR actually contains ──────────────────────────────────────────
 * A URL (https://…/d/AC700042), not the bare code. That distinction is the
 * whole feature: a passenger's built-in camera app recognises a URL and offers
 * to open it, so they land on the verification page with no app installed and
 * nothing typed. A QR containing "AC700042" would show them a meaningless
 * string and a shrug.
 *
 * The code below the QR is not decoration either — it is the fallback for a
 * cracked screen, a dirty card, or an iPhone in a browser that cannot scan.
 * Both routes lead to the same page.
 */
export function DriverCodeCard({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const url = driverCodeUrl(code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard is blocked in some embedded browsers. The code is on screen
         either way, so this is not worth an error message. */
    }
  };

  const download = () => {
    const canvas = holder.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `AC7-${code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <section
      className={cn('rounded-card border border-line bg-card p-5 shadow-card', className)}
      aria-labelledby="driver-code-heading"
    >
      <div className="flex flex-col items-center text-center">
        <h2 id="driver-code-heading" className="text-h5 text-ink">
          Your driver code
        </h2>
        <p className="mt-1 max-w-xs text-body-sm leading-relaxed text-ink-muted">
          Passengers scan this to confirm it is really you before they get in.
        </p>

        <div ref={holder} className="mt-4 rounded-card border border-line bg-white p-3">
          <QrCode value={url} size={168} label={`QR code for driver ${code}`} />
        </div>

        <p className="tabular mt-4 text-h3 tracking-[0.12em] text-ink">{code}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-caption text-ink-subtle">
          <ShieldCheck size={12} aria-hidden />
          Permanent — this never changes
        </p>

        <div className="mt-4 flex w-full gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={copy}
            leadingIcon={copied ? <Check size={16} /> : <Copy size={16} />}
          >
            {copied ? 'Copied' : 'Copy code'}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={download}
            leadingIcon={<Download size={16} />}
          >
            Save QR
          </Button>
        </div>

        <p className="mt-3 text-caption leading-relaxed text-ink-subtle">
          Save the QR, print it, and keep it on your windscreen.
        </p>
      </div>
    </section>
  );
}
