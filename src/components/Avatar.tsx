import { avatarHue, initials } from '@/lib/utils';
import { cn } from '@/lib/utils';

/** Avatar generado del remitente: mismo remitente, mismo color, siempre. */
export function Avatar({
  name,
  email,
  size = 'md',
  className,
}: {
  name: string;
  email: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const hue = avatarHue(email || name);

  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg font-semibold ring-1 ring-inset ring-white/10',
        size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs',
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 55% 22%)`,
        color: `hsl(${hue} 85% 78%)`,
      }}
    >
      {initials(name, email)}
    </div>
  );
}
