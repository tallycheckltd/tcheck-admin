import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Calendar, BookOpen, Clock, UserCheck, ArrowRight, School, LifeBuoy, Smartphone } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { BarChartCard } from '../../components/charts/BarChartCard';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import type { DashboardStats, SchoolStats } from '../../types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const DASHBOARD_REFRESH_MS = 30_000;

export function OverviewPage() {
  const { data: stats } = useApi<DashboardStats>('/attendance/dashboard-stats', {
    refetchIntervalMs: DASHBOARD_REFRESH_MS,
    refetchWhenVisible: true,
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: schoolStats } = useApi<SchoolStats[]>(isSuperAdmin ? '/schools/stats' : null, {
    refetchIntervalMs: DASHBOARD_REFRESH_MS,
    refetchWhenVisible: true,
  });

  const statCards = [
    { title: 'Total Students', value: stats?.totalStudents ?? 0, icon: GraduationCap, color: 'blue' as const },
    { title: 'Lecturers', value: stats?.totalLecturers ?? 0, icon: Users, color: 'purple' as const },
    { title: 'Total Courses', value: stats?.totalCourses ?? 0, icon: BookOpen, color: 'cyan' as const },
    { title: 'Today Check-ins', value: stats?.todayAttendances ?? 0, icon: UserCheck, color: 'green' as const },
    { title: 'Total Classes', value: stats?.totalClasses ?? 0, icon: Calendar, color: 'orange' as const },
    { title: 'Pending Approvals', value: stats?.pendingApprovals ?? 0, icon: Clock, color: 'amber' as const },
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

      {/* Platform-wide cross-school breakdown — SUPER_ADMIN only, so a multi-tenant deployment
          isn't just one flattened number. Each row links into that school's own overview via the
          same filters the rest of the dashboard already understands. */}
      {isSuperAdmin && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <School size={18} className="text-blue-500" /> Schools on the Platform
            </h3>
            <Badge color="blue">{schoolStats?.length ?? 0} schools</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm gradient-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Students</th>
                  <th>Lecturers</th>
                  <th>Courses</th>
                  <th>Today's Check-ins</th>
                  <th>Pending Approvals</th>
                  <th>Device Requests</th>
                  <th>Open Tickets</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {schoolStats?.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="font-medium text-gray-900 dark:text-white">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        {s.name}
                        <span className="text-xs text-gray-400 font-mono">{s.code}</span>
                      </span>
                    </td>
                    <td>{s.totalStudents}</td>
                    <td>{s.totalLecturers}</td>
                    <td>{s.totalCourses}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <UserCheck size={13} /> {s.todayCheckins}
                      </span>
                    </td>
                    <td>{s.pendingApprovals > 0 ? <Badge color="yellow">{s.pendingApprovals}</Badge> : <span className="text-gray-400">0</span>}</td>
                    <td>
                      {s.pendingDeviceRequests > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Smartphone size={13} /> {s.pendingDeviceRequests}
                        </span>
                      ) : <span className="text-gray-400">0</span>}
                    </td>
                    <td>
                      {s.openTickets > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                          <LifeBuoy size={13} /> {s.openTickets}
                        </span>
                      ) : <span className="text-gray-400">0</span>}
                    </td>
                  </tr>
                ))}
                {(!schoolStats || schoolStats.length === 0) && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">No schools yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            color={card.color}
            icon={<card.icon size={24} />}
          />
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
