import { ImapFlow, type FetchMessageObject } from 'imapflow';
import { simpleParser } from 'mailparser';
import { stripInvisible, toSingleLine } from '@/lib/gmail/sanitize';
import {
  MailSourceError,
  type FetchOptions,
  type MailSource,
  type RawMessage,
} from '@/lib/gmail/types';

/**
 * Fuente por IMAP con contrasena de aplicacion.
 *
 * Alternativa a OAuth: no necesita proyecto en Google Cloud ni pantalla de
 * consentimiento, y la credencial no caduca sola a los siete dias. A cambio la
 * contrasena de aplicacion da acceso completo al buzon, asi que vive en
 * `.env.local` y nunca se registra en el log.
 */

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export function readImapConfig(): ImapConfig {
  const user = process.env.IMAP_USER?.trim();
  // Google muestra la contrasena en grupos de cuatro; se aceptan con espacios.
  const password = process.env.IMAP_APP_PASSWORD?.replace(/\s+/g, '');

  if (!user || !password) {
    throw new MailSourceError(
      'Faltan IMAP_USER / IMAP_APP_PASSWORD. Copia .env.example a .env.local y completalos.',
    );
  }

  return {
    host: process.env.IMAP_HOST?.trim() || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT ?? 993),
    user,
    password,
  };
}

/** Normaliza las fechas de imapflow, que llegan como Date o como texto. */
function toIsoDate(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Gmail identifica cada mensaje con X-GM-MSGID, un entero de 64 bits que
 * imapflow entrega en decimal. La interfaz web usa su representacion
 * hexadecimal en la URL, que es justo el identificador con el que ya trabaja el
 * resto de la app: asi los correos que ya estaban en cache se reconocen en vez
 * de duplicarse.
 */
export function toGmailHexId(emailId: string | undefined): string | null {
  if (!emailId) return null;
  const clean = emailId.replace(/^0+/, '') || '0';
  if (/^\d+$/.test(clean)) {
    try {
      return BigInt(clean).toString(16);
    } catch {
      return null;
    }
  }
  // Algunos servidores ya lo entregan en hexadecimal.
  return /^[0-9a-f]+$/i.test(clean) ? clean.toLowerCase() : null;
}

/** Camino inverso: del id hexadecimal al decimal que espera la busqueda IMAP. */
export function toGmailDecimalId(hexId: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hexId)) return null;
  try {
    return BigInt(`0x${hexId}`).toString(10);
  } catch {
    return null;
  }
}

function parseAddress(value: unknown): { name: string; email: string } {
  const addr = Array.isArray(value) ? value[0] : value;
  if (!addr || typeof addr !== 'object') return { name: '', email: '' };

  const record = addr as { name?: string; address?: string };
  const email = (record.address ?? '').toLowerCase();
  const name = (record.name ?? '').trim() || email.split('@')[0] || '';
  return { name, email };
}

export class ImapSource implements MailSource {
  readonly name = 'imap';
  readonly supportsWriteback = true;

  private config: ImapConfig;

  constructor(config: ImapConfig = readImapConfig()) {
    this.config = config;
  }

