'use client';

import { Inbox, Loader2, Pin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dot } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TimeAgo } from '@/components/TimeAgo';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type Category, type CategoryCounts } from '@/types/email';

export type TabId = Category | 'ALL';

/**
 * Empleo va primero y fijo: es la categoria de mayor prioridad para el usuario,
 * y tenerla siempre en el mismo sitio evita buscarla cuando la bandeja crece.
 */
const NAV_ORDER: Category[] = ['JOB', 'URGENT', 'FINANCE', 'NEWS', 'INTERESTING', 'GENERAL'];

interface Props {
  active: TabId;
  counts: CategoryCounts;
  totals: { total: number; unread: number };
  lastSyncAt: string | null;
  syncing: boolean;
  source: string;
  onChange: (tab: TabId) => void;
  onSync: () => void;
}

function NavItem({
  label,
  count,
  unread,
  dot,
  active,
  pinned,
  onClick,
  title,
  icon,
}: {
  label: string;
  count: number;
  unread: number;
  dot?: string;
  active: boolean;
  pinned?: boolean;
  onClick: () => void;
  title?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors duration-150',
        active
          ? 'bg-surface-3 font-medium text-text'
          : 'text-text-2 hover:bg-surface-2 hover:text-text',
      )}
    >
      {icon ?? <Dot className={cn(dot, !active && 'opacity-70 group-hover:opacity-100')} />}

      <span className="flex-1 truncate text-left">{label}</span>

      {pinned && <Pin size={11} className="shrink-0 text-text-3" aria-label="Fija" />}

      {/* Se muestra el numero de no leidos; si no hay, el total en gris. */}
      <span
        className={cn(
          'shrink-0 tabular-nums',
          unread > 0 ? 'text-xs font-medium text-text' : 'text-2xs text-text-3',
        )}
      >
        {unread > 0 ? unread : count || ''}
      </span>
    </button>
  );
}

export function Sidebar({
  active,
  counts,
  totals,
  lastSyncAt,
  syncing,
  source,
  onChange,
  onSync,
}: Props) {
  return (
    <aside className="flex h-full w-sidebar shrink-0 flex-col border-r border-line bg-surface">
      {/* Marca */}
      <div className="flex h-toolbar items-center gap-2.5 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 7.5 12 13l9-5.5M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold tracking-tight">SmartMail</div>
          <div className="truncate text-2xs text-text-3">Triage</div>
        </div>
      </div>

      {/* Navegacion */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" aria-label="Categorias">
        <NavItem
          label="Todos"
          icon={<Inbox size={14} className="shrink-0 text-text-3" />}
          count={totals.total}
          unread={totals.unread}
          active={active === 'ALL'}
          onClick={() => onChange('ALL')}
        />

        <div className="px-2.5 pb-1 pt-4 text-2xs font-medium uppercase tracking-wider text-text-3">
          Categorias
        </div>

        {NAV_ORDER.map((id) => {
          const meta = CATEGORY_META[id];
          const c = counts[id] ?? { total: 0, unread: 0 };
          return (
            <NavItem
              key={id}
              label={meta.label}
              title={meta.description}
              dot={meta.dot}
              count={c.total}
              unread={c.unread}
              active={active === id}
              pinned={id === 'JOB'}
              onClick={() => onChange(id)}
            />
          );
        })}
      </nav>

      {/* Pie: sincronizacion y tema */}
      <div className="space-y-2.5 border-t border-line p-3">
        <Button
          variant="primary"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          className="w-full"
        >
          {syncing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {syncing ? 'Sincronizando' : 'Sincronizar'}
        </Button>

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <div className="truncate text-2xs text-text-3">
              {lastSyncAt ? (
                <TimeAgo iso={lastSyncAt} prefix="Sync " />
              ) : (
                'Sin sincronizar'
              )}
            </div>
            <div className="flex items-center gap-1 truncate text-2xs text-text-3">
              <Dot className={source === 'gmail' ? 'bg-accent-green' : 'bg-accent-amber'} />
              {source === 'gmail' ? 'Gmail' : source === 'bridge' ? 'Archivo local' : 'Demo'}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
