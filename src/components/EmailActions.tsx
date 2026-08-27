'use client';

import { Check, ExternalLink, Loader2, Trash2, Undo2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { gmailUrl } from '@/lib/utils';
import type { Email } from '@/types/email';

export type PendingAction = 'read' | 'delete' | null;

interface Props {
  email: Email;
  pending: PendingAction;
  onToggleRead: (email: Email) => void;
  onDelete: (email: Email) => void;
}

/** Botonera de acciones rapidas, compartida por la tarjeta y la fila. */
export function EmailActions({ email, pending, onToggleRead, onDelete }: Props) {
  const busy = pending !== null;

  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        label={email.isRead ? 'Marcar como no leido' : 'Marcar como leido'}
        tone="emerald"
        disabled={busy}
        onClick={() => onToggleRead(email)}
      >
        {pending === 'read' ? (
          <Loader2 size={15} className="animate-spin" />
        ) : email.isRead ? (
          <Undo2 size={15} />
        ) : (
          <Check size={15} />
        )}
      </IconButton>

      <IconButton
        label="Mover a la papelera"
        tone="coral"
        disabled={busy}
        onClick={() => onDelete(email)}
      >
        {pending === 'delete' ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </IconButton>

      <a
        href={gmailUrl(email.id)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir en Gmail"
        title="Abrir en Gmail"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-accent-blue/15 hover:text-blue-300"
      >
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
