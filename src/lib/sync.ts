import { classifyEmail } from '@/lib/classifier';
import { createMailSource, resolveSourceMode, type SourceMode } from '@/lib/gmail/adapter';
import type { FetchOptions } from '@/lib/gmail/types';
import {
  deleteEmail,
  finishSyncLog,
  getEmail,
  setRead,
  startSyncLog,
  upsertEmails,
  type UpsertEmailInput,
} from '@/lib/repository';
import type { SyncResult } from '@/types/email';

/**
 * Orquestador de sincronizacion: trae, clasifica y guarda.
 *
 * Todo el lote se clasifica en memoria y se escribe en una sola transaccion,
 * que es lo que pide el enunciado sobre "priorizar procesamiento en lote".
 */
export async function runSync(
  options: FetchOptions & { mode?: SourceMode } = {},
): Promise<SyncResult> {
  const startedAt = Date.now();
  const mode = options.mode ?? resolveSourceMode();
  const { source, warning } = createMailSource(mode);
  const logId = startSyncLog(source.name);
  const errors: string[] = warning ? [warning] : [];

  try {
    const messages = await source.fetchRecent({
      maxResults: options.maxResults,
      query: options.query,
    });

    const prepared: UpsertEmailInput[] = [];
    let skipped = 0;

    for (const message of messages) {
      try {
        const result = classifyEmail({
          subject: message.subject,
          senderName: message.senderName,
          senderEmail: message.senderEmail,
          body: message.body,
          dateReceived: message.dateReceived,
        });

        prepared.push({
          id: message.id,
          threadId: message.threadId,
          senderName: message.senderName,
          senderEmail: message.senderEmail,
          subject: message.subject,
          dateReceived: message.dateReceived,
          snippet: message.snippet,
          bodyPreview: message.body.slice(0, 1200),
          category: result.category,
          confidence: result.confidence,
          extractedData: result.extractedData,
          isRead: message.isRead,
        });
      } catch (error) {
        // Un mensaje raro no debe abortar la sincronizacion completa.
        skipped += 1;
        errors.push(
          `No se pudo clasificar ${message.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const { inserted, updated } = upsertEmails(prepared);

    finishSyncLog(logId, {
      fetched: messages.length,
      inserted,
      updated,
      skipped,
      error: errors.length > 0 && inserted + updated === 0 ? errors.join(' | ') : undefined,
    });

    return {
      fetched: messages.length,
      inserted,
      updated,
      skipped,
      source: source.name,
      durationMs: Date.now() - startedAt,
      syncedAt: new Date().toISOString(),
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishSyncLog(logId, { fetched: 0, inserted: 0, updated: 0, skipped: 0, error: message });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Acciones en tiempo real
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok: boolean;
  /** true si el cambio se propago tambien a Gmail. */
  syncedToGmail: boolean;
  warning?: string;
}

/**
 * Marca como leido.
 *
 * El estado local se escribe primero para que la UI responda de inmediato; si
 * Gmail falla se devuelve un aviso, pero la accion local se conserva.
 */
export async function markEmailAsRead(id: string, isRead = true): Promise<ActionResult> {
  const existed = setRead(id, isRead);
  if (!existed) return { ok: false, syncedToGmail: false, warning: 'El correo no existe en el cache local' };

  const { source } = createMailSource();
  if (!source.supportsWriteback || !isRead) {
    return {
      ok: true,
      syncedToGmail: false,
      warning: source.supportsWriteback
        ? undefined
        : `La fuente "${source.name}" no escribe en Gmail: el cambio quedo solo en local.`,
    };
  }

  try {
    await source.markAsRead(id);
    return { ok: true, syncedToGmail: true };
  } catch (error) {
    return {
      ok: true,
      syncedToGmail: false,
      warning: `Marcado localmente, pero Gmail rechazo la operacion: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Mueve a la papelera.
 *
 * Se usa `trash` de Gmail (reversible durante 30 dias), nunca el borrado
 * permanente. En local la fila se elimina del cache.
 */
export async function trashEmail(id: string): Promise<ActionResult> {
  const email = getEmail(id);
  if (!email) return { ok: false, syncedToGmail: false, warning: 'El correo no existe en el cache local' };

  const { source } = createMailSource();
  let syncedToGmail = false;
  let warning: string | undefined;

  if (source.supportsWriteback) {
    try {
      await source.moveToTrash(id);
      syncedToGmail = true;
    } catch (error) {
      warning = `No se pudo mover a la papelera en Gmail: ${
        error instanceof Error ? error.message : String(error)
      }. Se elimino solo del cache local.`;
    }
  } else {
    warning = `La fuente "${source.name}" no escribe en Gmail: el correo se quito solo del cache local.`;
  }

  deleteEmail(id);
  return { ok: true, syncedToGmail, warning };
}
