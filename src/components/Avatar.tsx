import { avatarHue, cn, initials } from '@/lib/utils';

/**
 * Avatar generado del remitente: mismo remitente, mismo color, siempre.
 *
 * El color se expresa como un tono con opacidad baja de fondo y el mismo tono
 * saturado en el texto. Asi funciona igual en tema claro y oscuro sin necesidad
 * de dos juegos de valores.
 */
export function Avatar({
  name,
  email,
  size = 'md',
  className,
}: {
  name: string;
  email: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const hue = avatarHue(email || name);

  const sizes = {
    sm: 'h-6 w-6 rounded-md text-[9px]',
    md: 'h-7 w-7 rounded-md text-[10px]',
    lg: 'h-9 w-9 rounded-lg text-xs',
  } as const;

  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold uppercase',
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 55% 50% / 0.16)`,
        color: `hsl(${hue} 55% 55%)`,
      }}
    >
      {initials(name, email)}
    </div>
  );
}
