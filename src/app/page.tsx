import { Dashboard } from '@/components/Dashboard';
import { resolveSourceMode } from '@/lib/gmail/adapter';
import { getStats, listEmails } from '@/lib/repository';
import { sqliteDateToIso } from '@/lib/utils';

// Lee SQLite en cada peticion: nada de prerender estatico.
export const dynamic = 'force-dynamic';

export default function Page() {
  // La carga inicial viene del servidor para que la primera pintura ya traiga
  // datos; a partir de ahi el dashboard se refresca por fetch.
  const emails = listEmails({ limit: 500 });
  const stats = getStats();

  return (
    <Dashboard
      initialEmails={emails}
      initialStats={{ ...stats, lastSyncAt: sqliteDateToIso(stats.lastSyncAt) }}
      initialSource={resolveSourceMode()}
    />
  );
}
