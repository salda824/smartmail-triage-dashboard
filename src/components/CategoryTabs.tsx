'use client';

import { Inbox, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_META, type Category, type CategoryCounts } from '@/types/email';

export type TabId = Category | 'ALL';

/**
 * Orden de las pestanas.
 *
 * Empleo va primero y fijo por decision de producto: es la categoria de mayor
 * prioridad del usuario, y verla siempre en el mismo sitio evita tener que
 * buscarla cuando la bandeja crece.
 */
const TAB_ORDER: Category[] = ['JOB', 'URGENT', 'FINANCE', 'NEWS', 'INTERESTING', 'GENERAL'];

interface Props {
  active: TabId;
  counts: CategoryCounts;
  totals: { total: number; unread: number };
  onChange: (tab: TabId) => void;
}

function CountBadge({ unread, total, active }: { unread: number; total: number; active: boolean }) {
  // El numero que importa es el de sin leer; si no hay, se muestra el total en gris.
  const showUnread = unread > 0;
  return (
    <span
      className={cn(
        'ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
        showUnread
          ? 'bg-accent-blue text-white'
          : active
            ? 'bg-white/10 text-slate-300'
            : 'bg-white/5 text-slate-500',
      )}
    >
      {showUnread ? unread : total}
    </span>
  );
}

export function CategoryTabs({ active, counts, totals, onChange }: Props) {
  return (
    <nav
      aria-label="Categorias"
      className="flex gap-1.5 overflow-x-auto pb-1"
      role="tablist"
    >
      <button
        role="tab"
        aria-selected={active === 'ALL'}
        onClick={() => onChange('ALL')}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150',
          active === 'ALL'
            ? 'bg-midnight-700 text-white ring-1 ring-inset ring-white/15'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
        )}
      >
        <Inbox size={14} />
        Todos
        <CountBadge unread={totals.unread} total={totals.total} active={active === 'ALL'} />
      </button>

      <div aria-hidden className="my-1 w-px shrink-0 bg-white/10" />

      {TAB_ORDER.map((id) => {
        const meta = CATEGORY_META[id];
        const count = counts[id] ?? { total: 0, unread: 0 };
        const isActive = active === id;

        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            title={meta.description}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150',
              isActive
                ? 'bg-midnight-700 text-white ring-1 ring-inset ring-white/15'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
            )}
            style={isActive ? { boxShadow: `inset 0 -2px 0 ${meta.hex}` } : undefined}
          >
            <span aria-hidden>{meta.emoji}</span>
            <span className="hidden sm:inline">{meta.label}</span>
            {id === 'JOB' && (
              <Pin size={11} aria-label="Categoria fija" className="text-accent-violet" />
            )}
            <CountBadge unread={count.unread} total={count.total} active={isActive} />
          </button>
        );
      })}
    </nav>
  );
}
