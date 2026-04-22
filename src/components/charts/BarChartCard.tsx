import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/GlassCard';
import { BarChart3 } from 'lucide-react';

interface Props {
  title: string;
  data: { name: string; value: number }[];
  color?: string;
}

export function BarChartCard({ title, data, color = '#3B82F6' }: Props) {
  const hasData = data.length > 0 && data.some(d => d.value > 0);

  return (
    <GlassCard>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      
      <div className="h-[250px] w-full relative">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }} 
                stroke="#888" 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                stroke="#888" 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(128,128,128,0.05)' }}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(128,128,128,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <BarChart3 className="text-gray-400" size={24} />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No attendance data yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Check-ins will appear here once students start signing in.</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
