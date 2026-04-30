import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Calendar, BookOpen, Clock, UserCheck, ArrowRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { BarChartCard } from '../../components/charts/BarChartCard';
import type { DashboardStats } from '../../types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OverviewPage() {
  const { data: stats } = useApi<DashboardStats>('/attendance/dashboard-stats');
  const { user } = useAuth();
  const navigate = useNavigate();

  const statCards = [
    { title: 'Total Students', value: stats?.totalStudents ?? 0, icon: GraduationCap, color: '#2563eb', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { title: 'Lecturers', value: stats?.totalLecturers ?? 0, icon: Users, color: '#7c3aed', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { title: 'Total Courses', value: stats?.totalCourses ?? 0, icon: BookOpen, color: '#0891b2', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { title: 'Today Check-ins', value: stats?.todayAttendances ?? 0, icon: UserCheck, color: '#059669', bg: 'bg-emerald-50 dark:bg-green-500/10' },
    { title: 'Total Classes', value: stats?.totalClasses ?? 0, icon: Calendar, color: '#ea580c', bg: 'bg-orange-50 dark:bg-orange-500/10' },
    { title: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: Clock, color: '#d97706', bg: 'bg-amber-50 dark:bg-yellow-500/10' },
  ];

  const quickActions = [
    { label: 'Manage Users', to: '/admin/users', icon: Users },
    { label: 'View Courses', to: '/courses', icon: BookOpen },
    { label: 'Attendance', to: '/attendance', icon: UserCheck },
  ];

  const weekData = stats?.attendanceByDay?.map((d) => ({
    name: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
    value: d.count,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Here's what's happening with Tcheck today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{card.value}</p>
              </div>
              <div className={`w-14 h-14 rounded-2xl ${card.bg} flex items-center justify-center shadow-inner`}>
                <card.icon size={28} style={{ color: card.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className="glass-card p-5 flex items-center justify-between cursor-pointer group hover:border-blue-500/30 transition-all shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <action.icon size={22} className="text-slate-600 dark:text-gray-400 group-hover:text-blue-500" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{action.label}</span>
            </div>
            <ArrowRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-all translate-x-0 group-hover:translate-x-1" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard title="Attendance (Last 7 Days)" data={weekData} />

        <div className="glass-card overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-transparent">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Check-ins</h3>
          </div>
          <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto flex-1">
            {stats?.recentAttendances?.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1 group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {a.user?.firstName} {a.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                      {a.class?.course?.name || 'Unknown Course'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-lg ${
                    a.checkInType === 'BLE' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' :
                    a.checkInType === 'QR' ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400' :
                    'bg-slate-100 text-slate-600 dark:bg-gray-500/10 dark:text-gray-400'
                  }`}>
                    {a.checkInType}
                  </span>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 font-mono">
                    {new Date(a.checkInAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {(!stats?.recentAttendances || stats.recentAttendances.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">No recent check-ins</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
