'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'emerald' | 'coral' | 'blue';

const TONES: Record<Tone, string> = {
  neutral: 'text-slate-400 hover:bg-white/10 hover:text-slate-100',
  emerald: 'text-slate-400 hover:bg-accent-emerald/15 hover:text-emerald-300',
  coral: 'text-slate-400 hover:bg-accent-coral/15 hover:text-red-300',
  blue: 'text-slate-400 hover:bg-accent-blue/15 hover:text-blue-300',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  /** Obligatorio: el boton solo muestra un icono, sin texto visible. */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { tone = 'neutral', label, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
