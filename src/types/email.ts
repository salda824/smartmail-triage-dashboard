/**
 * Modelo de dominio compartido entre servidor y cliente.
 */

export const CATEGORIES = [
  'JOB',
  'URGENT',
  'FINANCE',
  'NEWS',
  'INTERESTING',
  'GENERAL',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  id: Category;
  label: string;
  /** Etiqueta corta para la barra lateral cuando el espacio aprieta. */
  short: string;
  /** Clases Tailwind del punto/indicador de color. */
  dot: string;
  /** Clases del badge (fondo + texto). */
  badge: string;
  /** Clase de color de texto suelta, para iconos. */
  text: string;
  description: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  JOB: {
    id: 'JOB',
    label: 'Ofertas de Empleo',
    short: 'Empleo',
    dot: 'bg-accent-violet',
    badge: 'bg-accent-violet/12 text-accent-violet',
    text: 'text-accent-violet',
    description: 'Vacantes, practicas y procesos de seleccion',
  },
  URGENT: {
    id: 'URGENT',
    label: 'Urgente',
    short: 'Urgente',
    dot: 'bg-accent-red',
    badge: 'bg-accent-red/12 text-accent-red',
    text: 'text-accent-red',
    description: 'Requiere accion o respuesta inmediata',
  },
  FINANCE: {
    id: 'FINANCE',
    label: 'Pagos y Envios',
    short: 'Pagos',
    dot: 'bg-accent-amber',
    badge: 'bg-accent-amber/12 text-accent-amber',
    text: 'text-accent-amber',
    description: 'Facturas, compras, bancos y paqueteria',
  },
  NEWS: {
    id: 'NEWS',
    label: 'Noticias',
    short: 'Noticias',
    dot: 'bg-accent',
    badge: 'bg-accent/12 text-accent',
    text: 'text-accent',
    description: 'Newsletters y resumenes del sector',
  },
  INTERESTING: {
    id: 'INTERESTING',
    label: 'Interesantes',
    short: 'Lecturas',
    dot: 'bg-accent-cyan',
    badge: 'bg-accent-cyan/12 text-accent-cyan',
    text: 'text-accent-cyan',
    description: 'Lecturas, webinars y recursos',
  },
  GENERAL: {
    id: 'GENERAL',
    label: 'General',
    short: 'General',
    dot: 'bg-text-3',
    badge: 'bg-text-3/12 text-text-2',
    text: 'text-text-3',
    description: 'Todo lo demas',
  },
};

/** Datos estructurados que el parser extrae del cuerpo del correo. */
export interface ExtractedData {
  /** Monto normalizado, p.ej. "$50.000 COP". */
  amount?: string;
  /** Valor numerico del monto, para ordenar/sumar. */
  amountValue?: number;
  currency?: string;
  /** Fecha de vencimiento / corte / limite en ISO (YYYY-MM-DD). */
  dueDate?: string;
  /** Texto original de la fecha detectada. */
  dueDateRaw?: string;
  /** Comercio, banco o transportadora. */
  merchant?: string;
  trackingNumber?: string;
  carrier?: string;
  /** Motivo de urgencia en una linea. */
  urgencyReason?: string;
  /** Accion recomendada. */
  actionNeeded?: string;
  /** Empresa y puesto detectados en ofertas de empleo. */
  company?: string;
  role?: string;
}

export interface Email {
  id: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  dateReceived: string;
  snippet: string;
  bodyPreview: string;
  category: Category;
  /** Confianza del clasificador entre 0 y 1. */
  confidence: number;
  extractedData: ExtractedData;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fila cruda tal y como la devuelve SQLite. */
export interface EmailRow {
  id: string;
  thread_id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  date_received: string;
  snippet: string;
  body_preview: string;
  category: string;
  confidence: number;
  extracted_data: string;
  is_read: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

/** Accion en vuelo sobre un correo, para mostrar el spinner en el boton correcto. */
export type PendingAction = 'read' | 'delete' | null;

export type CategoryCounts = Record<Category, { total: number; unread: number }>;

export interface DashboardStats {
  total: number;
  unread: number;
  byCategory: CategoryCounts;
  lastSyncAt: string | null;
}

export interface SyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  source: string;
  durationMs: number;
  syncedAt: string;
  errors: string[];
}
