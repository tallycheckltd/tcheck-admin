import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { 
  Search, Filter, Activity, AlertTriangle, TrendingUp
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';
import { LineChartCard } from '../../components/charts/LineChartCard';

interface ClassStat {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  course: {
    id: string;
    name: string;
    code: string;
    lecturer: { firstName: string; lastName: string };
  };
  totalEnrolled: number;
  totalCheckedIn: number;
  attendanceRate: number;
  checkInBreakdown: {
    BLE: number;
    QR: number;
    MANUAL: number;
  };
}

export function AttendanceAnalyticsPage() {
  const { data: stats, loading } = useApi<ClassStat[]>('/attendance/class-stats');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  // Extract unique courses for the dropdown
  const uniqueCourses = Array.from(new Set(stats?.map(s => s.course.code) || []));

  const filtered = stats?.filter(s => {
    const matchesSearch = !search || 
      s.course.name.toLowerCase().includes(search.toLowerCase()) ||
      s.course.code.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase());
    
    const matchesCourse = !courseFilter || s.course.code === courseFilter;
    
    return matchesSearch && matchesCourse;
  }) || [];

  // Weekly Trend Data Aggregation
  const trendData = Array.from(new Set(filtered.map((s: ClassStat) => format(new Date(s.date), 'yyyy-MM-dd'))))
    .sort()
    .map(dateStr => {
      const dayStats = filtered.filter((s: ClassStat) => format(new Date(s.date), 'yyyy-MM-dd') === dateStr);
      const avgRate = Math.round(dayStats.reduce((acc: number, s: ClassStat) => acc + s.attendanceRate, 0) / dayStats.length);
      return {
        date: format(new Date(dateStr), 'MMM d'),
        value: avgRate
      };
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detailed session-by-session performance data</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group min-w-[160px]">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer text-gray-900 dark:text-gray-100"
            >
              <option value="" className="dark:bg-zinc-950">All Courses</option>
              {uniqueCourses.map(code => (
                <option key={code} value={code} className="dark:bg-zinc-950">{code}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
              <Filter size={14} />
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LineChartCard 
            title="Attendance Trend (Filtered)" 
            data={trendData} 
            color="#3b82f6"
          />
        </div>
        <div className="glass-card p-5 flex flex-col justify-center border-blue-500/10 bg-blue-500/[0.02]">
          <TrendingUp className="text-blue-500 mb-3" size={24} />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Weekly Insight</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Overall attendance for the selected criteria is averaging 
            <span className="text-blue-600 dark:text-blue-400 font-bold ml-1">
              {trendData.length > 0 ? Math.round(trendData.reduce((acc, d) => acc + d.value, 0) / trendData.length) : 0}%
            </span>.
            {trendData.length > 1 && trendData[trendData.length-1].value > trendData[trendData.length-2].value 
              ? " Performance is trending upwards." 
              : " Keep monitoring for dips."}
          </p>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Table */}
        <div className="lg:col-span-3 glass-card overflow-hidden">
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th className="text-left py-4 px-6">Session / Course</th>
                <th className="text-left py-4 px-6">Lecturer</th>
                <th className="text-center py-4 px-6">Attendance</th>
                <th className="text-center py-4 px-6">Rate</th>
                <th className="text-right py-4 px-6">Method</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-white">{s.title}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Badge color="blue">{s.course.code}</Badge>
                        {format(new Date(s.date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-700 dark:text-gray-300">
                      {s.course.lecturer.firstName} {s.course.lecturer.lastName}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-bold text-gray-900 dark:text-white">{s.totalCheckedIn}</span>
                      <span className="text-gray-400">/ {s.totalEnrolled}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-24 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${s.attendanceRate >= 70 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${s.attendanceRate}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${s.attendanceRate >= 70 ? 'text-green-600' : 'text-red-500'}`}>
                        {s.attendanceRate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      {s.checkInBreakdown.BLE > 0 && <Badge color="purple">BLE</Badge>}
                      {s.checkInBreakdown.QR > 0 && <Badge color="yellow">QR</Badge>}
                      {s.checkInBreakdown.MANUAL > 0 && <Badge color="gray">M</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <Activity size={40} className="mx-auto mb-3 opacity-20" />
                    No session data matches your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sidebar Insights */}
        <div className="space-y-6">
          <div className="glass-card p-5 bg-red-500/5 border-red-500/10">
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertTriangle size={16} />
              At-Risk Sessions
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              Sessions with less than 70% attendance require attention.
            </p>
            <div className="space-y-3">
              {stats?.filter((s: ClassStat) => s.attendanceRate < 70).slice(0, 5).map((s: ClassStat) => (
                <div key={s.id} className="p-3 rounded-xl bg-white dark:bg-white/5 border border-red-200 dark:border-red-900/30">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate pr-2">{s.course.code}</span>
                    <span className="text-xs font-bold text-red-500">{s.attendanceRate}%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{s.title}</p>
                </div>
              ))}
              {stats?.filter((s: ClassStat) => s.attendanceRate < 70).length === 0 && (
                <p className="text-center text-xs text-green-600 dark:text-green-400 italic py-4">
                  All sessions above threshold!
                </p>
              )}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Method Breakdown</h3>
            <div className="space-y-4">
              {[
                { label: 'BLE Proximity', key: 'BLE', color: '#6366f1' },
                { label: 'QR Scan', key: 'QR', color: '#f97316' },
                { label: 'Manual Entry', key: 'MANUAL', color: '#64748b' },
              ].map(method => {
                const total = stats?.reduce((acc: number, s: ClassStat) => acc + (s.checkInBreakdown[method.key as keyof typeof s.checkInBreakdown] || 0), 0) || 0;
                const grandTotal = stats?.reduce((acc: number, s: ClassStat) => acc + s.totalCheckedIn, 0) || 1;
                const pct = Math.round((total / grandTotal) * 100);
                return (
                  <div key={method.key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">{method.label}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: method.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
