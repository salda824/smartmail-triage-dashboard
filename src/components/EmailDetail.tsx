'use client';

import { Check, ExternalLink, Loader2, MailOpen, Trash2, Undo2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { MetaPanel } from '@/components/EmailMetadata';
import { Button } from '@/components/ui/button';
import { Dot } from '@/components/ui/badge';
import { cn, fullDateTime, gmailUrl } from '@/lib/utils';
import { CATEGORY_META, type Email, type PendingAction } from '@/types/email';

interface Props {
  email: Email | null;
  pending: PendingAction;
  onToggleRead: (email: Email) => void;
  onDelete: (email: Email) => void;
}

export function EmailDetail({ email, pending, onToggleRead, onDelete }: Props) {
  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-text-3">
          <MailOpen size={20} />
        </span>
        <p className="text-[13px] font-medium text-text-2">Ningun correo seleccionado</p>
        <p className="max-w-[15rem] text-xs leading-relaxed text-text-3">
          Elige uno de la lista, o muevete con{' '}
          <kbd className="rounded border border-line px-1 font-mono text-2xs">J</kbd> y{' '}
          <kbd className="rounded border border-line px-1 font-mono text-2xs">K</kbd>.
        </p>
      </div>
    );
  }

  const meta = CATEGORY_META[email.category];
  const busy = pending !== null;

  return (
    <div key={email.id} className="flex h-full animate-fade-in flex-col">
      {/* Acciones */}
      <div className="flex h-toolbar shrink-0 items-center gap-1.5 border-b border-line px-4">
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onToggleRead(email)}
        >
          {pending === 'read' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : email.isRead ? (
            <Undo2 size={13} />
          ) : (
            <Check size={13} />
          )}
          {email.isRead ? 'No leido' : 'Leido'}
        </Button>

        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDelete(email)}>
          {pending === 'delete' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Trash2 size={13} />
          )}
          Papelera
        </Button>

        <a
          href={gmailUrl(email.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-2xs font-medium text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text"
        >
          <ExternalLink size={13} />
          Abrir en Gmail
        </a>
      </div>

      {/* Contenido: el scroll vive aqui, no en la pagina */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 text-2xs', meta.text)}>
                <Dot className={meta.dot} />
                {meta.label}
              </span>
              {!email.isRead && (
                <span className="rounded bg-accent/12 px-1.5 py-0.5 text-2xs font-medium text-accent">
                  Sin leer
                </span>
              )}
              <span className="ml-auto text-2xs text-text-3">
                {Math.round(email.confidence * 100)}% de confianza
              </span>
            </div>

            <h2 className="text-base font-semibold leading-snug tracking-tight text-text">
              {email.subject}
            </h2>
          </div>

          <div className="flex items-center gap-3 border-b border-line pb-4">
            <Avatar name={email.senderName} email={email.senderEmail} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-text">
                {email.senderName || email.senderEmail}
              </div>
              <div className="truncate text-xs text-text-3">{email.senderEmail}</div>
            </div>
            <time
              dateTime={email.dateReceived}
              className="shrink-0 text-2xs tabular-nums text-text-3"
            >
              {fullDateTime(email.dateReceived)}
            </time>
          </div>

          <MetaPanel category={email.category} data={email.extractedData} />

          {/* El cuerpo se guarda como texto plano; se respeta el salto de linea. */}
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-2">
            {email.bodyPreview || email.snippet}
          </div>

          <p className="border-t border-line pt-3 text-2xs text-text-3">
            Vista previa del texto. Abre en Gmail para ver el correo completo con
            formato, imagenes y adjuntos.
          </p>
        </div>
      </div>
    </div>
  );
}
