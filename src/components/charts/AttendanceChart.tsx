import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

interface Props {
  data: { name: string; value: number }[];
  size?: number;
}

export function AttendanceDonut({ data, size = 200 }: Props) {
  return (
    <ResponsiveContainer width={size} height={size}>
      <PieChart>
        <Pie data={data} innerRadius={size * 0.3} outerRadius={size * 0.4} paddingAngle={4} dataKey="value">
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
