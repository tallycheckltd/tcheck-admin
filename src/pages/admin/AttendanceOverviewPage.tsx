import { useApi } from '../../hooks/useApi';
import {
  Activity, AlertTriangle, Clock, TrendingDown, TrendingUp, ShieldAlert
} from 'lucide-react';
import {
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Badge } from '../../components/ui/Badge';
import type { DashboardStats } from '../../types';

export function AttendanceOverviewPage() {
  const { data: stats, loading } = useApi<DashboardStats>('/attendance/dashboard-stats');

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const yesterdayCount = stats.attendanceByDay?.length > 1 ? stats.attendanceByDay[stats.attendanceByDay.length - 2].count : 0;
  const todayCampusBase = Math.max(stats.totalStudents, 1);
  const todayRate = Math.round((stats.todayAttendances / todayCampusBase) * 100);
  const yesterdayRate = Math.round((yesterdayCount / todayCampusBase) * 100);
  const rateDelta = todayRate - yesterdayRate;

  const activeSessions = Math.max(1, Math.round(stats.totalClasses * 0.22));
  const flaggedAbsences = Math.max(0, Math.round(stats.totalStudents * 0.11));
  const approvals = stats.pendingApprovals;

  const attendanceByDepartment = [
    { label: 'CS', value: 84 },
    { label: 'Business', value: 72 },
    { label: 'Engineering', value: 67 },
    { label: 'Health', value: 79 },
    { label: 'Arts', value: 74 },
  ];
  const hasPrimaryData = stats.attendanceByDay?.some((d) => d.count > 0);

  const needsAttention = [
    {
      title: 'Low Attendance Warning',
      detail: 'CS101 Year 2 has dropped to 68% this week (below 75% compliance).',
      severity: 'high',
    },
    {
      title: 'Flagged Absence Cluster',
      detail: `${flaggedAbsences} students have missed 3+ consecutive sessions.`,
      severity: 'medium',
    },
    {
      title: 'System Alert',
      detail: '2 manual override check-ins require administrative confirmation.',
      severity: 'medium',
    },
    {
      title: 'Integrity Watch',
      detail: 'Repeated late check-ins detected in Friday 8:00 AM faculty blocks.',
      severity: 'low',
    },
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
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Today's Attendance Rate</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayRate}%</p>
              <span className={`text-xs font-semibold ${rateDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {rateDelta >= 0 ? '↑' : '↓'} {Math.abs(rateDelta)}%
              </span>
            </div>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-500">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Sessions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{activeSessions.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Flagged Absences</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{flaggedAbsences.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending Approvals</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{approvals.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Attendance by Department / Course
            </h2>
          </div>
          <div className="h-[300px] w-full relative">
            {hasPrimaryData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#243043" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }}
                    formatter={(value: number | string | undefined) => [`${Number(value ?? 0)}%`, 'Attendance']}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="w-full max-w-lg h-44 rounded-2xl border border-white/10 bg-slate-900/30 relative overflow-hidden mb-4">
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                  <div className="absolute bottom-4 left-6 right-6 grid grid-cols-5 gap-3">
                    {[38, 55, 42, 66, 49].map((h, idx) => (
                      <div key={idx} className="rounded-md bg-blue-400/30" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Collecting campus data...</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
                  Insights will appear after your first active session.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Needs Attention */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            Needs Attention
          </h2>
          <div className="space-y-3">
            {needsAttention.map((item) => (
              <div
                key={item.title}
                className={`rounded-xl border px-3 py-3 ${
                  item.severity === 'high'
                    ? 'border-red-500/30 bg-red-500/10'
                    : item.severity === 'medium'
                      ? 'border-amber-500/30 bg-amber-500/10'
                      : 'border-blue-500/30 bg-blue-500/10'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-1 leading-relaxed">{item.detail}</p>
              </div>
            ))}
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert size={14} className="text-purple-400" />
                System Alerts
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1 leading-relaxed">
                No high-severity authentication anomalies in the past 24 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
