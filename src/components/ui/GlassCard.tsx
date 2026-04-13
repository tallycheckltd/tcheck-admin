import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('glass-light dark:glass rounded-2xl p-6 text-slate-900 dark:text-inherit', className)}>
      {children}
    </div>
  );
}
