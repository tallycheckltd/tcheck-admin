import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Users, GraduationCap, Calendar, BookOpen, Clock, UserCheck, ArrowRight, School, LifeBuoy, Smartphone, Percent, ShieldAlert, Radar, TrendingDown, Activity, Building2, Globe2, Sparkles, Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { BarChartCard } from '../../components/charts/BarChartCard';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import type { DashboardStats, ExecutiveSummary, SchoolStats } from '../../types';
import { formatCheckInType } from '../../utils/checkInTypeLabel';

/** §18.4 — VC/DVC see institutional macro-analytics instead of the operational widgets below
 * (Total Classes, Recent Check-ins, etc.), which assume day-to-day classroom involvement. */
function ExecutiveOverview({ user, greeting }: { user: { firstName: string } | null | undefined; greeting: string }) {
  const { data: exec } = useApi<ExecutiveSummary>('/attendance/executive-summary', {
    refetchIntervalMs: DASHBOARD_REFRESH_MS,
    refetchWhenVisible: true,
  });

  const cards = [
    {
      title: 'Campus-Wide Attendance Rate',
      value: `${exec?.campusAttendanceRate ?? 0}%`,
      hint: exec?.activeTermName ? `Active term: ${exec.activeTermName}` : 'No active term set',
      icon: Percent,
      color: 'blue' as const,
    },
    {
      title: 'Total Biometric Flags',
      value: exec?.totalBiometricFlags ?? 0,
      hint: 'AI spoofing/fraud attempts blocked',
      icon: ShieldAlert,
      color: 'red' as const,
    },
    {
      title: 'Hardware Health',
      value: `${exec?.hardwareHealthPct ?? 0}%`,
      hint: `${exec?.beaconsOnline ?? 0} of ${exec?.beaconsTotal ?? 0} beacons online`,
      icon: Radar,
      color: 'green' as const,
    },
    {
      title: 'Performance Delta',
      value: exec?.lowestPerformingFaculty ? `${exec.lowestPerformingFaculty.attendanceRate}%` : '—',
      hint: exec?.lowestPerformingFaculty
        ? `Lowest: ${exec.lowestPerformingFaculty.name}`
        : 'No faculty assigned to courses yet',
      icon: TrendingDown,
      color: 'orange' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}, {user?.firstName}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Institutional overview across the university</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <StatCard key={card.title} title={card.title} value={card.value} color={card.color} icon={<card.icon size={24} />} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 -mt-2">
        {cards.map((card) => (
          <p key={card.title} className="text-xs text-gray-500 dark:text-gray-400 px-1">{card.hint}</p>
        ))}
      </div>
    </div>
  );
}

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

  // §18.4 — no hooks below this point, so bailing out here for VC/DVC never changes hook order.
  if (user?.role === 'VC' || user?.role === 'DVC') {
    return <ExecutiveOverview user={user} greeting={getGreeting()} />;
  }

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

  const platformTotals = (schoolStats ?? []).reduce(
    (acc, s) => ({
      students: acc.students + s.totalStudents,
      lecturers: acc.lecturers + s.totalLecturers,
      openTickets: acc.openTickets + s.openTickets,
    }),
    { students: 0, lecturers: 0, openTickets: 0 },
  );

  return (
    <div className="space-y-6">
      {/* A platform operator (Tallycheck itself) monitoring every tenant is a fundamentally
          different vantage point from a single school's own admin looking at their own data —
          reusing the exact same plain greeting header for both read as "this is just one more
          school's dashboard," which is the opposite of what SUPER_ADMIN should feel like. */}
      {isSuperAdmin ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 px-6 py-7 sm:px-8 sm:py-8">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-300/80 bg-blue-400/10 px-2.5 py-1 rounded-full border border-blue-400/20">
                <Globe2 size={12} /> Platform Console
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                {getGreeting()}, {user?.firstName}
              </h1>
              <p className="text-slate-400 mt-1.5 text-sm">
                You're operating Tallycheck across every school on the platform — not a single institution's own view.
              </p>
            </div>
            <div className="flex gap-3 sm:gap-4 shrink-0">
              {[
                { label: 'Schools', value: schoolStats?.length ?? 0, icon: Building2 },
                { label: 'Students', value: platformTotals.students, icon: GraduationCap },
                { label: 'Staff', value: platformTotals.lecturers, icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center px-3 sm:px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 min-w-[76px]">
                  <Icon size={15} className="mx-auto text-blue-300 mb-1" />
                  <p className="text-lg font-bold text-white leading-tight">{value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {user?.firstName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Here's what's happening with Tcheck today</p>
        </div>
      )}

      {isSuperAdmin && <PulseLeaderboard />}

      {/* Platform-wide cross-school breakdown — SUPER_ADMIN only, so a multi-tenant deployment
          isn't just one flattened number. Each row links into that school's own overview via the
          same filters the rest of the dashboard already understands. */}
      {isSuperAdmin && (schoolStats?.length ?? 0) === 0 && (
        <div className="glass-card p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={28} className="text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No schools on the platform yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm mx-auto">
            Onboard your first customer to see live attendance, staff, and analytics roll up here across every school you run.
          </p>
          <button
            onClick={() => navigate('/admin/schools')}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Your First School
          </button>
        </div>
      )}

      {isSuperAdmin && (schoolStats?.length ?? 0) > 0 && (
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

      {!isSuperAdmin && <MyPulse />}

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
                    {formatCheckInType(a.checkInType)}
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

type PulseRange = 'day' | 'week' | 'month' | 'year';
interface PulseSchool { id: string; name: string; code: string; color: string; checkIns: number }

const RANGE_LABEL: Record<PulseRange, string> = { day: 'Today', week: 'This week', month: 'This month', year: 'This year' };

/** Which school is bringing in the most check-ins, right now — Tallycheck's own cross-tenant
 * view (see server's pulse.service.ts). Deliberately a ranked list, not another flat table: the
 * "Schools on the Platform" table below already has the raw per-school columns; this answers one
 * specific question — who's leading — at a glance. */
function PulseLeaderboard() {
  const [range, setRange] = useState<PulseRange>('day');
  const { data: rows } = useApi<PulseSchool[]>(`/pulse/leaderboard?range=${range}`, { refetchIntervalMs: DASHBOARD_REFRESH_MS, refetchWhenVisible: true });
  const top = rows?.slice(0, 6) ?? [];
  const max = Math.max(1, ...top.map((r) => r.checkIns));

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity size={18} className="text-blue-500" /> Pulse
        </h3>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
          {(['day', 'week', 'month', 'year'] as PulseRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                range === r ? 'bg-blue-500 text-white' : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10'
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        {top.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3">
            <span
              className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
                i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                : i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300'
                : i === 2 ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'
                : 'bg-gray-50 text-gray-400 dark:bg-white/5 dark:text-gray-500'
              }`}
            >
              {i + 1}
            </span>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-40 truncate">{s.name}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(s.checkIns / max) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums w-10 text-right">{s.checkIns}</span>
          </div>
        ))}
        {top.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No check-ins {RANGE_LABEL[range].toLowerCase()}.</p>}
      </div>
    </div>
  );
}

/** A school's own day/week/month/year check-in volume, all four at once — the tenant-scoped
 * counterpart to SUPER_ADMIN's cross-school PulseLeaderboard above. */
function MyPulse() {
  const { data } = useApi<Record<PulseRange, number>>('/pulse/mine', { refetchIntervalMs: DASHBOARD_REFRESH_MS, refetchWhenVisible: true });
  const tiles: { range: PulseRange; label: string }[] = [
    { range: 'day', label: 'Today' },
    { range: 'week', label: 'This week' },
    { range: 'month', label: 'This month' },
    { range: 'year', label: 'This year' },
  ];
  return (
    <div className="glass-card p-5">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <Activity size={18} className="text-blue-500" /> Pulse
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.range} className="rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{data?.[t.range] ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
