import type { ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  color?: string;
}

export function StatCard({ title, value, icon, trend, color = 'blue' }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-500">{title}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
            {trend && <p className="mt-1 text-sm text-green-500">{trend}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-${color}-500/10`}>
            {icon}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
