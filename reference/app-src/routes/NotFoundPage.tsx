import { Link } from 'react-router-dom';

import { Button } from '@shared/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-ink">404</p>
        <h1 className="mt-3 text-h2 text-ink">This page took a wrong turn</h1>
        <p className="mt-3 text-body leading-relaxed text-ink-muted">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Link to="/" className="mt-8 inline-block">
          <Button size="lg">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
