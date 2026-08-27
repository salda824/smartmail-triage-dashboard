import { NextResponse, type NextRequest } from 'next/server';
import { markEmailAsRead } from '@/lib/sync';
import { getEmail } from '@/lib/repository';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * POST | PATCH /api/emails/[id]/read
 *
 * Body opcional: { isRead: boolean } - por defecto true.
 * Marca en el cache local y, si la fuente lo permite, tambien en Gmail.
 */
async function handle(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let isRead = true;
  try {
    const text = await request.text();
    if (text.trim()) {
      const body = JSON.parse(text) as { isRead?: boolean };
      if (typeof body.isRead === 'boolean') isRead = body.isRead;
    }
  } catch {
    // Body invalido: se conserva el valor por defecto.
  }

  try {
    const result = await markEmailAsRead(id, isRead);
    if (!result.ok) {
      return NextResponse.json({ error: result.warning ?? 'Correo no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ ...result, email: getEmail(id) });
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo actualizar el correo', detail: String(error) },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const PATCH = handle;
