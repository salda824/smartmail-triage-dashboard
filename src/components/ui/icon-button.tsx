'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'green' | 'red' | 'accent';
type Size = 'sm' | 'md';

const TONES: Record<Tone, string> = {
  neutral: 'text-text-3 hover:bg-surface-3 hover:text-text',
  green: 'text-text-3 hover:bg-accent-green/12 hover:text-accent-green',
  red: 'text-text-3 hover:bg-accent-red/12 hover:text-accent-red',
  accent: 'text-text-3 hover:bg-accent/12 hover:text-accent',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 w-7 rounded-md',
  md: 'h-8 w-8 rounded-lg',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  /** Obligatorio: el boton solo muestra un icono, sin texto visible. */
  label: string;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { tone = 'neutral', size = 'md', label, active, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        TONES[tone],
        SIZES[size],
        active && 'bg-surface-3 text-text',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
