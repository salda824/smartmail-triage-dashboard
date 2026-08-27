import {
  AlertTriangle,
  ArrowRightCircle,
  Banknote,
  Briefcase,
  CalendarClock,
  Package,
  Store,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDueDate } from '@/lib/utils';
import type { Category, ExtractedData } from '@/types/email';

/**
 * Datos extraidos del correo.
 *
 * Cada categoria muestra solo lo que le importa: montos y guias en finanzas,
 * motivo y accion en urgentes. Un campo vacio no se renderiza, para que la
 * ausencia de dato nunca se lea como un dato en blanco.
 */

interface Props {
  category: Category;
  data: ExtractedData;
  /** `compact` se usa en la vista de lista, donde solo cabe una linea. */
  variant?: 'card' | 'compact';
}

function Field({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'money' | 'overdue' | 'soon';
}) {
  const valueTone =
    tone === 'money'
      ? 'text-orange-200'
      : tone === 'overdue'
        ? 'text-red-300'
        : tone === 'soon'
          ? 'text-orange-300'
          : 'text-slate-200';

  return (
    <div className="flex items-start gap-2">
      <span className="mt-[3px] shrink-0 text-slate-500">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`truncate text-xs font-medium ${valueTone}`}>{value}</div>
      </div>
    </div>
  );
}

export function EmailMetadata({ category, data, variant = 'card' }: Props) {
  // Un correo con guia es un envio: su fecha es una entrega, no un plazo de pago.
  const isShipment = Boolean(data.trackingNumber || data.carrier);
  const due = data.dueDate
    ? formatDueDate(data.dueDate, { mode: isShipment ? 'plain' : 'due' })
    : null;

  if (variant === 'compact') {
    const chips: React.ReactNode[] = [];

    if (data.amount) {
      chips.push(
        <Badge key="amount" variant="orange">
          <Banknote size={11} />
          {data.amount}
        </Badge>,
      );
    }
    if (due) {
      chips.push(
        <Badge key="due" variant={due.tone === 'overdue' ? 'coral' : due.tone === 'soon' ? 'orange' : 'outline'}>
          <CalendarClock size={11} />
          {due.text}
        </Badge>,
      );
    }
    if (data.trackingNumber) {
      chips.push(
        <Badge key="tracking" variant="cyan">
          <Package size={11} />
          {data.trackingNumber}
        </Badge>,
      );
    }
    if (category === 'URGENT' && data.urgencyReason) {
      chips.push(
        <Badge key="urgency" variant="coral" className="max-w-[22rem]">
          <AlertTriangle size={11} />
          <span className="truncate">{data.urgencyReason}</span>
        </Badge>,
      );
    }
    if (category === 'JOB' && data.role) {
      chips.push(
        <Badge key="role" variant="violet">
          <Briefcase size={11} />
          {data.role}
        </Badge>,
      );
    }

    if (chips.length === 0) return null;
    return <div className="flex flex-wrap items-center gap-1.5">{chips}</div>;
  }

  // --- Vista de tarjeta ---------------------------------------------------

  if (category === 'URGENT') {
    if (!data.urgencyReason && !data.actionNeeded && !due) return null;
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-accent-coral/20 bg-accent-coral/[0.06] p-3">
        {data.urgencyReason && (
          <Field
            icon={<AlertTriangle size={13} />}
            label="Motivo"
            value={data.urgencyReason}
          />
        )}
        {data.actionNeeded && (
          <Field
            icon={<ArrowRightCircle size={13} />}
            label="Accion recomendada"
            value={data.actionNeeded}
          />
        )}
        {due && (
          <Field
            icon={<CalendarClock size={13} />}
            label="Fecha limite"
            value={due.text}
            tone={due.tone === 'normal' ? 'default' : due.tone}
          />
        )}
      </div>
    );
  }

  if (category === 'FINANCE') {
    const hasAny =
      data.amount || due || data.trackingNumber || data.carrier || data.merchant;
    if (!hasAny) return null;

    // Cuando el comercio y la transportadora son el mismo (Servientrega
    // notificando su propio envio) no tiene sentido mostrarlo dos veces.
    const showMerchant = data.merchant && data.merchant !== data.carrier;

    return (
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-accent-orange/20 bg-accent-orange/[0.06] p-3">
        {data.amount && (
          <Field icon={<Banknote size={13} />} label="Monto" value={data.amount} tone="money" />
        )}
        {due && (
          <Field
            icon={<CalendarClock size={13} />}
            label={isShipment ? 'Entrega estimada' : 'Vencimiento'}
            value={due.text}
            tone={isShipment || due.tone === 'normal' ? 'default' : due.tone}
          />
        )}
        {showMerchant && (
          <Field icon={<Store size={13} />} label="Comercio" value={data.merchant!} />
        )}
        {data.carrier && (
          <Field icon={<Truck size={13} />} label="Transportadora" value={data.carrier} />
        )}
        {data.trackingNumber && (
          <Field
            icon={<Package size={13} />}
            label="Guia / rastreo"
            value={data.trackingNumber}
          />
        )}
      </div>
    );
  }

  if (category === 'JOB') {
    if (!data.role && !data.company && !due) return null;
    return (
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-accent-violet/20 bg-accent-violet/[0.06] p-3">
        {data.role && <Field icon={<Briefcase size={13} />} label="Cargo" value={data.role} />}
        {data.company && <Field icon={<Store size={13} />} label="Empresa" value={data.company} />}
        {due && (
          <Field
            icon={<CalendarClock size={13} />}
            label="Fecha clave"
            value={due.text}
            tone={due.tone === 'normal' ? 'default' : due.tone}
          />
        )}
      </div>
    );
  }

  if (due) {
    return (
      <div className="mt-3">
        <Badge variant={due.tone === 'overdue' ? 'coral' : due.tone === 'soon' ? 'orange' : 'outline'}>
          <CalendarClock size={11} />
          {due.text}
        </Badge>
      </div>
    );
  }

  return null;
}
