'use client';

import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastMessage {
  id: number;
  tone: 'success' | 'error' | 'info';
  text: string;
}

const TONES = {
  success: { color: 'text-accent-green', Icon: CheckCircle2 },
  error: { color: 'text-accent-red', Icon: AlertTriangle },
  info: { color: 'text-accent', Icon: Info },
} as const;

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const { color, Icon } = TONES[toast.tone];

  // Los errores se quedan hasta que el usuario los cierre; los avisos se van solos.
  useEffect(() => {
    if (toast.tone === 'error') return;
    const timer = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div
      role="status"
      className="flex animate-slide-up items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 shadow-pop"
    >
      <Icon size={14} className={cn('mt-0.5 shrink-0', color)} />
      <p className="flex-1 text-xs leading-relaxed text-text-2">{toast.text}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded p-0.5 text-text-3 transition-colors hover:text-text"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
