/**
 * Contrato entre el sincronizador y la fuente de correos.
 *
 * El dashboard no sabe de donde vienen los mensajes: puede ser la Gmail API,
 * un archivo JSON exportado, o el set de demostracion. Todos entregan la misma
 * forma, y la clasificacion ocurre despues, igual para todos.
 */

export interface RawMessage {
  id: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  /** ISO 8601. */
  dateReceived: string;
  snippet: string;
  /** Texto plano del cuerpo, ya des-HTMLizado. */
  body: string;
  isRead: boolean;
  labels: string[];
}

export interface FetchOptions {
  maxResults?: number;
  /** Consulta con la sintaxis del buscador de Gmail, p.ej. `newer_than:14d`. */
  query?: string;
}

export interface MailSource {
  /** Identificador legible que se guarda en la bitacora de sincronizacion. */
  readonly name: string;
  /** true si la fuente puede propagar acciones (marcar leido, papelera) al servidor. */
  readonly supportsWriteback: boolean;

  fetchRecent(options?: FetchOptions): Promise<RawMessage[]>;
  markAsRead(id: string): Promise<void>;
  moveToTrash(id: string): Promise<void>;
}

export class MailSourceError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MailSourceError';
  }
}
