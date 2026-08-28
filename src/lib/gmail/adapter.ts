import fs from 'node:fs';
import path from 'node:path';
import { buildDemoMessages } from '@/lib/gmail/demo-data';
import { GmailSource } from '@/lib/gmail/client';
import { ImapSource } from '@/lib/gmail/imap';
import { stripInvisible, toSingleLine } from '@/lib/gmail/sanitize';
import {
  MailSourceError,
  type FetchOptions,
  type MailSource,
  type RawMessage,
} from '@/lib/gmail/types';

export type SourceMode = 'imap' | 'gmail' | 'bridge' | 'demo';

// ---------------------------------------------------------------------------
// Fuente puente: archivo JSON
// ---------------------------------------------------------------------------

/**
 * Lee los correos de un archivo JSON en disco.
 *
 * Existe para el caso en que los mensajes se obtienen por fuera de la app (por
 * ejemplo con las herramientas de Gmail del entorno, o con una exportacion
 * manual) y solo hace falta que el dashboard los clasifique y los muestre.
 *
 * No puede escribir de vuelta en Gmail: las acciones quedan solo en local.
 */
export class BridgeSource implements MailSource {
  readonly name = 'bridge';
  readonly supportsWriteback = false;

  constructor(private readonly filePath: string) {}

  async fetchRecent(options: FetchOptions = {}): Promise<RawMessage[]> {
    const resolved = path.isAbsolute(this.filePath)
      ? this.filePath
      : path.join(process.cwd(), this.filePath);

    if (!fs.existsSync(resolved)) {
      throw new MailSourceError(
        `No existe el archivo puente ${resolved}. Genera el JSON o cambia MAIL_SOURCE.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    } catch (error) {
      throw new MailSourceError(`El archivo puente ${resolved} no es JSON valido`, error);
    }

    // Acepta tanto un arreglo suelto como { messages: [...] }.
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { messages?: unknown }).messages)
        ? ((parsed as { messages: unknown[] }).messages)
        : null;

    if (!list) {
      throw new MailSourceError(
        'El archivo puente debe ser un arreglo de mensajes o un objeto { "messages": [...] }',
      );
    }

    const messages = list
      .map((item, index) => normalizeBridgeMessage(item, index))
      .filter((m): m is RawMessage => m !== null);

    const limit = options.maxResults ?? Number(process.env.SYNC_MAX_RESULTS ?? 200);
    return messages.slice(0, limit);
  }

  async markAsRead(): Promise<void> {
    // Sin conexion a Gmail no hay nada que propagar; el estado local ya se guardo.
  }

  async moveToTrash(): Promise<void> {
    // Idem: la fila local se elimina, el mensaje en Gmail queda intacto.
  }
}

/** Tolera las variantes de nombre mas comunes (snake_case, camelCase, formato Gmail API). */
function normalizeBridgeMessage(item: unknown, index: number): RawMessage | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Record<string, unknown>;

  const str = (...keys: string[]): string => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === 'string' && value.trim()) return value;
      if (typeof value === 'number') return String(value);
    }
    return '';
  };

  const id = str('id', 'messageId', 'message_id') || `bridge-${index}`;
  const fromRaw = str('from', 'sender', 'From');
  const senderEmail =
    str('senderEmail', 'sender_email', 'fromEmail') || extractEmailFrom(fromRaw);
  const senderName =
    str('senderName', 'sender_name', 'fromName') || extractNameFrom(fromRaw) || senderEmail;

  const dateRaw = str('dateReceived', 'date_received', 'date', 'internalDate', 'receivedAt');
  const parsedDate = parseFlexibleDate(dateRaw);

  const body = stripInvisible(str('body', 'bodyPreview', 'body_preview', 'text', 'content', 'snippet'));
  const snippet = toSingleLine(str('snippet', 'preview') || body);

  const labels = Array.isArray(raw.labels)
    ? (raw.labels as unknown[]).filter((l): l is string => typeof l === 'string')
    : Array.isArray(raw.labelIds)
      ? (raw.labelIds as unknown[]).filter((l): l is string => typeof l === 'string')
      : [];

  const isRead =
    typeof raw.isRead === 'boolean'
      ? raw.isRead
      : typeof raw.is_read === 'boolean'
        ? raw.is_read
        : typeof raw.unread === 'boolean'
          ? !raw.unread
          : !labels.includes('UNREAD');

  return {
    id,
    threadId: str('threadId', 'thread_id') || id,
    senderName,
    senderEmail: senderEmail.toLowerCase(),
    subject: stripInvisible(str('subject', 'title')) || '(sin asunto)',
    dateReceived: parsedDate,
    snippet,
    body: body || snippet,
    isRead,
    labels,
  };
}

function extractEmailFrom(raw: string): string {
  const match = raw.match(/<([^>]+)>/) ?? raw.match(/([\w.+-]+@[\w.-]+\.\w+)/);
  return match?.[1]?.trim() ?? '';
}

function extractNameFrom(raw: string): string {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*</);
  return match?.[1]?.trim() ?? '';
}

function parseFlexibleDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  // Epoch en milisegundos, como lo entrega `internalDate` de la Gmail API.
  if (/^\d{10,}$/.test(raw)) return new Date(Number(raw)).toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// ---------------------------------------------------------------------------
// Fuente de demostracion
// ---------------------------------------------------------------------------

export class DemoSource implements MailSource {
  readonly name = 'demo';
  readonly supportsWriteback = false;

  async fetchRecent(options: FetchOptions = {}): Promise<RawMessage[]> {
    const messages = buildDemoMessages();
    return options.maxResults ? messages.slice(0, options.maxResults) : messages;
  }

  async markAsRead(): Promise<void> {}
  async moveToTrash(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Fabrica
// ---------------------------------------------------------------------------

const MODES: SourceMode[] = ['imap', 'gmail', 'bridge', 'demo'];

export function resolveSourceMode(): SourceMode {
  const configured = (process.env.MAIL_SOURCE ?? '').trim().toLowerCase();
  if ((MODES as string[]).includes(configured)) return configured as SourceMode;

  // Sin configuracion explicita se elige por las credenciales disponibles.
  if (process.env.IMAP_USER && process.env.IMAP_APP_PASSWORD) return 'imap';
  if (process.env.GOOGLE_REFRESH_TOKEN) return 'gmail';
  return 'demo';
}

/**
 * Construye la fuente configurada.
 *
 * Si Gmail esta pedido pero mal configurado se cae a demo en lugar de reventar:
 * es preferible un dashboard que abre con datos de ejemplo y un aviso, a una
 * pantalla de error.
 */
export function createMailSource(mode: SourceMode = resolveSourceMode()): {
  source: MailSource;
  warning?: string;
} {
  if (mode === 'imap') {
    try {
      return { source: new ImapSource() };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        source: new DemoSource(),
        warning: `IMAP no esta configurado (${detail}). Se usaron datos de demostracion.`,
      };
    }
  }

  if (mode === 'gmail') {
    try {
      return { source: new GmailSource() };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        source: new DemoSource(),
        warning: `Gmail no esta configurado (${detail}). Se usaron datos de demostracion.`,
      };
    }
  }

  if (mode === 'bridge') {
    return { source: new BridgeSource(process.env.BRIDGE_INBOX_PATH ?? './data/bridge-inbox.json') };
  }

  return { source: new DemoSource() };
}
