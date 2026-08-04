import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

import { cn } from '@shared/lib/utils';

type ToastTone = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { ...toast, id }]);

      // Errors stay until dismissed — they usually need action.
      if (toast.tone !== 'error') {
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          role="region"
          aria-label="Notifications"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
        >
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
} as const;

const TONE_STYLES = {
  info: 'text-ink-muted',
  success: 'text-success-ink',
  error: 'text-danger-ink',
} as const;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.tone];

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-card border border-line bg-bg p-4 shadow-lifted"
    >
      <Icon size={18} className={cn('mt-0.5 shrink-0', TONE_STYLES[toast.tone])} aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-subtle transition-colors hover:bg-card hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
