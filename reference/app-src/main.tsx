/**
 * ACT — application entry
 *
 * One React root for the whole platform. The landing site, the taxi product
 * and the control centre are modules inside this tree, not separate apps.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { App } from './App';
import { OfflineBanner } from '@shared/components/ui/EmptyState';
import { AuthProvider } from '@shared/providers/AuthProvider';
import { FlagsProvider } from '@shared/providers/FlagsProvider';
import { ThemeProvider } from '@shared/providers/ThemeProvider';
import { ApiError } from '@shared/lib/http';
import { installReleaseErrorReporting } from '@shared/lib/releaseReporting';

import '@shared/styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry auth failures or client errors — only transient ones.
        if (error instanceof ApiError) {
          if (!error.isRetryable) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/* Catch crashes React never sees — unhandled rejections and window errors —
   and attribute them to this release. Installed before render so a failure
   during first paint is still recorded. */
installReleaseErrorReporting();

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/*
          No basename.

          The taxi app used to be built twice — once standalone and once with
          --base=/taxi/ so it could be served from inside the ACT site. That is
          gone: there is one build, mounted at the origin root, and /taxi is an
          ordinary route inside this router rather than a separate deployment
          mounted at a path.
        */}
        <BrowserRouter>
          {/* Auth wraps Flags: flag evaluation is per-user, so it must be able
              to see the session. Inverting these makes every rollout evaluate
              as signed-out on first paint. */}
          <AuthProvider>
            <FlagsProvider>
              <OfflineBanner />
              <App />
            </FlagsProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);

// Remove the pre-hydration splash now that React owns the page.
document.getElementById('boot')?.remove();
