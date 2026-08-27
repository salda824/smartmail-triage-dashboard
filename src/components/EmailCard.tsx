'use client';

import { Avatar } from '@/components/Avatar';
import { EmailActions, type PendingAction } from '@/components/EmailActions';
import { EmailMetadata } from '@/components/EmailMetadata';
import { Badge } from '@/components/ui/badge';
import { cn, fullDateTime, relativeTime } from '@/lib/utils';
import { CATEGORY_META, type Email } from '@/types/email';

interface Props {
  email: Email;
  pending: PendingAction;
  onToggleRead: (email: Email) => void;
  onDelete: (email: Email) => void;
}

export function EmailCard({ email, pending, onToggleRead, onDelete }: Props) {
  const meta = CATEGORY_META[email.category];

  return (
    <article
      className={cn(
        'surface surface-hover group animate-fade-up flex flex-col border-l-2 p-4 shadow-card',
        meta.accent,
        // El no leido se distingue por brillo, no solo por negrita.
        email.isRead ? 'opacity-75 hover:opacity-100' : '',
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar name={email.senderName} email={email.senderEmail} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'truncate text-sm',
                email.isRead ? 'font-medium text-slate-400' : 'font-semibold text-slate-100',
              )}
            >
              {email.senderName || email.senderEmail}
            </span>
            {!email.isRead && (
              <span
                aria-label="No leido"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.9)]"
              />
            )}
          </div>
          <div className="truncate text-[11px] text-slate-500">{email.senderEmail}</div>
        </div>

        <time
          dateTime={email.dateReceived}
          title={fullDateTime(email.dateReceived)}
          className="shrink-0 text-[11px] tabular-nums text-slate-500"
        >
          {relativeTime(email.dateReceived)}
        </time>
      </header>

      <h3
        className={cn(
          'mt-3 line-clamp-2 text-sm leading-snug',
          email.isRead ? 'text-slate-300' : 'font-semibold text-white',
        )}
      >
        {email.subject}
      </h3>

      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{email.snippet}</p>

      <EmailMetadata category={email.category} data={email.extractedData} />

      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <Badge className={meta.badge}>
          <span aria-hidden>{meta.emoji}</span>
          {meta.label}
        </Badge>

        <div className="opacity-60 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <EmailActions
            email={email}
            pending={pending}
            onToggleRead={onToggleRead}
            onDelete={onDelete}
          />
        </div>
      </footer>
    </article>
  );
}
