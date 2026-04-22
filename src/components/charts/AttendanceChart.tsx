import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

interface Props {
  data: { name: string; value: number }[];
  size?: number;
}

export function AttendanceDonut({ data, size = 200 }: Props) {
  const hasData = data.length > 0 && data.some(d => d.value > 0);

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {hasData ? (
        <ResponsiveContainer width={size} height={size}>
          <PieChart>
            <Pie data={data} innerRadius={size * 0.3} outerRadius={size * 0.4} paddingAngle={4} dataKey="value">
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(128,128,128,0.1)',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-2">
            <PieIcon className="text-gray-400" size={20} />
          </div>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 px-4 leading-tight">No distribution data</p>
        </div>
      )}
    </div>
  );
}
