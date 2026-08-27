'use client';

import { Check, Loader2, Trash2, Undo2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Dot } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { MetaChips } from '@/components/EmailMetadata';
import { TimeAgo } from '@/components/TimeAgo';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type Email, type PendingAction } from '@/types/email';
import type { Density } from '@/components/Toolbar';

interface Props {
  email: Email;
  selected: boolean;
  density: Density;
  pending: PendingAction;
  onSelect: (email: Email) => void;
  onToggleRead: (email: Email) => void;
  onDelete: (email: Email) => void;
}

export function EmailListItem({
  email,
  selected,
  density,
  pending,
  onSelect,
  onToggleRead,
  onDelete,
}: Props) {
  const meta = CATEGORY_META[email.category];
  const compact = density === 'compact';
  const busy = pending !== null;

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={() => onSelect(email)}
      data-email-id={email.id}
      className={cn(
        'group relative flex cursor-pointer gap-3 border-b border-line px-3 transition-colors duration-100',
        compact ? 'items-center py-1.5' : 'items-start py-2.5',
        selected ? 'bg-accent/[0.10]' : 'hover:bg-surface-2',
      )}
    >
      {/* Barra de seleccion: reemplaza al borde de color, que competia con todo. */}
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}

      <div className={cn('flex shrink-0 items-center gap-2', !compact && 'pt-0.5')}>
        <Dot
          className={cn(email.isRead ? 'bg-transparent' : 'bg-accent')}
          aria-label={email.isRead ? undefined : 'No leido'}
        />
        <Avatar
          name={email.senderName}
          email={email.senderEmail}
          size={compact ? 'sm' : 'md'}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'truncate text-[13px]',
              compact ? 'w-40 shrink-0' : 'flex-1',
              email.isRead ? 'text-text-2' : 'font-semibold text-text',
            )}
          >
            {email.senderName || email.senderEmail}
          </span>

          {compact && (
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[13px]',
                email.isRead ? 'text-text-2' : 'font-medium text-text',
              )}
            >
              {email.subject}
            </span>
          )}

          <TimeAgo
            iso={email.dateReceived}
            className="shrink-0 text-2xs tabular-nums text-text-3"
          />
        </div>

        {!compact && (
          <>
            <div
              className={cn(
                'mt-0.5 truncate text-[13px]',
                email.isRead ? 'text-text-2' : 'font-medium text-text',
              )}
            >
              {email.subject}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-3">{email.snippet}</p>
          </>
        )}

        <div className={cn('flex items-center gap-1.5', compact ? 'hidden' : 'mt-1.5')}>
          <span className={cn('inline-flex items-center gap-1 text-2xs', meta.text)}>
            <Dot className={meta.dot} />
            {meta.short}
          </span>
          <MetaChips category={email.category} data={email.extractedData} />
        </div>
      </div>

      {/* Acciones: aparecen al pasar el cursor, y siempre para el elemento activo. */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 transition-opacity duration-150',
          'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          selected && 'opacity-100',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          size="sm"
          tone="green"
          disabled={busy}
          label={email.isRead ? 'Marcar como no leido' : 'Marcar como leido'}
          onClick={() => onToggleRead(email)}
        >
          {pending === 'read' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : email.isRead ? (
            <Undo2 size={13} />
          ) : (
            <Check size={13} />
          )}
        </IconButton>
        <IconButton
          size="sm"
          tone="red"
          disabled={busy}
          label="Mover a la papelera"
          onClick={() => onDelete(email)}
        >
          {pending === 'delete' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Trash2 size={13} />
          )}
        </IconButton>
      </div>
    </div>
  );
}
