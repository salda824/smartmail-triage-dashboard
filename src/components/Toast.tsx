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
  success: { ring: 'ring-accent-emerald/30', text: 'text-emerald-300', Icon: CheckCircle2 },
  error: { ring: 'ring-accent-coral/30', text: 'text-red-300', Icon: AlertTriangle },
  info: { ring: 'ring-accent-blue/30', text: 'text-blue-300', Icon: Info },
} as const;

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const { ring, text, Icon } = TONES[toast.tone];

  // Los errores se quedan hasta que el usuario los cierre; los avisos se van solos.
  useEffect(() => {
    if (toast.tone === 'error') return;
    const timer = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        'animate-fade-up flex items-start gap-2.5 rounded-lg bg-midnight-800 px-3.5 py-2.5 shadow-card ring-1 ring-inset',
        ring,
      )}
    >
      <Icon size={15} className={cn('mt-0.5 shrink-0', text)} />
      <p className="flex-1 text-xs leading-relaxed text-slate-300">{toast.text}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-200"
      >
        <X size={13} />
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
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
