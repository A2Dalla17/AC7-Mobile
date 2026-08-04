import type { ReactNode } from 'react';

import { Container } from '@shared/components/ui/Container';
import { cn } from '@shared/lib/utils';

/**
 * A titled page section.
 *
 * The heading is wired to the section with aria-labelledby, which is what lets
 * a screen reader user jump between sections and hear what each one is. A
 * <section> without an accessible name is announced as an anonymous region and
 * is worse than a plain div.
 */
export function Section({
  id,
  title,
  eyebrow,
  description,
  tone = 'default',
  className,
  children,
}: {
  id: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  tone?: 'default' | 'raised';
  className?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cn(tone === 'raised' && 'border-y border-line bg-surface', className)}
    >
      <Container className="py-16 sm:py-20">
        {(title || eyebrow || description) && (
          <header className="mx-auto mb-12 max-w-2xl text-center">
            {eyebrow && (
              <p className="mb-3 text-caption font-semibold uppercase tracking-[0.14em] text-brand-ink">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 id={headingId} className="text-h1 text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-4 text-body-lg leading-relaxed text-ink-muted">{description}</p>
            )}
          </header>
        )}
        {children}
      </Container>
    </section>
  );
}
