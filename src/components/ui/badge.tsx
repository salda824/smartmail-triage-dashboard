import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Clases de color; normalmente vienen de CATEGORY_META.badge. */
  tone?: string;
}

export function Badge({ tone, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium leading-4',
        tone ?? 'bg-surface-3 text-text-2',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Punto de color de 6px, para indicar categoria sin ocupar espacio. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', className)} />;
}
