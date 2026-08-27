import { NextResponse } from 'next/server';
import { getStats } from '@/lib/repository';
import { resolveSourceMode } from '@/lib/gmail/adapter';
import { sqliteDateToIso } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** GET /api/stats - contadores por categoria y sello de la ultima sincronizacion. */
export function GET() {
  try {
    const stats = getStats();
    return NextResponse.json({
      ...stats,
      lastSyncAt: sqliteDateToIso(stats.lastSyncAt),
      source: resolveSourceMode(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudieron calcular las estadisticas', detail: String(error) },
      { status: 500 },
    );
  }
}
