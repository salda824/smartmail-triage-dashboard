'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, SearchX } from 'lucide-react';
import { CategoryTabs, type TabId } from '@/components/CategoryTabs';
import { EmailCard } from '@/components/EmailCard';
import { EmailRow } from '@/components/EmailRow';
import { TopBar, type ViewMode } from '@/components/TopBar';
import { ToastStack, type ToastMessage } from '@/components/Toast';
import type { PendingAction } from '@/components/EmailActions';
import { CATEGORIES, type CategoryCounts, type DashboardStats, type Email } from '@/types/email';

interface Props {
  initialEmails: Email[];
  initialStats: DashboardStats;
  initialSource: string;
}

const VIEW_STORAGE_KEY = 'smartmail:view';

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
  const [view, setView] = useState<ViewMode>('grid');

  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toastId = useRef(0);

  const pushToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    toastId.current += 1;
    setToasts((prev) => [...prev, { id: toastId.current, tone, text }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // La preferencia de vista es del dispositivo, no del servidor: localStorage basta.
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'grid' || stored === 'list') setView(stored);
  }, []);

  const changeView = useCallback((next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }, []);

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
      if (data.source) setSource(data.source);

      const { fetched = 0, inserted = 0, updated = 0 } = data;
      pushToast(
        'success',
        `Sincronizado: ${fetched} correos revisados, ${inserted} nuevos, ${updated} actualizados.`,
      );

      for (const warning of (data.errors ?? []) as string[]) {
        pushToast('info', warning);
      }
    } catch (error) {
      pushToast('error', `No se pudo contactar el servidor: ${String(error)}`);
    } finally {
      setSyncing(false);
    }
  }, [pushToast, reloadEmails]);

  // -------------------------------------------------------------------------
  // Acciones por correo (optimistas, con reversion si el servidor rechaza)
  // -------------------------------------------------------------------------

  const handleToggleRead = useCallback(
    async (email: Email) => {
      const nextRead = !email.isRead;
      const snapshot = emails;

      setPending((p) => ({ ...p, [email.id]: 'read' }));
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, isRead: nextRead } : e)),
      );

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
        if (data.warning) pushToast('info', data.warning);
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

      setPending((p) => ({ ...p, [email.id]: 'delete' }));
      setEmails((prev) => prev.filter((e) => e.id !== email.id));

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
          data.syncedToGmail
            ? 'Movido a la papelera de Gmail.'
            : 'Quitado del panel.',
        );
        if (data.warning) pushToast('info', data.warning);
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

  // -------------------------------------------------------------------------
  // Filtrado
  // -------------------------------------------------------------------------

  /**
   * El filtrado ocurre en cliente sobre el cache ya cargado: son cientos de
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

  // Los contadores de las pestanas salen de la lista en memoria para que
  // reaccionen al instante cuando el usuario marca o borra algo.
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
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        unreadCount={totals.unread}
        totalCount={totals.total}
        lastSyncAt={stats.lastSyncAt}
        syncing={syncing}
        onSync={handleSync}
        view={view}
        onViewChange={changeView}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
        source={source}
      />

      <div className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6">
        <CategoryTabs active={tab} counts={counts} totals={totals} onChange={setTab} />

        <main className="mt-4">
          {visible.length === 0 ? (
            <EmptyState hasFilters={Boolean(search) || unreadOnly || tab !== 'ALL'} total={emails.length} />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visible.map((email) => (
                <EmailCard
                  key={email.id}
                  email={email}
                  pending={pending[email.id] ?? null}
                  onToggleRead={handleToggleRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="surface overflow-hidden">
              {visible.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  pending={pending[email.id] ?? null}
                  onToggleRead={handleToggleRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {visible.length > 0 && (
            <p className="mt-4 text-center text-[11px] text-slate-600">
              Mostrando {visible.length} de {emails.length} correos en cache
            </p>
          )}
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function EmptyState({ hasFilters, total }: { hasFilters: boolean; total: number }) {
  const Icon = hasFilters ? SearchX : Inbox;

  return (
    <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-midnight-700 text-slate-500">
        <Icon size={22} />
      </span>
      <h2 className="text-sm font-semibold text-slate-300">
        {hasFilters ? 'Ningun correo coincide con el filtro' : 'La bandeja esta vacia'}
      </h2>
      <p className="max-w-sm text-xs leading-relaxed text-slate-500">
        {hasFilters
          ? 'Prueba con otro termino de busqueda o cambia de categoria.'
          : total === 0
            ? 'Pulsa "Sincronizar Ahora" para traer y clasificar tus correos recientes.'
            : 'Todos los correos de esta vista fueron atendidos.'}
      </p>
    </div>
  );
}
