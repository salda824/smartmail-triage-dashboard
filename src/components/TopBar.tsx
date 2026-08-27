'use client';

import { useEffect, useRef } from 'react';
import { LayoutGrid, List, MailWarning, RefreshCw, Search, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { cn, fullDateTime, relativeTime } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  unreadCount: number;
  totalCount: number;
  lastSyncAt: string | null;
  syncing: boolean;
  onSync: () => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (value: boolean) => void;
  source: string;
}

export function TopBar({
  search,
  onSearchChange,
  unreadCount,
  totalCount,
  lastSyncAt,
  syncing,
  onSync,
  view,
  onViewChange,
  unreadOnly,
  onUnreadOnlyChange,
  source,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" enfoca el buscador, como en Gmail; Escape lo limpia.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingElsewhere =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if (event.key === '/' && !typingElsewhere) {
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

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-midnight-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        {/* Identidad */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-violet shadow-glow">
            <Zap size={18} className="text-white" />
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight text-white">
              SmartMail <span className="text-accent-blue">Triage</span>
            </h1>
            <p className="text-[10px] text-slate-500">
              {totalCount} correos en cache
              {source !== 'gmail' && (
                <span className="ml-1 text-accent-orange">· fuente: {source}</span>
              )}
            </p>
          </div>
        </div>

        {/* Buscador */}
        <div className="order-last w-full min-w-0 flex-1 sm:order-none sm:w-auto">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por remitente o asunto…"
              aria-label="Buscar correos"
              className={cn(
                'h-10 w-full rounded-lg border border-white/[0.08] bg-midnight-800/80 pl-9 pr-16 text-sm',
                'text-slate-200 placeholder:text-slate-600',
                'transition-colors duration-150 focus:border-accent-blue/50 focus:bg-midnight-800',
                '[&::-webkit-search-cancel-button]:appearance-none',
              )}
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Limpiar busqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Contador de pendientes */}
        <button
          type="button"
          onClick={() => onUnreadOnlyChange(!unreadOnly)}
          aria-pressed={unreadOnly}
          title={unreadOnly ? 'Mostrar todos los correos' : 'Mostrar solo los pendientes'}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors duration-150',
            unreadOnly
              ? 'bg-accent-blue/15 text-blue-300 ring-1 ring-inset ring-accent-blue/40'
              : 'bg-midnight-800/80 text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:text-slate-200',
          )}
        >
          <MailWarning size={15} />
          <span className="tabular-nums">{unreadCount}</span>
          <span className="hidden md:inline">pendientes</span>
        </button>

        {/* Selector de vista */}
        <div
          role="group"
          aria-label="Modo de vista"
          className="flex h-10 shrink-0 items-center gap-0.5 rounded-lg bg-midnight-800/80 p-1 ring-1 ring-inset ring-white/[0.08]"
        >
          <IconButton
            label="Vista de tarjetas"
            aria-pressed={view === 'grid'}
            onClick={() => onViewChange('grid')}
            className={cn('h-8 w-8', view === 'grid' && 'bg-midnight-600 text-white')}
          >
            <LayoutGrid size={15} />
          </IconButton>
          <IconButton
            label="Vista de lista"
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
            className={cn('h-8 w-8', view === 'list' && 'bg-midnight-600 text-white')}
          >
            <List size={15} />
          </IconButton>
        </div>

        {/* Sincronizar */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="primary" onClick={onSync} disabled={syncing} className="shrink-0">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sincronizar Ahora'}
          </Button>

          <div className="hidden text-right leading-tight lg:block">
            <div className="text-[10px] uppercase tracking-wide text-slate-600">Ultima sync</div>
            <div
              className="text-[11px] text-slate-400"
              title={lastSyncAt ? fullDateTime(lastSyncAt) : undefined}
            >
              {lastSyncAt ? relativeTime(lastSyncAt) : 'nunca'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
