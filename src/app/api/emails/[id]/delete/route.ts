import { NextResponse } from 'next/server';
import { trashEmail } from '@/lib/sync';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/emails/[id]/delete
 *
 * Mueve el mensaje a la papelera de Gmail (reversible durante 30 dias) y lo
 * quita del cache local. Nunca borra de forma permanente.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const result = await trashEmail(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.warning ?? 'Correo no encontrado' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo mover a la papelera', detail: String(error) },
      { status: 500 },
    );
  }
}

/** Alias por POST: algunos clientes no permiten cuerpo ni metodo DELETE. */
export const POST = DELETE;
