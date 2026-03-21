import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('glass-light dark:glass rounded-2xl p-6', className)}>
      {children}
    </div>
  );
}
