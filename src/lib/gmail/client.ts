import { google, type gmail_v1 } from 'googleapis';
import { MailSourceError, type FetchOptions, type MailSource, type RawMessage } from '@/lib/gmail/types';

/**
 * Fuente real: Gmail API v1 mediante OAuth 2.0 con refresh token.
 *
 * Se usa el refresh token en lugar de un flujo interactivo porque el cron
 * diario corre sin nadie delante de la pantalla.
 */

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/callback';

  if (!clientId || !clientSecret) {
    throw new MailSourceError(
      'Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Copia .env.example a .env.local y completalos.',
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ---------------------------------------------------------------------------
// Parsing de mensajes
// ---------------------------------------------------------------------------

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** Convierte HTML a texto plano legible por el clasificador. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Recorre el arbol MIME buscando cuerpo utilizable.
 * Prefiere `text/plain`; si solo hay HTML, lo convierte.
 */
export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  const plain: string[] = [];
  const html: string[] = [];

  const walk = (part: gmail_v1.Schema$MessagePart) => {
    const mime = part.mimeType ?? '';
    const data = part.body?.data;

    if (data) {
      if (mime === 'text/plain') plain.push(decodeBase64Url(data));
      else if (mime === 'text/html') html.push(decodeBase64Url(data));
    }
    for (const child of part.parts ?? []) walk(child);
  };

  walk(payload);

  if (plain.length > 0) return plain.join('\n').trim();
  if (html.length > 0) return htmlToText(html.join('\n'));
  return '';
}

/** Separa `"Nombre Apellido" <correo@dominio.com>` en sus dos partes. */
export function parseSender(raw: string): { name: string; email: string } {
  if (!raw) return { name: '', email: '' };

  const angled = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled) {
    return {
      name: angled[1].replace(/^["']|["']$/g, '').trim() || angled[2].split('@')[0],
      email: angled[2].trim().toLowerCase(),
    };
  }

  const bare = raw.trim().toLowerCase();
  return { name: bare.split('@')[0], email: bare };
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export function toRawMessage(message: gmail_v1.Schema$Message): RawMessage | null {
  if (!message.id) return null;

  const headers = message.payload?.headers ?? [];
  const sender = parseSender(headerValue(headers, 'From'));
  const labels = message.labelIds ?? [];

  // `internalDate` es epoch en ms y es mas fiable que la cabecera Date, que el remitente controla.
  const dateReceived = message.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : new Date(headerValue(headers, 'Date') || Date.now()).toISOString();

  return {
    id: message.id,
    threadId: message.threadId ?? message.id,
    senderName: sender.name,
    senderEmail: sender.email,
    subject: headerValue(headers, 'Subject') || '(sin asunto)',
    dateReceived,
    snippet: message.snippet ?? '',
    body: extractBody(message.payload) || message.snippet || '',
    isRead: !labels.includes('UNREAD'),
    labels,
  };
}

// ---------------------------------------------------------------------------
// Fuente
// ---------------------------------------------------------------------------

export class GmailSource implements MailSource {
  readonly name = 'gmail';
  readonly supportsWriteback = true;

  private client: gmail_v1.Gmail;

  constructor() {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new MailSourceError(
        'Falta GOOGLE_REFRESH_TOKEN. Ejecuta `npm run gmail:auth` para generarlo.',
      );
    }

    const auth = createOAuthClient();
    auth.setCredentials({ refresh_token: refreshToken });
    this.client = google.gmail({ version: 'v1', auth });
  }

  async fetchRecent(options: FetchOptions = {}): Promise<RawMessage[]> {
    const maxResults = options.maxResults ?? Number(process.env.SYNC_MAX_RESULTS ?? 80);
    const query = options.query ?? process.env.SYNC_QUERY ?? 'newer_than:14d';

    try {
      const list = await this.client.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);
      if (ids.length === 0) return [];

      // Gmail no expone un endpoint de lectura masiva; se limita la concurrencia
      // para no chocar contra el rate limit de la API.
      const messages: RawMessage[] = [];
      const CONCURRENCY = 8;

      for (let i = 0; i < ids.length; i += CONCURRENCY) {
        const chunk = ids.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map(async (id) => {
            const detail = await this.client.users.messages.get({
              userId: 'me',
              id,
              format: 'full',
            });
            return toRawMessage(detail.data);
          }),
        );
        for (const message of results) {
          if (message) messages.push(message);
        }
      }

      return messages;
    } catch (error) {
      throw new MailSourceError('Fallo al consultar la Gmail API', error);
    }
  }

  async markAsRead(id: string): Promise<void> {
    try {
      await this.client.users.messages.modify({
        userId: 'me',
        id,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    } catch (error) {
      throw new MailSourceError(`No se pudo marcar como leido el mensaje ${id}`, error);
    }
  }

  async moveToTrash(id: string): Promise<void> {
    try {
      // `trash` es reversible desde Gmail durante 30 dias; nunca usamos `delete`.
      await this.client.users.messages.trash({ userId: 'me', id });
    } catch (error) {
      throw new MailSourceError(`No se pudo mover a la papelera el mensaje ${id}`, error);
    }
  }
}
