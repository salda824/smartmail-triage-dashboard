import { getDb } from '@/lib/db';
import {
  CATEGORIES,
  type Category,
  type CategoryCounts,
  type DashboardStats,
  type Email,
  type EmailRow,
  type ExtractedData,
} from '@/types/email';

// ---------------------------------------------------------------------------
// Mapeo fila <-> dominio
// ---------------------------------------------------------------------------

function parseExtracted(raw: string): ExtractedData {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ExtractedData) : {};
  } catch {
    // Una fila con JSON corrupto no debe tumbar el dashboard entero.
    return {};
  }
}

export function rowToEmail(row: EmailRow): Email {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    subject: row.subject,
    dateReceived: row.date_received,
    snippet: row.snippet,
    bodyPreview: row.body_preview,
    category: (CATEGORIES as readonly string[]).includes(row.category)
      ? (row.category as Category)
      : 'GENERAL',
    confidence: row.confidence,
    extractedData: parseExtracted(row.extracted_data),
    isRead: row.is_read === 1,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export interface UpsertEmailInput {
  id: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  dateReceived: string;
  snippet: string;
  bodyPreview: string;
  category: Category;
  confidence: number;
  extractedData: ExtractedData;
  isRead: boolean;
}

/**
 * Inserta o actualiza un correo.
 *
 * En un correo ya conocido se refresca la clasificacion y el contenido, pero
 * `is_archived` se conserva: si el usuario ya lo archivo localmente, una
 * sincronizacion posterior no debe devolverlo a la bandeja.
 */
export function upsertEmail(input: UpsertEmailInput): 'inserted' | 'updated' {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM emails WHERE id = ?').get(input.id) as
    | { id: string }
    | undefined;

  db.prepare(
    `INSERT INTO emails (
       id, thread_id, sender_name, sender_email, subject, date_received,
       snippet, body_preview, category, confidence, extracted_data, is_read
     ) VALUES (
       @id, @threadId, @senderName, @senderEmail, @subject, @dateReceived,
       @snippet, @bodyPreview, @category, @confidence, @extractedData, @isRead
     )
     ON CONFLICT(id) DO UPDATE SET
       subject        = excluded.subject,
       snippet        = excluded.snippet,
       body_preview   = excluded.body_preview,
       category       = excluded.category,
       confidence     = excluded.confidence,
       extracted_data = excluded.extracted_data,
       is_read        = excluded.is_read,
       updated_at     = datetime('now')`,
  ).run({
    id: input.id,
    threadId: input.threadId,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    subject: input.subject,
    dateReceived: input.dateReceived,
    snippet: input.snippet,
    bodyPreview: input.bodyPreview,
    category: input.category,
    confidence: input.confidence,
    extractedData: JSON.stringify(input.extractedData ?? {}),
    isRead: input.isRead ? 1 : 0,
  });

  return existing ? 'updated' : 'inserted';
}

/** Inserta un lote completo dentro de una sola transaccion. */
export function upsertEmails(inputs: UpsertEmailInput[]): { inserted: number; updated: number } {
  const db = getDb();
  let inserted = 0;
  let updated = 0;

  const run = db.transaction((batch: UpsertEmailInput[]) => {
    for (const item of batch) {
      if (upsertEmail(item) === 'inserted') inserted += 1;
      else updated += 1;
    }
  });

  run(inputs);
  return { inserted, updated };
}

export function setRead(id: string, isRead: boolean): boolean {
  const db = getDb();
  const result = db
    .prepare(`UPDATE emails SET is_read = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(isRead ? 1 : 0, id);
  return result.changes > 0;
}

export function setArchived(id: string, isArchived: boolean): boolean {
  const db = getDb();
  const result = db
    .prepare(`UPDATE emails SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(isArchived ? 1 : 0, id);
  return result.changes > 0;
}

/** Borra la fila del cache local. La papelera de Gmail se gestiona aparte. */
export function deleteEmail(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM emails WHERE id = ?').run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export interface ListEmailsOptions {
  category?: Category | 'ALL';
  search?: string;
  unreadOnly?: boolean;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  sort?: 'date_desc' | 'date_asc' | 'sender';
}

export function listEmails(options: ListEmailsOptions = {}): Email[] {
  const {
    category = 'ALL',
    search = '',
    unreadOnly = false,
    includeArchived = false,
    limit = 200,
    offset = 0,
    sort = 'date_desc',
  } = options;

  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (!includeArchived) where.push('is_archived = 0');
  if (category !== 'ALL') {
    where.push('category = @category');
    params.category = category;
  }
  if (unreadOnly) where.push('is_read = 0');

  const term = search.trim();
  if (term) {
    where.push(
      '(subject LIKE @term OR sender_name LIKE @term OR sender_email LIKE @term OR snippet LIKE @term)',
    );
    params.term = `%${term}%`;
  }

  const orderBy =
    sort === 'date_asc'
      ? 'date_received ASC'
      : sort === 'sender'
        ? 'sender_name COLLATE NOCASE ASC, date_received DESC'
        : 'date_received DESC';

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT * FROM emails ${whereClause} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`;

  const rows = getDb()
    .prepare(sql)
    .all({ ...params, limit, offset }) as EmailRow[];

  return rows.map(rowToEmail);
}

export function getEmail(id: string): Email | null {
  const row = getDb().prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined;
  return row ? rowToEmail(row) : null;
}

function emptyCounts(): CategoryCounts {
  return CATEGORIES.reduce((acc, key) => {
    acc[key] = { total: 0, unread: 0 };
    return acc;
  }, {} as CategoryCounts);
}

export function getStats(): DashboardStats {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT category,
              COUNT(*) AS total,
              SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
       FROM emails
       WHERE is_archived = 0
       GROUP BY category`,
    )
    .all() as { category: string; total: number; unread: number }[];

  const byCategory = emptyCounts();
  let total = 0;
  let unread = 0;

  for (const row of rows) {
    const key = (CATEGORIES as readonly string[]).includes(row.category)
      ? (row.category as Category)
      : 'GENERAL';
    byCategory[key].total += row.total;
    byCategory[key].unread += row.unread ?? 0;
    total += row.total;
    unread += row.unread ?? 0;
  }

  return { total, unread, byCategory, lastSyncAt: getLastSuccessfulSyncAt() };
}

// ---------------------------------------------------------------------------
// Bitacora de sincronizacion
// ---------------------------------------------------------------------------

export function startSyncLog(source: string): number {
  const result = getDb()
    .prepare(
      `INSERT INTO sync_log (started_at, source, status) VALUES (datetime('now'), ?, 'running')`,
    )
    .run(source);
  return Number(result.lastInsertRowid);
}

export function finishSyncLog(
  id: number,
  data: { fetched: number; inserted: number; updated: number; skipped: number; error?: string },
): void {
  getDb()
    .prepare(
      `UPDATE sync_log
       SET finished_at = datetime('now'),
           fetched = ?, inserted = ?, updated = ?, skipped = ?,
           status = ?, error = ?
       WHERE id = ?`,
    )
    .run(
      data.fetched,
      data.inserted,
      data.updated,
      data.skipped,
      data.error ? 'error' : 'ok',
      data.error ?? null,
      id,
    );
}

export function getLastSuccessfulSyncAt(): string | null {
  const row = getDb()
    .prepare(`SELECT finished_at FROM sync_log WHERE status = 'ok' ORDER BY id DESC LIMIT 1`)
    .get() as { finished_at: string | null } | undefined;
  return row?.finished_at ?? null;
}
