import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/GlassCard';
import { TrendingUp } from 'lucide-react';

interface Props {
  title: string;
  data: { date: string; value: number }[];
  color?: string;
}

export function LineChartCard({ title, data, color = '#3B82F6' }: Props) {
  const hasData = data.length > 0 && data.some(d => d.value > 0);

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      <div className="h-[250px] w-full relative">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                stroke="#888" 
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                stroke="#888" 
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: 'none', 
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#fff'
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                strokeWidth={3}
                dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <TrendingUp className="text-gray-400" size={24} />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No trend data available</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Trends will appear as more classes are completed.</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
