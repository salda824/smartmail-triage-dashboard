'use client';

import { useEffect, useState } from 'react';
import { fullDateTime, relativeTime, shortDate } from '@/lib/utils';

/**
 * Marca de tiempo relativa, segura para hidratacion.
 *
 * "hace 3 min" se calcula contra el reloj actual, asi que el servidor y el
 * cliente pueden producir textos distintos si entre el render y la hidratacion
 * cruza un minuto. En vez de silenciar el aviso, el primer render (servidor y
 * cliente por igual) pinta una fecha absoluta, que es determinista; ya montado
 * se cambia al texto relativo. Asi no hay desajuste posible.
 *
 * Ademas se refresca solo cada minuto, para que "hace 1 min" no se quede
 * congelado mientras el panel esta abierto.
 */
export function TimeAgo({
  iso,
  className,
  prefix = '',
}: {
  iso: string;
  className?: string;
  /** Texto antepuesto una vez montado, p.ej. "Sync ". */
  prefix?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(relativeTime(iso));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [iso]);

  return (
    <time dateTime={iso} title={fullDateTime(iso)} className={className}>
      {label === null ? shortDate(iso) : `${prefix}${label}`}
    </time>
  );
}
