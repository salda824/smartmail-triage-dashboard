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
  emoji: string;
  /** Clases Tailwind para el badge de la categoria. */
  badge: string;
  /** Color del borde/acento de la tarjeta. */
  accent: string;
  /** Color hexadecimal plano, util para graficos o estilos inline. */
  hex: string;
  description: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  JOB: {
    id: 'JOB',
    label: 'Ofertas de Empleo',
    emoji: '\u{1F4BC}',
    badge: 'bg-accent-violet/15 text-violet-300 ring-1 ring-inset ring-accent-violet/30',
    accent: 'border-l-accent-violet',
    hex: '#8B5CF6',
    description: 'Vacantes, practicas y procesos de seleccion',
  },
  URGENT: {
    id: 'URGENT',
    label: 'Urgente',
    emoji: '\u{1F6A8}',
    badge: 'bg-accent-coral/15 text-red-300 ring-1 ring-inset ring-accent-coral/30',
    accent: 'border-l-accent-coral',
    hex: '#EF4444',
    description: 'Requiere accion o respuesta inmediata',
  },
  FINANCE: {
    id: 'FINANCE',
    label: 'Pagos y Envios',
    emoji: '\u{1F4B3}',
    badge: 'bg-accent-orange/15 text-orange-300 ring-1 ring-inset ring-accent-orange/30',
    accent: 'border-l-accent-orange',
    hex: '#F97316',
    description: 'Facturas, compras, bancos y paqueteria',
  },
  NEWS: {
    id: 'NEWS',
    label: 'Noticias',
    emoji: '\u{1F4F0}',
    badge: 'bg-accent-blue/15 text-blue-300 ring-1 ring-inset ring-accent-blue/30',
    accent: 'border-l-accent-blue',
    hex: '#3B82F6',
    description: 'Newsletters y resumenes del sector',
  },
  INTERESTING: {
    id: 'INTERESTING',
    label: 'Interesantes',
    emoji: '\u{1F4A1}',
    badge: 'bg-accent-cyan/15 text-cyan-300 ring-1 ring-inset ring-accent-cyan/30',
    accent: 'border-l-accent-cyan',
    hex: '#06B6D4',
    description: 'Lecturas, webinars y recursos',
  },
  GENERAL: {
    id: 'GENERAL',
    label: 'General',
    emoji: '\u{1F4E6}',
    badge: 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-400/25',
    accent: 'border-l-slate-500',
    hex: '#64748B',
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
