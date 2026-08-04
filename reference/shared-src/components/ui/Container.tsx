import type { ElementType, ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

/**
 * Horizontal rhythm for the whole site.
 *
 * Every section uses this rather than repeating max-width and padding, so the
 * page has one gutter and changing it changes everything at once. `as` exists
 * so a container can be a <section> or <header> without a wrapper div —
 * landmark elements matter to screen reader navigation.
 */
export function Container({
  as: Tag = 'div',
  size = 'default',
  className,
  children,
}: {
  as?: ElementType;
  size?: 'default' | 'narrow' | 'wide';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full px-gutter',
        size === 'narrow' && 'max-w-3xl',
        size === 'default' && 'max-w-site',
        size === 'wide' && 'max-w-[85rem]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
