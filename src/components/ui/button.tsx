'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent-blue text-white shadow-glow hover:bg-blue-500 active:bg-blue-600 disabled:bg-accent-blue/50',
  secondary:
    'bg-midnight-700 text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-midnight-600 hover:text-white',
  ghost: 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100',
  danger:
    'bg-accent-coral/15 text-red-300 ring-1 ring-inset ring-accent-coral/30 hover:bg-accent-coral/25 hover:text-red-200',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
