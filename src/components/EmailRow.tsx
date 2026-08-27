'use client';

import { Avatar } from '@/components/Avatar';
import { EmailActions, type PendingAction } from '@/components/EmailActions';
import { EmailMetadata } from '@/components/EmailMetadata';
import { cn, fullDateTime, relativeTime } from '@/lib/utils';
import { CATEGORY_META, type Email } from '@/types/email';

interface Props {
  email: Email;
  pending: PendingAction;
  onToggleRead: (email: Email) => void;
  onDelete: (email: Email) => void;
}

/** Vista compacta: una linea por correo, pensada para revisar volumen rapido. */
export function EmailRow({ email, pending, onToggleRead, onDelete }: Props) {
  const meta = CATEGORY_META[email.category];

  return (
    <div
      className={cn(
        'group flex items-center gap-3 border-l-2 border-b border-b-white/[0.05] px-3 py-2.5 transition-colors duration-150',
        'hover:bg-midnight-750/60',
        meta.accent,
        email.isRead ? 'opacity-70 hover:opacity-100' : '',
      )}
    >
      <span
        aria-label={email.isRead ? 'Leido' : 'No leido'}
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          email.isRead ? 'bg-transparent' : 'bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.9)]',
        )}
      />

      <Avatar name={email.senderName} email={email.senderEmail} size="sm" />

      <div className="w-40 shrink-0 truncate text-xs sm:w-48">
        <span className={email.isRead ? 'text-slate-400' : 'font-semibold text-slate-100'}>
          {email.senderName || email.senderEmail}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            'truncate text-sm',
            email.isRead ? 'text-slate-300' : 'font-semibold text-white',
          )}
        >
          {email.subject}
        </span>
        <span className="hidden truncate text-xs text-slate-500 lg:inline">— {email.snippet}</span>
      </div>

      <div className="hidden shrink-0 xl:block">
        <EmailMetadata category={email.category} data={email.extractedData} variant="compact" />
      </div>

      <span
        className={cn(
          'hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-block',
          meta.badge,
        )}
        title={meta.label}
      >
        <span aria-hidden>{meta.emoji}</span>
      </span>

      <time
        dateTime={email.dateReceived}
        title={fullDateTime(email.dateReceived)}
        className="w-16 shrink-0 text-right text-[11px] tabular-nums text-slate-500"
      >
        {relativeTime(email.dateReceived)}
      </time>

      <div className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <EmailActions
          email={email}
          pending={pending}
          onToggleRead={onToggleRead}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
