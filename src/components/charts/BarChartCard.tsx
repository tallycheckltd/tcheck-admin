import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/GlassCard';

interface Props {
  title: string;
  data: { name: string; value: number }[];
  color?: string;
}

export function BarChartCard({ title, data, color = '#3B82F6' }: Props) {
  return (
    <GlassCard>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#888" />
          <YAxis tick={{ fontSize: 12 }} stroke="#888" />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
