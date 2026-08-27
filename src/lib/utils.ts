import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind resolviendo conflictos (la ultima gana). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Enlace directo al mensaje en la interfaz web de Gmail. */
export function gmailUrl(messageId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
}

/** "hace 5 min", "hace 3 h", "hace 2 d"; a partir de una semana muestra la fecha. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;

  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** Fecha y hora completas para tooltips y el sello de ultima sincronizacion. */
export function fullDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * SQLite guarda `datetime('now')` en UTC pero sin sufijo de zona; sin la `Z`
 * el navegador lo interpretaria como hora local y el sello saldria corrido.
 */
export function sqliteDateToIso(value: string | null): string | null {
  if (!value) return null;
  if (value.includes('T') || value.endsWith('Z')) return value;
  return `${value.replace(' ', 'T')}Z`;
}

/**
 * Fecha legible, con aviso cuando ya paso o esta cerca.
 *
 * `mode: 'plain'` evita el verbo "vence": la misma fecha puede ser un plazo de
 * pago o una entrega estimada, y solo quien llama sabe cual de las dos es.
 */
export function formatDueDate(
  isoDate: string,
  options: { now?: Date; mode?: 'due' | 'plain' } = {},
): { text: string; tone: 'overdue' | 'soon' | 'normal' } {
  const { now = new Date(), mode = 'due' } = options;

  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return { text: isoDate, tone: 'normal' };

  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  const days = Math.round((date.getTime() - startOfToday) / 86_400_000);

  const label = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  if (mode === 'plain') {
    if (days < 0) return { text: label, tone: 'normal' };
    if (days === 0) return { text: 'Hoy', tone: 'soon' };
    if (days === 1) return { text: 'Manana', tone: 'soon' };
    if (days <= 5) return { text: `En ${days} dias`, tone: 'normal' };
    return { text: label, tone: 'normal' };
  }

  if (days < 0) return { text: `Vencio el ${label}`, tone: 'overdue' };
  if (days === 0) return { text: 'Vence hoy', tone: 'overdue' };
  if (days === 1) return { text: 'Vence manana', tone: 'soon' };
  if (days <= 5) return { text: `Vence en ${days} dias`, tone: 'soon' };
  return { text: label, tone: 'normal' };
}

/** Iniciales del remitente para el avatar de la tarjeta. */
export function initials(name: string, email: string): string {
  const source = (name || email || '?').trim();
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Color estable derivado del remitente, para que cada contacto conserve el suyo. */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}
