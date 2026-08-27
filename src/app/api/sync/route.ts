import { NextResponse, type NextRequest } from 'next/server';
import { runSync } from '@/lib/sync';
import { getStats } from '@/lib/repository';
import { sqliteDateToIso } from '@/lib/utils';
import type { SourceMode } from '@/lib/gmail/adapter';

export const dynamic = 'force-dynamic';
// Traer y clasificar decenas de mensajes supera el limite por defecto de 15 s.
export const maxDuration = 120;

/**
 * POST /api/sync
 *
 * Body opcional: { maxResults?: number, query?: string, mode?: 'gmail'|'bridge'|'demo' }
 */
export async function POST(request: NextRequest) {
  let body: { maxResults?: number; query?: string; mode?: SourceMode } = {};

  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    // Un body vacio o mal formado no es motivo de error: se sincroniza con los valores por defecto.
  }

  try {
    const result = await runSync({
      maxResults: body.maxResults,
      query: body.query,
      mode: body.mode,
    });

    const stats = getStats();

    return NextResponse.json({
      ...result,
      stats: { ...stats, lastSyncAt: sqliteDateToIso(stats.lastSyncAt) },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'La sincronizacion fallo', detail },
      { status: 502 },
    );
  }
}

/** GET devuelve el mismo shape para poder probar el endpoint desde el navegador. */
export async function GET() {
  const stats = getStats();
  return NextResponse.json({
    hint: 'Usa POST para lanzar una sincronizacion.',
    stats: { ...stats, lastSyncAt: sqliteDateToIso(stats.lastSyncAt) },
  });
}
