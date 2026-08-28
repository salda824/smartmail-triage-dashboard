'use client';

import { Inbox, LayoutGrid, List, Pin } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TimeAgo } from '@/components/TimeAgo';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type Category, type CategoryCounts } from '@/types/email';

export type TabId = Category | 'ALL';
export type ViewMode = 'cards' | 'list';

/**
 * Empleo va primero y fijo: es la categoria de mayor prioridad para el usuario,
 * y tenerla siempre en el mismo sitio evita buscarla cuando la bandeja crece.
 */
const NAV_ORDER: Category[] = ['JOB', 'URGENT', 'FINANCE', 'NEWS', 'INTERESTING', 'GENERAL'];

/** `live` indica que las acciones se propagan a Gmail, no solo al cache local. */
const SOURCE_LABEL: Record<string, { label: string; live: boolean }> = {
  imap: { label: 'Gmail (IMAP)', live: true },
  gmail: { label: 'Gmail (API)', live: true },
  bridge: { label: 'Archivo local', live: false },
  demo: { label: 'Datos de ejemplo', live: false },
};

interface Props {
  active: TabId;
  counts: CategoryCounts;
  totals: { total: number; unread: number };
  lastSyncAt: string | null;
  source: string;
  view: ViewMode;
  onChange: (tab: TabId) => void;
  onViewChange: (view: ViewMode) => void;
}

function NavItem({
  label,
  count,
  unread,
  active,
  pinned,
  onClick,
  title,
  icon,
  accent,
}: {
  label: string;
  count: number;
  unread: number;
  active: boolean;
  pinned?: boolean;
  onClick: () => void;
  title?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-2 text-[13px] transition-colors duration-150',
        active ? 'bg-surface-2 font-medium text-text' : 'text-text-2 hover:bg-surface-2/60 hover:text-text',
      )}
    >
      {/* Marca de seleccion en el borde, mas discreta que teñir toda la fila. */}
      {active && (
        <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
      )}

      <span className={cn('shrink-0', active ? accent ?? 'text-accent' : 'text-text-3')}>
        {icon}
      </span>

      <span className="flex-1 truncate text-left">{label}</span>

      {pinned && <Pin size={10} className="shrink-0 text-text-3" aria-label="Fija" />}

      <span
        className={cn(
          'shrink-0 rounded px-1 tabular-nums',
          unread > 0
            ? 'bg-accent/15 text-2xs font-semibold text-accent'
            : 'text-2xs text-text-3',
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
  source,
  view,
  onChange,
  onViewChange,
}: Props) {
  return (
    <aside className="flex h-full w-sidebar shrink-0 flex-col border-r border-line bg-surface">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-violet text-white shadow-glow">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
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
          <div className="truncate text-sm font-semibold tracking-tight">SmartMail Triage</div>
          <div className="truncate text-2xs text-text-3">Tu bandeja, ordenada</div>
        </div>
      </div>

      {/* Navegacion */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2" aria-label="Categorias">
        <NavItem
          label="Todos"
          icon={<Inbox size={15} />}
          count={totals.total}
          unread={totals.unread}
          active={active === 'ALL'}
          onClick={() => onChange('ALL')}
        />

        <div className="px-2.5 pb-1 pt-5 text-2xs font-medium uppercase tracking-wider text-text-3">
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
              icon={<CategoryIcon name={meta.icon} size={15} />}
              accent={meta.text}
              count={c.total}
              unread={c.unread}
              active={active === id}
              pinned={id === 'JOB'}
              onClick={() => onChange(id)}
            />
          );
        })}

        <div className="px-2.5 pb-1.5 pt-5 text-2xs font-medium uppercase tracking-wider text-text-3">
          Vista
        </div>

        <div className="flex gap-1 px-0.5">
          {(
            [
              { id: 'cards', label: 'Tarjetas', Icon: LayoutGrid },
              { id: 'list', label: 'Lista', Icon: List },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              aria-pressed={view === id}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-2xs font-medium transition-colors duration-150',
                view === id
                  ? 'bg-surface-3 text-text'
                  : 'text-text-3 hover:bg-surface-2 hover:text-text-2',
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Pie: origen de datos y tema */}
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 truncate text-2xs text-text-2">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                // Verde solo cuando hay conexion real con Gmail; ambar cuando el
                // origen es local y las acciones no se propagan.
                SOURCE_LABEL[source]?.live ? 'bg-accent-green' : 'bg-accent-amber',
              )}
            />
            {SOURCE_LABEL[source]?.label ?? source}
          </div>
          <div className="truncate text-2xs text-text-3">
            {lastSyncAt ? <TimeAgo iso={lastSyncAt} prefix="Sync " /> : 'Sin sincronizar'}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
