import { NextResponse, type NextRequest } from 'next/server';
import { listEmails } from '@/lib/repository';
import { CATEGORIES, type Category } from '@/types/email';

// El cache de correos cambia con cada accion del usuario: nunca se pre-renderiza.
export const dynamic = 'force-dynamic';

/**
 * GET /api/emails
 *
 * Query: category, q, unread, archived, limit, offset, sort
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const rawCategory = (params.get('category') ?? 'ALL').toUpperCase();
  const category: Category | 'ALL' = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : 'ALL';

  const rawLimit = Number.parseInt(params.get('limit') ?? '200', 10);
  const rawOffset = Number.parseInt(params.get('offset') ?? '0', 10);

  const sortParam = params.get('sort');
  const sort =
    sortParam === 'date_asc' || sortParam === 'sender' ? sortParam : ('date_desc' as const);

  try {
    const emails = listEmails({
      category,
      search: params.get('q') ?? '',
      unreadOnly: params.get('unread') === 'true',
      includeArchived: params.get('archived') === 'true',
      // Un limite acotado evita que un query manipulado pida la tabla entera.
      limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200,
      offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
      sort,
    });

    return NextResponse.json({ emails, count: emails.length });
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudieron listar los correos', detail: String(error) },
      { status: 500 },
    );
  }
}
