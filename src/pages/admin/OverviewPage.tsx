import { useNavigate } from 'react-router-dom';
import {
  Users, GraduationCap, Calendar, BookOpen, Clock, UserCheck, ArrowRight,
  Wifi, BatteryLow, ShieldAlert, Activity, Building2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
} from 'recharts';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { BarChartCard } from '../../components/charts/BarChartCard';
import type { DashboardStats, School } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Dummy SaaS data (deterministic) ─────────────────────────────────────────

const SCHOOLS_BILLING = [
  { name: 'Strathmore',  students: 4820, color: '#3b82f6' },
  { name: 'Daystar',     students: 3210, color: '#8b5cf6' },
  { name: 'USIU-Africa', students: 5140, color: '#06b6d4' },
  { name: 'KCA',         students: 2250, color: '#f97316' },
];

const BEACON_HEALTH = [
  { name: 'Online',      value: 130, color: '#22c55e' },
  { name: 'Offline',     value: 10,  color: '#ef4444' },
  { name: 'Low Battery', value: 2,   color: '#f97316' },
];

const FRAUD_ANOMALIES = (() => {
  const days = [];
  const base = [2, 1, 4, 3, 7, 2, 5, 1, 3, 6, 2, 4, 1, 8];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      attempts: base[13 - i],
    });
  }
  return days;
})();

const TOTAL_BILLED_STUDENTS = SCHOOLS_BILLING.reduce((s, x) => s + x.students, 0);
const TOTAL_BEACONS = BEACON_HEALTH.reduce((s, x) => s + x.value, 0);

// ─── Super Admin — SaaS Infrastructure View ──────────────────────────────────

function SuperAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: schools } = useApi<School[]>('/schools');

  const kpis = [
    {
      title: 'Total Active Schools',
      value: schools?.length ?? SCHOOLS_BILLING.length,
      icon: Building2,
      color: '#3b82f6',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      sub: 'Universities on-platform',
    },
    {
      title: 'Total Billed Students',
      value: TOTAL_BILLED_STUDENTS.toLocaleString(),
      icon: GraduationCap,
      color: '#8b5cf6',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      sub: 'Headcount for pricing tier',
    },
    {
      title: 'Total Active Beacons',
      value: TOTAL_BEACONS,
      icon: Wifi,
      color: '#06b6d4',
      bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      sub: 'Hardware deployed across all sites',
    },
    {
      title: 'System Uptime / API Health',
      value: '99.9%',
      icon: Activity,
      color: '#22c55e',
      bg: 'bg-green-50 dark:bg-green-500/10',
      sub: 'Last 30 days SLA',
    },
  ];

  const quickLinks = [
    { label: 'Manage Schools',    to: '/admin/schools',        icon: Building2 },
    { label: 'School Admins',     to: '/admin/school-admins',  icon: Users },
    { label: 'BLE Beacons',       to: '/admin/beacons',        icon: Wifi },
    { label: 'Device Verification', to: '/admin/device-verification', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
          Tcheck Ltd. Infrastructure & Billing Overview — Platform-wide aggregate only. No academic records.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.title} className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{k.title}</p>
                <p className="text-3xl font-bold tabular-nums text-slate-950 dark:text-white mt-1">{k.value}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{k.sub}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickLinks.map((l) => (
          <button
            key={l.label}
            onClick={() => navigate(l.to)}
            className="glass-card p-3.5 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <l.icon size={15} className="text-blue-500" />
              </div>
              <span className="text-xs font-medium text-slate-900 dark:text-white">{l.label}</span>
            </div>
            <ArrowRight size={13} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
          </button>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active Students per School */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={16} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
              Active Students per School
            </h3>
            <span className="ml-auto text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              End-of-month billing basis
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={SCHOOLS_BILLING} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.2)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(15,23,42,0.9)', border: 'none', borderRadius: 10, fontSize: 12, color: '#e2e8f0' }}
                cursor={{ fill: 'rgba(100,116,139,0.08)' }}
                formatter={(v: number | string | undefined) => [`${v?.toLocaleString() ?? 0}`, 'Students']}
              />
              {SCHOOLS_BILLING.map((s) => (
                <Bar key={s.name} dataKey="students" radius={[6, 6, 0, 0]}>
                  {SCHOOLS_BILLING.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
          {/* Billing table */}
          <div className="mt-4 space-y-1.5">
            {SCHOOLS_BILLING.map((s) => (
              <div key={s.name} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-slate-800 dark:text-gray-300 flex-1">{s.name}</span>
                <span className="font-semibold text-slate-950 dark:text-white tabular-nums">{s.students.toLocaleString()}</span>
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 w-16 text-right">
                  ${(s.students * 2.50).toLocaleString()} /mo
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm pt-2 border-t border-slate-200 dark:border-white/5">
              <div className="w-2 h-2 rounded-full flex-shrink-0 bg-transparent" />
              <span className="font-semibold text-slate-950 dark:text-white flex-1">Total</span>
              <span className="font-bold text-slate-950 dark:text-white tabular-nums">{TOTAL_BILLED_STUDENTS.toLocaleString()}</span>
              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 w-16 text-right">
                ${(TOTAL_BILLED_STUDENTS * 2.50).toLocaleString()} /mo
              </span>
            </div>
          </div>
        </div>

        {/* Hardware Health Donut */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wifi size={16} className="text-cyan-500" />
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Hardware Health</h3>
          </div>
          <div className="flex justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={BEACON_HEALTH}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {BEACON_HEALTH.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(15,23,42,0.9)', border: 'none', borderRadius: 10, fontSize: 12, color: '#e2e8f0' }}
                  formatter={(v: number | string | undefined) => [v ?? 0, 'Beacons']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {BEACON_HEALTH.map((b) => (
              <div key={b.name} className="flex items-center gap-2.5 text-sm">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                <span className="text-slate-800 dark:text-gray-300 flex-1">{b.name}</span>
                <span className="font-semibold text-slate-950 dark:text-white tabular-nums">{b.value}</span>
              </div>
            ))}
          </div>
          {BEACON_HEALTH[2].value > 0 && (
            <div className="mt-3 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200/60 dark:border-orange-500/20">
              <div className="flex items-center gap-1.5">
                <BatteryLow size={12} className="text-orange-500 flex-shrink-0" />
                <p className="text-[11px] font-medium text-orange-700 dark:text-orange-400">
                  {BEACON_HEALTH[2].value} beacon{BEACON_HEALTH[2].value > 1 ? 's' : ''} at risk — battery ≤ 20%
                </p>
              </div>
              <p className="text-[10px] text-orange-500/80 mt-0.5 pl-4">
                CR2477 cell — flat discharge curve; replace immediately.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 — Global Fraud Anomalies */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert size={16} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
            Global Verification Anomalies (Last 14 Days)
          </h3>
          <span className="ml-auto text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Aggregate only — no student names
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
          Device spoofing / IMEI mismatch attempts caught across all schools.
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={FRAUD_ANOMALIES} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.2)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'rgba(15,23,42,0.9)', border: 'none', borderRadius: 10, fontSize: 12, color: '#e2e8f0' }}
              formatter={(v: number | string | undefined) => [v ?? 0, 'Blocked attempts']}
            />
            <ReferenceLine y={5} stroke="#f97316" strokeDasharray="4 3" label={{ value: 'Alert threshold', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }} />
            <Line
              type="monotone"
              dataKey="attempts"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#8b5cf6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── HOD / Sub-Admin Department View ─────────────────────────────────────────

function HodOverviewDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats } = useApi<DashboardStats>('/attendance/dashboard-stats');

  const statCards = [
    { title: 'Total Students',    value: stats?.totalStudents ?? 0,     icon: GraduationCap, color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { title: 'Lecturers',         value: stats?.totalLecturers ?? 0,    icon: Users,         color: '#8b5cf6', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { title: 'Total Courses',     value: stats?.totalCourses ?? 0,      icon: BookOpen,      color: '#06b6d4', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { title: 'Today Check-ins',   value: stats?.todayAttendances ?? 0,  icon: UserCheck,     color: '#22c55e', bg: 'bg-green-50 dark:bg-green-500/10' },
    { title: 'Total Classes',     value: stats?.totalClasses ?? 0,      icon: Calendar,      color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-500/10' },
    { title: 'Pending Approvals', value: stats?.pendingApprovals ?? 0,  icon: Clock,         color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
  ];

  const quickActions = [
    { label: 'Manage Users', to: '/admin/users', icon: Users },
    { label: 'View Courses', to: '/courses',     icon: BookOpen },
    { label: 'Attendance',   to: '/attendance',  icon: UserCheck },
  ];

  const weekData = stats?.attendanceByDay?.map((d) => ({
    name: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
    value: d.count,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Here's what's happening with your department today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{card.title}</p>
                <p className="text-3xl font-bold tabular-nums text-slate-950 dark:text-white mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon size={24} style={{ color: card.color }} />
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
            className="glass-card p-4 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <action.icon size={20} className="text-blue-500" />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{action.label}</span>
            </div>
            <ArrowRight size={16} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard title="Attendance (Last 7 Days)" data={weekData} />

        <div className="glass-card p-5">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4">Recent Check-ins</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {stats?.recentAttendances?.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {a.user?.firstName} {a.user?.lastName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {a.class?.course?.name || 'Unknown Course'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    a.checkInType === 'BLE'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                    a.checkInType === 'QR'     ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-slate-500'
                  }`}>
                    {a.checkInType}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {new Date(a.checkInAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {(!stats?.recentAttendances || stats.recentAttendances.length === 0) && (
              <p className="text-sm text-slate-600 text-center py-8">No recent check-ins</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function OverviewPage() {
  const { user } = useAuth();
  return user?.role === 'SUPER_ADMIN' ? <SuperAdminDashboard /> : <HodOverviewDashboard />;
}
