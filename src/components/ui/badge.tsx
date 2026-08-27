import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'blue' | 'violet' | 'orange' | 'coral' | 'emerald' | 'cyan' | 'outline';

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-slate-500/15 text-slate-300 ring-slate-400/25',
  blue: 'bg-accent-blue/15 text-blue-300 ring-accent-blue/30',
  violet: 'bg-accent-violet/15 text-violet-300 ring-accent-violet/30',
  orange: 'bg-accent-orange/15 text-orange-300 ring-accent-orange/30',
  coral: 'bg-accent-coral/15 text-red-300 ring-accent-coral/30',
  emerald: 'bg-accent-emerald/15 text-emerald-300 ring-accent-emerald/30',
  cyan: 'bg-accent-cyan/15 text-cyan-300 ring-accent-cyan/30',
  outline: 'bg-transparent text-slate-400 ring-white/15',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-5 ring-1 ring-inset',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
