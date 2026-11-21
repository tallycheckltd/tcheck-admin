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
        // 2026-11-21: the same pill buttons as tallycheck.co.ke — TallyCheck blue (#004aad), fully
        // rounded, a light lift on hover and a slight press. inline-flex keeps an icon and its label
        // on one line.
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold tracking-[-0.005em] transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004aad]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
        {
          'bg-[#004aad] text-white shadow-[0_8px_20px_-8px_rgba(0,74,173,0.55)] hover:bg-[#003a8c] hover:shadow-[0_10px_24px_-8px_rgba(0,74,173,0.65)] dark:bg-blue-500 dark:hover:bg-blue-400':
            variant === 'primary',
          'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 dark:bg-white/[0.06] dark:text-white dark:border-white/20 dark:hover:bg-white/[0.12]':
            variant === 'secondary',
          'bg-rose-600 text-white shadow-[0_8px_20px_-8px_rgba(225,29,72,0.5)] hover:bg-rose-700': variant === 'danger',
          'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10': variant === 'ghost',
          'px-3.5 py-1.5 text-sm': size === 'sm',
          'px-5 py-2 text-sm': size === 'md',
          'px-7 py-3 text-base': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
