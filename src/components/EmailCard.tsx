'use client';

import { Check, ExternalLink, Loader2, Trash2, Undo2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MetaRows } from '@/components/EmailMetadata';
import { TimeAgo } from '@/components/TimeAgo';
import { cn, gmailUrl } from '@/lib/utils';
import { CATEGORY_META, type Email, type PendingAction } from '@/types/email';

interface Props {
  email: Email;
  pending: PendingAction;
  onToggleRead: (email: Email) => void;
  onDelete: (email: Email) => void;
}

/** Boton de accion del pie de la tarjeta: icono + tinte propio. */
function CardAction({
  tone,
  label,
  onClick,
  disabled,
  children,
}: {
  tone: 'green' | 'red' | 'blue';
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const tones = {
    green:
      'border-accent-green/25 text-accent-green hover:bg-accent-green/12 hover:border-accent-green/45',
    red: 'border-accent-red/25 text-accent-red hover:bg-accent-red/12 hover:border-accent-red/45',
    blue: 'border-accent/25 text-accent hover:bg-accent/12 hover:border-accent/45',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 flex-1 items-center justify-center rounded-lg border transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        tones[tone],
      )}
    >
      {children}
    </button>
  );
}

export function EmailCard({ email, pending, onToggleRead, onDelete }: Props) {
  const meta = CATEGORY_META[email.category];
  const busy = pending !== null;

  return (
    <article
      className={cn(
        'group flex flex-col rounded-xl border bg-surface p-4 transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop',
        // El no leido se marca con el borde tenido de su categoria, no con un
        // bloque de color: destaca sin gritar.
        email.isRead ? 'border-line' : 'border-line-strong',
      )}
    >
      <header className="flex items-start gap-2.5">
        <Avatar name={email.senderName} email={email.senderEmail} size="lg" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'truncate text-[13px]',
                email.isRead ? 'font-medium text-text-2' : 'font-semibold text-text',
              )}
            >
              {email.senderName || email.senderEmail}
            </span>
            {!email.isRead && (
              <span
                aria-label="No leido"
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)}
              />
            )}
          </div>
          <div className="truncate text-2xs text-text-3">{email.senderEmail}</div>
        </div>

        <TimeAgo
          iso={email.dateReceived}
          className="shrink-0 pt-0.5 text-2xs tabular-nums text-text-3"
        />
      </header>

      <h3
        className={cn(
          'mt-3 line-clamp-2 text-[13px] leading-snug',
          email.isRead ? 'font-medium text-text-2' : 'font-semibold text-text',
        )}
      >
        {email.subject}
      </h3>

      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-3">{email.snippet}</p>

      <MetaRows category={email.category} data={email.extractedData} />

      {/* El pie se ancla abajo para que las tarjetas de una fila cuadren. */}
      <footer className="mt-auto pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-2xs font-medium ring-1 ring-inset',
              meta.chip,
            )}
          >
            <CategoryIcon name={meta.icon} size={11} />
            {meta.label}
          </span>
          <span className="shrink-0 text-2xs tabular-nums text-text-3">
            {Math.round(email.confidence * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <CardAction
            tone="green"
            disabled={busy}
            label={email.isRead ? 'Marcar como no leido' : 'Marcar como leido'}
            onClick={() => onToggleRead(email)}
          >
            {pending === 'read' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : email.isRead ? (
              <Undo2 size={14} />
            ) : (
              <Check size={14} />
            )}
          </CardAction>

          <CardAction
            tone="red"
            disabled={busy}
            label="Mover a la papelera"
            onClick={() => onDelete(email)}
          >
            {pending === 'delete' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </CardAction>

          <a
            href={gmailUrl(email.id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir en Gmail"
            title="Abrir en Gmail"
            className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-accent/25 text-accent transition-all duration-150 hover:border-accent/45 hover:bg-accent/12"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </footer>
    </article>
  );
}
