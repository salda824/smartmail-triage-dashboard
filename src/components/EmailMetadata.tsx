import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarClock,
  Package,
  Store,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatDueDate } from '@/lib/utils';
import type { Category, ExtractedData } from '@/types/email';

/**
 * Datos extraidos del correo.
 *
 * Un campo vacio no se renderiza: la ausencia de dato nunca debe leerse como un
 * dato en blanco. `MetaChips` va en la lista, `MetaPanel` en el panel de lectura.
 */

/** Un envio trae guia o transportadora; su fecha es una entrega, no un plazo de pago. */
function isShipment(data: ExtractedData): boolean {
  return Boolean(data.trackingNumber || data.carrier);
}

function dueOf(data: ExtractedData) {
  if (!data.dueDate) return null;
  return formatDueDate(data.dueDate, { mode: isShipment(data) ? 'plain' : 'due' });
}

// ---------------------------------------------------------------------------
// Chips compactos (lista)
// ---------------------------------------------------------------------------

export function MetaChips({ category, data }: { category: Category; data: ExtractedData }) {
  const due = dueOf(data);
  const chips: React.ReactNode[] = [];

  if (data.amount) {
    chips.push(
      <Badge key="amount" tone="bg-accent-amber/12 text-accent-amber">
        <Banknote size={10} />
        {data.amount}
      </Badge>,
    );
  }

  if (due) {
    chips.push(
      <Badge
        key="due"
        tone={
          due.tone === 'overdue'
            ? 'bg-accent-red/12 text-accent-red'
            : due.tone === 'soon'
              ? 'bg-accent-amber/12 text-accent-amber'
              : undefined
        }
      >
        <CalendarClock size={10} />
        {due.text}
      </Badge>,
    );
  }

  if (data.trackingNumber) {
    chips.push(
      <Badge key="track" tone="bg-accent-cyan/12 text-accent-cyan">
        <Package size={10} />
        {data.trackingNumber}
      </Badge>,
    );
  }

  if (category === 'URGENT' && data.urgencyReason) {
    chips.push(
      <Badge key="urgency" tone="bg-accent-red/12 text-accent-red" className="max-w-[18rem]">
        <AlertTriangle size={10} />
        <span className="truncate">{data.urgencyReason}</span>
      </Badge>,
    );
  }

  if (category === 'JOB' && data.role) {
    chips.push(
      <Badge key="role" tone="bg-accent-violet/12 text-accent-violet">
        <Briefcase size={10} />
        {data.role}
      </Badge>,
    );
  }

  if (chips.length === 0) return null;
  return <div className="flex min-w-0 flex-wrap items-center gap-1">{chips}</div>;
}

// ---------------------------------------------------------------------------
// Panel detallado (vista de lectura)
// ---------------------------------------------------------------------------

function Field({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-[3px] shrink-0 text-text-3">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xs uppercase tracking-wide text-text-3">{label}</div>
        <div className={cn('text-[13px] font-medium', tone ?? 'text-text')}>{value}</div>
      </div>
    </div>
  );
}

export function MetaPanel({ category, data }: { category: Category; data: ExtractedData }) {
  const due = dueOf(data);
  const shipment = isShipment(data);

  const fields: React.ReactNode[] = [];

  if (category === 'URGENT') {
    if (data.urgencyReason) {
      fields.push(
        <Field
          key="reason"
          icon={<AlertTriangle size={13} />}
          label="Motivo"
          value={data.urgencyReason}
          tone="text-accent-red"
        />,
      );
    }
    if (data.actionNeeded) {
      fields.push(
        <Field
          key="action"
          icon={<ArrowRight size={13} />}
          label="Accion recomendada"
          value={data.actionNeeded}
        />,
      );
    }
  }

  if (data.amount) {
    fields.push(
      <Field
        key="amount"
        icon={<Banknote size={13} />}
        label="Monto"
        value={data.amount}
        tone="text-accent-amber"
      />,
    );
  }

  if (due) {
    fields.push(
      <Field
        key="due"
        icon={<CalendarClock size={13} />}
        label={shipment ? 'Entrega estimada' : category === 'JOB' ? 'Fecha clave' : 'Vencimiento'}
        value={due.text}
        tone={
          !shipment && due.tone === 'overdue'
            ? 'text-accent-red'
            : !shipment && due.tone === 'soon'
              ? 'text-accent-amber'
              : undefined
        }
      />,
    );
  }

  if (data.role) {
    fields.push(
      <Field key="role" icon={<Briefcase size={13} />} label="Cargo" value={data.role} />,
    );
  }

  const org = data.company ?? (data.merchant !== data.carrier ? data.merchant : undefined);
  if (org) {
    fields.push(
      <Field
        key="org"
        icon={<Store size={13} />}
        label={category === 'JOB' ? 'Empresa' : 'Comercio'}
        value={org}
      />,
    );
  }

  if (data.carrier) {
    fields.push(
      <Field key="carrier" icon={<Truck size={13} />} label="Transportadora" value={data.carrier} />,
    );
  }

  if (data.trackingNumber) {
    fields.push(
      <Field
        key="track"
        icon={<Package size={13} />}
        label="Guia / rastreo"
        value={data.trackingNumber}
      />,
    );
  }

  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line bg-surface-2 p-3.5">
      {fields}
    </div>
  );
}
