import { useApi } from '../../hooks/useApi';
import {
  Users, BookOpen, CheckCircle, Clock, TrendingUp
} from 'lucide-react';
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';

interface DashboardStats {
  totalStudents: number;
  totalLecturers: number;
  totalCourses: number;
  totalClasses: number;
  todayAttendances: number;
  pendingApprovals: number;
  recentAttendances: any[];
  last7Days: { date: string; count: number }[];
}

export function AttendanceOverviewPage() {
  const { data: stats, loading } = useApi<DashboardStats>('/attendance/dashboard-stats');

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'blue' },
    { label: 'Total Courses', value: stats.totalCourses, icon: BookOpen, color: 'purple' },
    { label: 'Today Attendances', value: stats.todayAttendances, icon: CheckCircle, color: 'green' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: Clock, color: 'orange' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">High-level summary of campus activity</p>
        </div>
        <Badge color="blue">Live Data</Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s: any) => (
          <div key={s.label} className="glass-card p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${s.color}-500/10 text-${s.color}-500`}>
              <s.icon size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Attendance Trends (Last 7 Days)
            </h2>
          </div>
          <div className="h-[300px] w-full relative">
            {stats.last7Days && stats.last7Days.length > 0 && stats.last7Days.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.last7Days}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    tickFormatter={(str: string) => format(new Date(str), 'MMM d')}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    labelFormatter={(str: any) => format(new Date(str), 'EEEE, MMM d, yyyy')}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-4">
                  <TrendingUp className="text-blue-500/50" size={32} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">No trend data available</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
                  Attendance records for the last 7 days will be visualized here once classes are conducted and students check in.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-purple-500" />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {stats.recentAttendances.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 pb-4 border-b border-gray-100 dark:border-white/5 last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400">
                  {a.user.firstName[0]}{a.user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {a.user.firstName} {a.user.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    Checked in to <span className="text-blue-500">{a.class.course.code}</span>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {format(new Date(a.checkInAt), 'h:mm a')} • {a.checkInType}
                  </p>
                </div>
              </div>
            ))}
            {stats.recentAttendances.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm italic">No recent activity detected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
