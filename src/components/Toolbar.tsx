'use client';

import { useEffect, useRef } from 'react';
import { AlignJustify, Check, Loader2, MailWarning, PanelRight, RefreshCw, Rows3, Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import { CATEGORY_META } from '@/types/email';
import type { TabId, ViewMode } from '@/components/Sidebar';

export type Density = 'comfortable' | 'compact';

interface Props {
  tab: TabId;
  visibleCount: number;
  totalCount: number;
  unreadCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  density: Density;
  onDensityChange: (value: Density) => void;
  detailOpen: boolean;
  onToggleDetail: () => void;
  view: ViewMode;
  syncing: boolean;
  onSync: () => void;
}

export function Toolbar({
  tab,
  visibleCount,
  totalCount,
  unreadCount,
  search,
  onSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
  density,
  onDensityChange,
  detailOpen,
  onToggleDetail,
  view,
  syncing,
  onSync,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" enfoca el buscador (convencion de Gmail y GitHub); Escape lo limpia.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        onSearchChange('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSearchChange]);

  const title = tab === 'ALL' ? 'Todos los correos' : CATEGORY_META[tab].label;

  return (
    <header className="shrink-0 border-b border-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 shrink-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
          <p className="truncate text-2xs tabular-nums text-text-3">
            {visibleCount === totalCount
              ? `${visibleCount} correos`
              : `${visibleCount} de ${totalCount}`}
          </p>
        </div>

        {/* Buscador */}
        <div className="relative ml-auto w-full max-w-md">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3"
          />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por remitente o asunto"
            aria-label="Buscar correos"
            className={cn(
              'h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-9 text-[13px]',
              'text-text placeholder:text-text-3',
              'transition-colors duration-150 focus:border-accent/40 focus:bg-surface',
            )}
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar busqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-3 hover:text-text"
            >
              <X size={13} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-text-3">
              /
            </kbd>
          )}
        </div>

        {/* Pendientes: tambien actua como filtro */}
        <button
          type="button"
          onClick={() => onUnreadOnlyChange(!unreadOnly)}
          aria-pressed={unreadOnly}
          title={unreadOnly ? 'Mostrar todos' : 'Mostrar solo los pendientes'}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 transition-colors duration-150',
            unreadOnly
              ? 'border-accent/35 bg-accent/12 text-accent'
              : 'border-line bg-surface-2 text-text-2 hover:text-text',
          )}
        >
          {unreadOnly ? <Check size={14} /> : <MailWarning size={14} />}
          <span className="text-sm font-semibold tabular-nums">{unreadCount}</span>
          <span className="hidden text-2xs md:inline">pendientes</span>
        </button>

        {/* Sincronizar: la accion principal, con brillo propio */}
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-[13px] font-medium text-white',
            'bg-gradient-to-r from-accent to-accent-violet shadow-glow',
            'transition-all duration-150 hover:brightness-110 active:brightness-95',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
          )}
        >
          {syncing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {syncing ? 'Sincronizando' : 'Sincronizar Ahora'}
        </button>

        {/* Controles propios de la vista de lista */}
        {view === 'list' && (
          <div className="flex shrink-0 items-center gap-1 border-l border-line pl-2">
            <IconButton
              size="sm"
              label="Vista comoda"
              active={density === 'comfortable'}
              onClick={() => onDensityChange('comfortable')}
            >
              <Rows3 size={14} />
            </IconButton>
            <IconButton
              size="sm"
              label="Vista compacta"
              active={density === 'compact'}
              onClick={() => onDensityChange('compact')}
            >
              <AlignJustify size={14} />
            </IconButton>
            <IconButton
              size="sm"
              label={detailOpen ? 'Ocultar panel de lectura' : 'Mostrar panel de lectura'}
              active={detailOpen}
              onClick={onToggleDetail}
            >
              <PanelRight size={14} />
            </IconButton>
          </div>
        )}
      </div>
    </header>
  );
}
