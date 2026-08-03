import type { ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { motion } from 'framer-motion';

// Static class map — Tailwind's JIT scanner can't see dynamically-interpolated class names like
// `bg-${color}-500/10`, so those never get generated and the icon box silently has no background.
const iconColors = {
  blue: 'bg-blue-500/10 text-blue-500',
  green: 'bg-green-500/10 text-green-500',
  red: 'bg-red-500/10 text-red-500',
  amber: 'bg-amber-500/10 text-amber-500',
  purple: 'bg-purple-500/10 text-purple-500',
  cyan: 'bg-cyan-500/10 text-cyan-500',
  orange: 'bg-orange-500/10 text-orange-500',
};

interface Props {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  color?: keyof typeof iconColors;
  /** compact: for dense stat-row layouts (p-4, small icon box). default: full-size card. */
  size?: 'compact' | 'default';
}

export function StatCard({ title, value, icon, trend, color = 'blue', size = 'default' }: Props) {
  const compact = size === 'compact';
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className={compact ? '!p-4' : undefined}>
        <div className={`flex items-center justify-between ${compact ? '' : 'items-start'}`}>
          <div className={compact ? 'flex items-center gap-3' : undefined}>
            {compact && (
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors[color]}`}>
                {icon}
              </div>
            )}
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-500">{title}</p>
              <p className={`${compact ? 'text-lg' : 'mt-1 text-3xl'} font-bold text-slate-900 dark:text-white leading-tight`}>{value}</p>
              {trend && <p className="mt-1 text-sm text-green-500">{trend}</p>}
            </div>
          </div>
          {!compact && (
            <div className={`p-3 rounded-xl ${iconColors[color]}`}>
              {icon}
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
