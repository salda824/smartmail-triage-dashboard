'use client';

import { useEffect, useRef } from 'react';
import { AlignJustify, Check, PanelRight, Rows3, Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import { CATEGORY_META } from '@/types/email';
import type { TabId } from '@/components/Sidebar';

export type Density = 'comfortable' | 'compact';

interface Props {
  tab: TabId;
  visibleCount: number;
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  density: Density;
  onDensityChange: (value: Density) => void;
  detailOpen: boolean;
  onToggleDetail: () => void;
}

export function Toolbar({
  tab,
  visibleCount,
  totalCount,
  search,
  onSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
  density,
  onDensityChange,
  detailOpen,
  onToggleDetail,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" enfoca el buscador (convencion de Gmail y GitHub); Escape lo limpia.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing =
        el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable;

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
    <header className="flex h-toolbar shrink-0 items-center gap-3 border-b border-line px-4">
      <div className="min-w-0 shrink-0">
        <h1 className="truncate text-[13px] font-semibold tracking-tight">{title}</h1>
        <p className="truncate text-2xs tabular-nums text-text-3">
          {visibleCount === totalCount
            ? `${visibleCount} correos`
            : `${visibleCount} de ${totalCount}`}
        </p>
      </div>

      <div className="relative ml-auto w-full max-w-sm">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3"
        />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar remitente o asunto"
          aria-label="Buscar correos"
          className={cn(
            'h-8 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-8 text-[13px]',
            'text-text placeholder:text-text-3',
            'transition-colors duration-150 focus:border-accent/40 focus:bg-surface',
          )}
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Limpiar busqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-3 hover:text-text"
          >
            <X size={13} />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line px-1 font-mono text-2xs text-text-3">
            /
          </kbd>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onUnreadOnlyChange(!unreadOnly)}
          aria-pressed={unreadOnly}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-medium transition-colors duration-150',
            unreadOnly
              ? 'border-accent/30 bg-accent/12 text-accent'
              : 'border-line bg-surface-2 text-text-2 hover:text-text',
          )}
        >
          {unreadOnly && <Check size={12} />}
          Sin leer
        </button>

        <div className="mx-1 h-5 w-px bg-line" aria-hidden />

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
    </header>
  );
}
