import { forwardRef } from 'react';
import type { InputHTMLAttributes, ElementType } from 'react';
import { clsx } from 'clsx';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ElementType;
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, icon: Icon, className, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <div className="relative group">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
          <Icon size={18} />
        </div>
      )}
      <input
        ref={ref}
        className={clsx(
          'w-full rounded-xl py-2.5 text-sm bg-white dark:bg-white/5 border transition-all',
          'text-gray-900 dark:text-white placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
          Icon ? 'pl-11 pr-4' : 'px-4',
          error ? 'border-red-400' : 'border-gray-200 dark:border-white/10 group-focus-within:border-blue-500/50',
          className,
        )}
        {...props}
      />
    </div>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
));
