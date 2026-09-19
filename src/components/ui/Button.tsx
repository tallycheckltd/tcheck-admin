import type { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: Props) {
  return (
    <button
      className={clsx(
        // A flat solid fill with no press feedback read as static/unfinished — the gradient plus
        // a slight active-state press (scale down, shadow tightens) gives every primary action in
        // the app a bit of tactile presence without leaning on glow/blur effects.
        'rounded-xl font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 active:scale-[0.98]',
        {
          'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-blue-700 active:shadow-md':
            variant === 'primary',
          'bg-white text-slate-800 dark:bg-white/10 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-md':
            variant === 'secondary',
          'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/25 hover:from-red-500 hover:to-red-700': variant === 'danger',
          'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10': variant === 'ghost',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
