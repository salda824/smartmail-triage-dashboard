/**
 * Modelo de dominio compartido entre servidor y cliente.
 */

export const CATEGORIES = [
  'JOB',
  'URGENT',
  'FINANCE',
  'NEWS',
  'INTERESTING',
  'PROMO',
  'GENERAL',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Nombre del icono de lucide-react que representa la categoria. */
export type CategoryIcon =
  | 'briefcase'
  | 'alert'
  | 'card'
  | 'news'
  | 'bulb'
  | 'tag'
  | 'package';

export interface CategoryMeta {
  id: Category;
  label: string;
  /** Etiqueta corta para la barra lateral cuando el espacio aprieta. */
  short: string;
  icon: CategoryIcon;
  /** Clases Tailwind del punto/indicador de color. */
  dot: string;
  /** Clases del badge (fondo + texto). */
  badge: string;
  /** Clase de color de texto suelta, para iconos. */
  text: string;
  /** Fondo tenue + borde, para el recuadro de datos extraidos. */
  panel: string;
  /** Fondo del icono en la pastilla de categoria. */
  chip: string;
  description: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  JOB: {
    id: 'JOB',
    label: 'Ofertas de Empleo',
    short: 'Empleo',
    icon: 'briefcase',
    dot: 'bg-accent-violet',
    badge: 'bg-accent-violet/12 text-accent-violet',
    text: 'text-accent-violet',
    panel: 'border-accent-violet/20 bg-accent-violet/[0.07]',
    chip: 'bg-accent-violet/12 text-accent-violet ring-accent-violet/25',
    description: 'Vacantes, practicas y procesos de seleccion',
  },
  URGENT: {
    id: 'URGENT',
    label: 'Urgente',
    short: 'Urgente',
    icon: 'alert',
    dot: 'bg-accent-red',
    badge: 'bg-accent-red/12 text-accent-red',
    text: 'text-accent-red',
    panel: 'border-accent-red/20 bg-accent-red/[0.07]',
    chip: 'bg-accent-red/12 text-accent-red ring-accent-red/25',
    description: 'Requiere accion o respuesta inmediata',
  },
  FINANCE: {
    id: 'FINANCE',
    label: 'Pagos y Envios',
    short: 'Pagos',
    icon: 'card',
    dot: 'bg-accent-amber',
    badge: 'bg-accent-amber/12 text-accent-amber',
    text: 'text-accent-amber',
    panel: 'border-accent-amber/20 bg-accent-amber/[0.07]',
    chip: 'bg-accent-amber/12 text-accent-amber ring-accent-amber/25',
    description: 'Facturas, compras, bancos y paqueteria',
  },
  NEWS: {
    id: 'NEWS',
    label: 'Noticias',
    short: 'Noticias',
    icon: 'news',
    dot: 'bg-accent',
    badge: 'bg-accent/12 text-accent',
    text: 'text-accent',
    panel: 'border-accent/20 bg-accent/[0.07]',
    chip: 'bg-accent/12 text-accent ring-accent/25',
    description: 'Newsletters y resumenes del sector',
  },
  INTERESTING: {
    id: 'INTERESTING',
    label: 'Interesantes',
    short: 'Lecturas',
    icon: 'bulb',
    dot: 'bg-accent-cyan',
    badge: 'bg-accent-cyan/12 text-accent-cyan',
    text: 'text-accent-cyan',
    panel: 'border-accent-cyan/20 bg-accent-cyan/[0.07]',
    chip: 'bg-accent-cyan/12 text-accent-cyan ring-accent-cyan/25',
    description: 'Lecturas, webinars y recursos',
  },
  PROMO: {
    id: 'PROMO',
    label: 'Promociones',
    short: 'Promos',
    icon: 'tag',
    dot: 'bg-accent-pink',
    badge: 'bg-accent-pink/12 text-accent-pink',
    text: 'text-accent-pink',
    panel: 'border-accent-pink/20 bg-accent-pink/[0.07]',
    chip: 'bg-accent-pink/12 text-accent-pink ring-accent-pink/25',
    description: 'Descuentos, ofertas y marketing de tiendas',
  },
  GENERAL: {
    id: 'GENERAL',
    label: 'General',
    short: 'General',
    icon: 'package',
    dot: 'bg-text-3',
    badge: 'bg-text-3/12 text-text-2',
    text: 'text-text-3',
    panel: 'border-line bg-surface-2',
    chip: 'bg-text-3/12 text-text-2 ring-line-strong',
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
