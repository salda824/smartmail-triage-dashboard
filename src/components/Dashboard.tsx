'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, SearchX } from 'lucide-react';
import { EmailDetail } from '@/components/EmailDetail';
import { EmailListItem } from '@/components/EmailListItem';
import { Sidebar, type TabId } from '@/components/Sidebar';
import { Toolbar, type Density } from '@/components/Toolbar';
import { ToastStack, type ToastMessage } from '@/components/Toast';
import {
  CATEGORIES,
  type CategoryCounts,
  type DashboardStats,
  type Email,
  type PendingAction,
} from '@/types/email';

interface Props {
  initialEmails: Email[];
  initialStats: DashboardStats;
  initialSource: string;
}

const STORAGE = {
  density: 'smartmail:density',
  detail: 'smartmail:detail',
} as const;

function emptyCounts(): CategoryCounts {
  return CATEGORIES.reduce((acc, key) => {
    acc[key] = { total: 0, unread: 0 };
    return acc;
  }, {} as CategoryCounts);
}

export function Dashboard({ initialEmails, initialStats, initialSource }: Props) {
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [source, setSource] = useState(initialSource);

  const [tab, setTab] = useState<TabId>('ALL');
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [density, setDensity] = useState<Density>('comfortable');
  const [detailOpen, setDetailOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toastId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const pushToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev, { id: toastId.current, tone, text }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Preferencias de disposicion: son del dispositivo, no del servidor.
  useEffect(() => {
    try {
      const d = window.localStorage.getItem(STORAGE.density);
      if (d === 'comfortable' || d === 'compact') setDensity(d);
      const p = window.localStorage.getItem(STORAGE.detail);
      if (p === '0') setDetailOpen(false);
    } catch {
      // Almacenamiento bloqueado: se usan los valores por defecto.
    }
  }, []);

  const changeDensity = useCallback((value: Density) => {
    setDensity(value);
    try {
      window.localStorage.setItem(STORAGE.density, value);
    } catch {}
  }, []);

  const toggleDetail = useCallback(() => {
    setDetailOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE.detail, next ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Filtrado
  // -------------------------------------------------------------------------

  /**
   * Se filtra en cliente sobre el cache ya cargado: son decenas o cientos de
   * filas, no miles, y asi el buscador responde sin ida y vuelta al servidor.
   */
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return emails.filter((email) => {
      if (tab !== 'ALL' && email.category !== tab) return false;
      if (unreadOnly && email.isRead) return false;
      if (!term) return true;
      return (
        email.subject.toLowerCase().includes(term) ||
        email.senderName.toLowerCase().includes(term) ||
        email.senderEmail.toLowerCase().includes(term) ||
        email.snippet.toLowerCase().includes(term)
      );
    });
  }, [emails, tab, unreadOnly, search]);

  const selected = useMemo(
    () => visible.find((e) => e.id === selectedId) ?? null,
    [visible, selectedId],
  );

  // Si el correo activo sale del filtro, se pasa el foco al primero de la lista.
  useEffect(() => {
    if (visible.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visible.some((e) => e.id === selectedId)) {
      setSelectedId(visible[0].id);
    }
  }, [visible, selectedId]);

  const counts = useMemo(() => {
    const result = emptyCounts();
    for (const email of emails) {
      const bucket = result[email.category];
      if (!bucket) continue;
      bucket.total += 1;
      if (!email.isRead) bucket.unread += 1;
    }
    return result;
  }, [emails]);

  const totals = useMemo(
    () => ({
      total: emails.length,
      unread: emails.reduce((acc, e) => acc + (e.isRead ? 0 : 1), 0),
    }),
    [emails],
  );

  // -------------------------------------------------------------------------
  // Datos
  // -------------------------------------------------------------------------

  const refreshStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as DashboardStats & { source?: string };
      setStats(data);
      if (data.source) setSource(data.source);
    } catch {
      // Un fallo al refrescar contadores no merece interrumpir al usuario.
    }
  }, []);

  const reloadEmails = useCallback(async () => {
    try {
      const response = await fetch('/api/emails?limit=500', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { emails: Email[] };
      setEmails(data.emails);
    } catch {
      pushToast('error', 'No se pudo recargar la lista de correos.');
    }
  }, [pushToast]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await response.json();

      if (!response.ok) {
        pushToast('error', `Sincronizacion fallida: ${data.detail ?? data.error ?? 'error desconocido'}`);
        return;
      }

      await reloadEmails();
      if (data.stats) setStats(data.stats);

      const { fetched = 0, inserted = 0, updated = 0 } = data;
      pushToast('success', `${fetched} revisados · ${inserted} nuevos · ${updated} actualizados`);
      for (const warning of (data.errors ?? []) as string[]) pushToast('info', warning);
    } catch (error) {
      pushToast('error', `No se pudo contactar el servidor: ${String(error)}`);
    } finally {
      setSyncing(false);
    }
  }, [pushToast, reloadEmails]);

  // -------------------------------------------------------------------------
  // Acciones (optimistas, con reversion si el servidor rechaza)
  // -------------------------------------------------------------------------

  const handleToggleRead = useCallback(
    async (email: Email) => {
      const nextRead = !email.isRead;
      const snapshot = emails;

      setPending((p) => ({ ...p, [email.id]: 'read' }));
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, isRead: nextRead } : e)));

      try {
        const response = await fetch(`/api/emails/${encodeURIComponent(email.id)}/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: nextRead }),
        });
        const data = await response.json();

        if (!response.ok) {
          setEmails(snapshot);
          pushToast('error', data.error ?? 'No se pudo actualizar el correo.');
          return;
        }
        await refreshStats();
      } catch (error) {
        setEmails(snapshot);
        pushToast('error', `Error de red: ${String(error)}`);
      } finally {
        setPending((p) => {
          const next = { ...p };
          delete next[email.id];
          return next;
        });
      }
    },
    [emails, pushToast, refreshStats],
  );

  const handleDelete = useCallback(
    async (email: Email) => {
      const snapshot = emails;
      // Se preselecciona el siguiente antes de quitarlo, para no perder el sitio.
      const index = visible.findIndex((e) => e.id === email.id);
      const next = visible[index + 1] ?? visible[index - 1] ?? null;

      setPending((p) => ({ ...p, [email.id]: 'delete' }));
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      setSelectedId(next?.id ?? null);

      try {
        const response = await fetch(`/api/emails/${encodeURIComponent(email.id)}/delete`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (!response.ok) {
          setEmails(snapshot);
          pushToast('error', data.error ?? 'No se pudo mover a la papelera.');
          return;
        }
        pushToast(
          'success',
          data.syncedToGmail ? 'Movido a la papelera de Gmail.' : 'Quitado del panel.',
        );
        if (data.warning) pushToast('info', data.warning);
        await refreshStats();
      } catch (error) {
        setEmails(snapshot);
        pushToast('error', `Error de red: ${String(error)}`);
      } finally {
        setPending((p) => {
          const nextPending = { ...p };
          delete nextPending[email.id];
          return nextPending;
        });
      }
    },
    [emails, visible, pushToast, refreshStats],
  );

  // -------------------------------------------------------------------------
  // Teclado
  // -------------------------------------------------------------------------

  const move = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      const current = visible.findIndex((e) => e.id === selectedId);
      const nextIndex = Math.min(Math.max((current === -1 ? 0 : current) + delta, 0), visible.length - 1);
      const next = visible[nextIndex];
      if (!next) return;

      setSelectedId(next.id);
      // Mantiene visible la fila activa dentro del panel, sin mover la pagina.
      listRef.current
        ?.querySelector(`[data-email-id="${CSS.escape(next.id)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    },
    [visible, selectedId],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          event.preventDefault();
          move(1);
          break;
        case 'k':
        case 'ArrowUp':
          event.preventDefault();
          move(-1);
          break;
        case 'e':
          if (selected) {
            event.preventDefault();
            void handleToggleRead(selected);
          }
          break;
        case '#':
        case 'Delete':
          if (selected) {
            event.preventDefault();
            void handleDelete(selected);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, selected, handleToggleRead, handleDelete]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Sidebar
        active={tab}
        counts={counts}
        totals={totals}
        lastSyncAt={stats.lastSyncAt}
        syncing={syncing}
        source={source}
        onChange={setTab}
        onSync={handleSync}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          tab={tab}
          visibleCount={visible.length}
          totalCount={emails.length}
          search={search}
          onSearchChange={setSearch}
          unreadOnly={unreadOnly}
          onUnreadOnlyChange={setUnreadOnly}
          density={density}
          onDensityChange={changeDensity}
          detailOpen={detailOpen}
          onToggleDetail={toggleDetail}
        />

        <div className="flex min-h-0 flex-1">
          {/* Panel de lista: scroll propio */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Correos"
            className={cnList(detailOpen)}
          >
            {visible.length === 0 ? (
              <EmptyState
                hasFilters={Boolean(search) || unreadOnly || tab !== 'ALL'}
                total={emails.length}
              />
            ) : (
              visible.map((email) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  selected={email.id === selectedId}
                  density={density}
                  pending={pending[email.id] ?? null}
                  onSelect={(e) => setSelectedId(e.id)}
                  onToggleRead={handleToggleRead}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          {/* Panel de lectura: scroll propio */}
          {detailOpen && (
            <div className="hidden min-w-0 flex-1 border-l border-line bg-surface lg:block">
              <EmailDetail
                email={selected}
                pending={selected ? (pending[selected.id] ?? null) : null}
                onToggleRead={handleToggleRead}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

/** El panel de lista se estrecha a ancho fijo cuando hay panel de lectura al lado. */
function cnList(detailOpen: boolean): string {
  return [
    'min-h-0 overflow-y-auto',
    detailOpen ? 'w-full shrink-0 lg:w-[26rem] xl:w-[30rem]' : 'w-full',
  ].join(' ');
}

function EmptyState({ hasFilters, total }: { hasFilters: boolean; total: number }) {
  const Icon = hasFilters ? SearchX : Inbox;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-text-3">
        <Icon size={20} />
      </span>
      <h2 className="text-[13px] font-medium text-text-2">
        {hasFilters ? 'Ningun correo coincide' : 'La bandeja esta vacia'}
      </h2>
      <p className="max-w-[16rem] text-xs leading-relaxed text-text-3">
        {hasFilters
          ? 'Prueba con otro termino o cambia de categoria.'
          : total === 0
            ? 'Pulsa "Sincronizar" para traer y clasificar tus correos.'
            : 'Todo lo de esta vista quedo atendido.'}
      </p>
    </div>
  );
}
