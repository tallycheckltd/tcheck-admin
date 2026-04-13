import { clsx } from 'clsx';

const colors = {
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-green-500/20 dark:text-green-400 dark:ring-0',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-600/10 dark:bg-red-500/20 dark:text-red-400 dark:ring-0',
  yellow: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10 dark:bg-yellow-500/20 dark:text-yellow-400 dark:ring-0',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10 dark:bg-blue-500/20 dark:text-blue-400 dark:ring-0',
  gray: 'bg-slate-100 text-slate-700 ring-1 ring-slate-400/25 dark:bg-gray-500/20 dark:text-slate-400 dark:ring-0',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/10 dark:bg-purple-500/20 dark:text-purple-400 dark:ring-0',
};

export function Badge({ children, color = 'blue' }: { children: React.ReactNode; color?: keyof typeof colors }) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colors[color])}>
      {children}
    </span>
  );
}
