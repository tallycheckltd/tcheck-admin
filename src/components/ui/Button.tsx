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
        'rounded-xl font-medium transition-all duration-200 cursor-pointer disabled:opacity-50',
        {
          'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25': variant === 'primary',
          'bg-white text-slate-800 dark:bg-white/10 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 shadow-sm': variant === 'secondary',
          'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
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