  private createClient(): ImapFlow {
    return new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: true,
      auth: { user: this.config.user, pass: this.config.password },
      // ImapFlow escribe cada comando IMAP por consola si se deja activo, y ahi
      // aparecen asuntos y remitentes. Se silencia.
      logger: false,
    });
  }

  /** Abre conexion, ejecuta y cierra siempre, incluso si la operacion falla. */
  private async withClient<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createClient();

    try {
      await client.connect();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const hint = /auth/i.test(detail)
        ? ' Revisa que la verificacion en dos pasos este activa y que la contrasena de aplicacion sea correcta.'
        : '';
      throw new MailSourceError(`No se pudo conectar a ${this.config.host}: ${detail}${hint}`);
    }

    try {
      return await fn(client);
    } finally {
      // `logout` puede fallar si el servidor ya corto; no debe tapar el error real.
      await client.logout().catch(() => client.close());
    }
  }

  async fetchRecent(options: FetchOptions = {}): Promise<RawMessage[]> {
    const maxResults = options.maxResults ?? Number(process.env.SYNC_MAX_RESULTS ?? 80);
    const days = Number(process.env.IMAP_SINCE_DAYS ?? 14);
    const since = new Date(Date.now() - days * 86_400_000);

    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock('INBOX');

      try {
        const uids = await client.search({ since }, { uid: true });
        if (!uids || uids.length === 0) return [];

        // Los mas recientes primero, acotados al limite configurado.
        const wanted = uids.slice(-maxResults).reverse();

        const messages: RawMessage[] = [];

        for await (const message of client.fetch(
          wanted,
          {
            uid: true,
            flags: true,
            envelope: true,
            internalDate: true,
            threadId: true,
            labels: true,
            // `emailId` (X-GM-MSGID en Gmail) no se pide: imapflow lo incluye
            // siempre que el servidor soporta la extension.
            //
            // Se descarga el mensaje completo y se deja el trabajo sucio de
            // MIME, codificacion y HTML a mailparser, que ya lo resuelve bien.
            source: true,
          },
          { uid: true },
        )) {
          const parsed = await this.toRawMessage(message);
          if (parsed) messages.push(parsed);
        }

        return messages;
      } finally {
        lock.release();
      }
    });
  }

  private async toRawMessage(message: FetchMessageObject): Promise<RawMessage | null> {
    const hexId = toGmailHexId(message.emailId ?? undefined);
    // Sin identificador de Gmail no hay forma de enlazar el correo ni de
    // reconocerlo en la siguiente sincronizacion: mejor omitirlo.
    if (!hexId) return null;

    const flags = message.flags ?? new Set<string>();
    const envelope = message.envelope;
    const gmailLabels = message.labels ? [...message.labels] : [];

    let body = '';
    let subject = envelope?.subject ?? '';
    let sender = parseAddress(envelope?.from);

    if (message.source) {
      try {
        const mail = await simpleParser(message.source);
        body = mail.text ?? (mail.html ? String(mail.html).replace(/<[^>]+>/g, ' ') : '');
        subject = mail.subject ?? subject;
        if (mail.from?.value?.length) {
          const first = mail.from.value[0];
          sender = {
            name: (first.name ?? '').trim() || (first.address ?? '').split('@')[0],
            email: (first.address ?? '').toLowerCase(),
          };
        }
      } catch {
        // Un mensaje con MIME roto no debe tumbar la sincronizacion entera;
        // se conserva lo que ya dio el envelope.
      }
    }

    const cleanBody = stripInvisible(body);

    return {
      id: hexId,
      threadId: toGmailHexId(message.threadId ?? undefined) ?? hexId,
      senderName: sender.name,
      senderEmail: sender.email,
      subject: stripInvisible(subject) || '(sin asunto)',
      dateReceived: toIsoDate(message.internalDate ?? envelope?.date),
      snippet: toSingleLine(cleanBody),
      body: cleanBody,
      // En IMAP el estado de lectura es la marca \Seen, no una etiqueta.
      isRead: flags.has('\\Seen'),
      labels: gmailLabels.length > 0 ? gmailLabels : [...flags],
    };
  }

  /** Localiza el UID actual a partir del id hexadecimal de Gmail. */
  private async findUid(client: ImapFlow, id: string): Promise<number | null> {
    const decimal = toGmailDecimalId(id);
    if (!decimal) return null;

    const found = await client.search({ emailId: decimal }, { uid: true });
    return found && found.length > 0 ? found[0] : null;
  }

  async markAsRead(id: string): Promise<void> {
    await this.withClient(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uid = await this.findUid(client, id);
        if (!uid) throw new MailSourceError(`No se encontro el mensaje ${id} en la bandeja`);
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  async moveToTrash(id: string): Promise<void> {
    await this.withClient(async (client) => {
      // El nombre de la papelera esta traducido ("[Gmail]/Papelera"), asi que
      // se busca por su marca especial en vez de por texto.
      const boxes = await client.list();
      const trash = boxes.find((box) => box.specialUse === '\\Trash');
      if (!trash) {
        throw new MailSourceError('No se encontro la carpeta de papelera en la cuenta');
      }

      const lock = await client.getMailboxLock('INBOX');
      try {
        const uid = await this.findUid(client, id);
        if (!uid) throw new MailSourceError(`No se encontro el mensaje ${id} en la bandeja`);
        // Mover, nunca marcar \Deleted + EXPUNGE: desde la papelera se puede
        // recuperar durante 30 dias.
        await client.messageMove(String(uid), trash.path, { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  /** Comprueba credenciales y devuelve cuantos mensajes tiene la bandeja. */
  async verifyConnection(): Promise<{ mailbox: string; total: number }> {
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const status = await client.status('INBOX', { messages: true });
        return { mailbox: 'INBOX', total: status.messages ?? 0 };
      } finally {
        lock.release();
      }
    });
  }
}
