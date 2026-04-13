import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-slate-800 dark:text-gray-300">{label}</label>}
    <input
      ref={ref}
      className={clsx(
        'w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border transition-colors',
        'text-gray-900 dark:text-white placeholder-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        error ? 'border-red-400' : 'border-gray-200 dark:border-white/10',
        className,
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
