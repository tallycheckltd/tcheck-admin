import { useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  Filter,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  Users,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { format, parseISO } from 'date-fns';
import { LineChartCard } from '../../components/charts/LineChartCard';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { ClassAttendanceStat } from '../../types';

const DASH_OPTS = { refetchIntervalMs: 45_000, refetchWhenVisible: true } as const;

function sessionDate(d: ClassAttendanceStat) {
  try {
    const raw = typeof d.date === 'string' ? parseISO(d.date) : new Date(d.date);
    return Number.isNaN(raw.getTime()) ? new Date(d.date) : raw;
  } catch {
    return new Date(d.date);
  }
}

function sessionHour(d: ClassAttendanceStat) {
  try {
    const dt = typeof d.startTime === 'string' ? parseISO(d.startTime) : new Date(d.startTime);
    if (Number.isNaN(dt.getTime())) return 12;
    return dt.getHours() + dt.getMinutes() / 60;
  } catch {
    return 12;
  }
}

const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const HOUR_SLOTS = [
  { key: '< 9', min: -1, max: 9 },
  { key: '9–11', min: 9, max: 11 },
  { key: '11–13', min: 11, max: 13 },
  { key: '13–15', min: 13, max: 15 },
  { key: '15–17', min: 15, max: 17 },
  { key: '17+', min: 17, max: 99 },
] as const;

export function AttendanceAnalyticsPage() {
  const { data, loading, error, refetch } = useApi<ClassAttendanceStat[]>('/attendance/class-stats', DASH_OPTS);
  const statsList = data ?? [];
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  const uniqueCourses = useMemo(
    () => Array.from(new Set(statsList.map((s) => s.course.code))),
    [statsList],
  );

  const filtered = useMemo(() => {
    return statsList.filter((s) => {
      const matchesSearch =
        !search ||
        s.course.name.toLowerCase().includes(search.toLowerCase()) ||
        s.course.code.toLowerCase().includes(search.toLowerCase()) ||
        s.title.toLowerCase().includes(search.toLowerCase());
      const matchesCourse = !courseFilter || s.course.code === courseFilter;
      return matchesSearch && matchesCourse;
    });
  }, [statsList, search, courseFilter]);

  const trendData = useMemo(() => {
    const days = Array.from(new Set(filtered.map((s) => format(sessionDate(s), 'yyyy-MM-dd')))).sort();
    return days.map((dateStr) => {
      const dayStats = filtered.filter((s) => format(sessionDate(s), 'yyyy-MM-dd') === dateStr);
      const avgRate = Math.round(
        dayStats.reduce((acc, s) => acc + s.attendanceRate, 0) / Math.max(dayStats.length, 1),
      );
      return { date: format(parseISO(`${dateStr}T12:00:00`), 'MMM d'), value: avgRate };
    });
  }, [filtered]);

  const weekdaysChart = useMemo(() => {
    return WEEKDAY_ORDER.map((label) => {
      const short = label;
      const count = filtered.filter((s) => format(sessionDate(s), 'EEE') === short).length;
      const avgRate =
        count === 0
          ? 0
          : Math.round(
              filtered
                .filter((s) => format(sessionDate(s), 'EEE') === short)
                .reduce((a, s) => a + s.attendanceRate, 0) / count,
            );
      return { day: label, sessions: count, avgRate };
    });
  }, [filtered]);

  const hourlyBands = useMemo(() => {
    return HOUR_SLOTS.map((slot) => {
      const slice = filtered.filter((s) => {
        const h = sessionHour(s);
        const nextMin = slot.min;
        const nextMax = slot.max;
        if (slot.key === '< 9') return h < 9;
        if (slot.key === '17+') return h >= 17;
        return h >= nextMin && h < nextMax;
      });
      const avgRate =
        slice.length === 0
          ? 0
          : Math.round(slice.reduce((a, s) => a + s.attendanceRate, 0) / slice.length);
      return {
        slot: slot.key,
        sessions: slice.length,
        avgRate,
      };
    });
  }, [filtered]);

  const totalStudents = filtered.reduce((acc, s) => acc + s.totalEnrolled, 0);
  const approxAtRiskSeats = useMemo(() => {
    return Math.round(
      filtered.reduce((acc, s) => {
        if (s.totalEnrolled <= 0) return acc;
        const gap = Math.max(0, 75 - s.attendanceRate) / 100;
        return acc + s.totalEnrolled * gap;
      }, 0),
    );
  }, [filtered]);

  const absenteeismByFaculty = useMemo(() => {
    const grouped = filtered.reduce<Record<string, { enrolled: number; checkedIn: number }>>((acc, s) => {
      const faculty = s.course.code.replace(/[0-9]/g, '').toUpperCase() || 'GEN';
      acc[faculty] = acc[faculty] || { enrolled: 0, checkedIn: 0 };
      acc[faculty].enrolled += s.totalEnrolled;
      acc[faculty].checkedIn += s.totalCheckedIn;
      return acc;
    }, {});

    return Object.entries(grouped).map(([faculty, values]) => {
      const rate = values.enrolled > 0 ? Math.round((values.checkedIn / values.enrolled) * 100) : 0;
      return { faculty, attendanceRate: rate, absenteeismRate: Math.max(0, 100 - rate) };
    });
  }, [filtered]);

  const ghostClasses = useMemo(
    () =>
      filtered
        .filter(
          (s) => s.totalEnrolled >= 25 && s.totalCheckedIn <= Math.max(3, Math.ceil(s.totalEnrolled * 0.15)),
        )
        .slice(0, 8)
        .map((s) => ({
          id: s.id,
          label: `${s.course.code} • ${s.title}`,
          enrolled: s.totalEnrolled,
          checkedIn: s.totalCheckedIn,
          room: s.room ?? 'Unassigned room',
        })),
    [filtered],
  );

  const authExceptionBreakdown = useMemo(() => {
    const totals = filtered.reduce(
      (acc, s) => {
        acc.BLE += s.checkInBreakdown.BLE;
        acc.MANUAL += s.checkInBreakdown.MANUAL;
        acc.QR += s.checkInBreakdown.QR;
        return acc;
      },
      { BLE: 0, MANUAL: 0, QR: 0 },
    );
    const sum = totals.BLE + totals.MANUAL + totals.QR;
    if (sum === 0) {
      return [] as { name: string; value: number; color: string }[];
    }
    const raw = [
      { name: 'BLE', value: (totals.BLE / sum) * 100, color: '#6366f1' },
      { name: 'QR', value: (totals.QR / sum) * 100, color: '#f97316' },
      { name: 'Manual', value: (totals.MANUAL / sum) * 100, color: '#94a3b8' },
    ];
    const rounded = raw.map((r) => ({ ...r, value: Math.round(r.value * 10) / 10 }));
    const drift = 100 - rounded.reduce((a, x) => a + x.value, 0);
    if (rounded.length && Math.abs(drift) > 0.05) {
      rounded[0] = { ...rounded[0], value: Math.round((rounded[0].value + drift) * 10) / 10 };
    }
    const labels = { BLE: 'Secure BLE', QR: 'QR check-in', Manual: 'Manual override' };
    return rounded.map((r) => ({
      ...r,
      name: labels[r.name as keyof typeof labels] ?? r.name,
    }));
  }, [filtered]);

  const lowAttendanceSessions = statsList.filter((s) => s.attendanceRate < 70 && s.totalEnrolled > 0);

  const avgTrendPct =
    trendData.length === 0
      ? 0
      : Math.round(trendData.reduce((a, d) => a + d.value, 0) / trendData.length);

  const showInitialSpinner = loading && !data;

  if (showInitialSpinner) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-600 dark:border-white/15 dark:border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-3 text-sm">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5 dark:text-red-400" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200">Could not load analytics</p>
              <p className="text-red-700/90 dark:text-red-300/90 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Attendance analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Session-level attendance, check-in mix, and risk signals. Data updates while you have this tab open.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative group min-w-[160px]">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-gray-900 dark:text-gray-100"
              aria-label="Filter by course"
            >
              <option value="">All courses</option>
              {uniqueCourses.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <Filter size={14} />
            </div>
          </div>
          <div className="relative min-w-[180px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search course or session..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              aria-label="Search sessions"
            />
          </div>
          {!error && (
            <button
              type="button"
              onClick={() => refetch()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LineChartCard title="Average attendance by day (filtered)" data={trendData} color="#3b82f6" />
        </div>
        <div className="glass-card p-5 flex flex-col justify-center border border-gray-200/80 dark:border-white/10 bg-white/40 dark:bg-white/[0.03]">
          <TrendingUp className="text-blue-600 dark:text-blue-400 mb-3" size={22} aria-hidden />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Weekly insight</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {filtered.length === 0 ? (
              <>No sessions match your filters. Adjust filters or enroll students in courses.</>
            ) : trendData.length === 0 ? (
              <>Trend appears after sessions are scheduled with dates.</>
            ) : (
              <>
                Across selected days the mean attendance rate is{' '}
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{avgTrendPct}%</span>.
                {trendData.length > 1 && trendData[trendData.length - 1].value > trendData[trendData.length - 2].value
                  ? ' Latest day is trending up versus the prior datapoint.'
                  : ' Continue monitoring dips below your school thresholds.'}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-5 border border-gray-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-amber-500 shrink-0" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Below 75% seat gap</h3>
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {approxAtRiskSeats.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            Approximate student-seat gap to reach 75% attendance across filtered sessions (enrolled × shortfall).
            Denominator: {Math.max(totalStudents, 0).toLocaleString()} enrolled seats in view.
          </p>
        </div>

        <div className="glass-card p-5 lg:col-span-2 border border-gray-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={16} className="text-green-400 shrink-0" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sessions by weekday</h3>
            <Badge color="gray">{filtered.length} sessions</Badge>
          </div>
          <div className="h-[220px]">
            {filtered.length === 0 ? (
              <EmptyChart label="No sessions in this filter" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdaysChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.35} />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} axisLine={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fff' }}
                    formatter={(value, name) => [value, name === 'avgRate' ? 'Avg rate' : 'Sessions']}
                  />
                  <Bar yAxisId="left" dataKey="sessions" fill="#22c55e" radius={[6, 6, 0, 0]} name="Sessions" />
                  <Bar yAxisId="right" dataKey="avgRate" fill="#38bdf8" radius={[6, 6, 0, 0]} name="Avg rate" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card p-5 border border-gray-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={16} className="text-cyan-400 shrink-0" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Absenteeism by course prefix</h3>
          </div>
          <div className="h-[230px]">
            {absenteeismByFaculty.length === 0 ? (
              <EmptyChart label="No faculty buckets in filter" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={absenteeismByFaculty}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.35} />
                  <XAxis dataKey="faculty" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fff' }} />
                  <Bar dataKey="absenteeismRate" fill="#f97316" radius={[6, 6, 0, 0]} name="% absent seats" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card p-5 lg:col-span-2 border border-gray-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <BarChart3 size={16} className="text-indigo-400 shrink-0" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Start-time bands</h3>
            <Badge color="gray">Avg attendance by class start hour</Badge>
          </div>
          <div className="h-[230px]">
            {filtered.length === 0 ? (
              <EmptyChart label="No sessions in this filter" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyBands}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.35} />
                  <XAxis dataKey="slot" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="sessions" orientation="left" tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fff' }} />
                  <Bar yAxisId="sessions" dataKey="sessions" fill="#6366f1" radius={[6, 6, 0, 0]} name="Sessions" />
                  <Bar yAxisId="rate" dataKey="avgRate" fill="#a78bfa" radius={[6, 6, 0, 0]} name="Avg rate" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card p-5 border border-gray-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Low check-in sessions</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Large enrollments with ≤15% checked in (or ≤3 when tiny).
          </p>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {ghostClasses.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">None in current filter.</p>
            ) : (
              ghostClasses.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl border border-red-200/80 dark:border-red-900/40 bg-red-50/80 dark:bg-red-950/20 px-3 py-2"
                >
                  <p className="text-xs font-semibold text-red-900 dark:text-red-200">{g.label}</p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">
                    {g.room} · {g.checkedIn}/{g.enrolled} present
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card p-5 lg:col-span-3 border border-gray-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-purple-400 shrink-0" aria-hidden />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Check-in method mix (filtered)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="h-[240px] w-full min-w-0">
              {authExceptionBreakdown.length === 0 ? (
                <EmptyChart label="No check-ins recorded in this filter" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={authExceptionBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {authExceptionBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="#0f172a" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${v ?? 0}%`, 'Share']}
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="md:col-span-2 space-y-3">
              {authExceptionBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Method split will appear after students check in.</p>
              ) : (
                authExceptionBreakdown.map((entry) => (
                  <div key={entry.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">{entry.name}</span>
                      <span className="text-gray-900 dark:text-gray-100 font-semibold tabular-nums">{entry.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, entry.value)}%`, background: entry.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-card overflow-hidden border border-gray-200/80 dark:border-white/10 rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-900/80 border-b border-gray-200 dark:border-white/10">
                  <th className="text-left py-3 px-4 text-slate-700 dark:text-slate-200 font-semibold">Session / course</th>
                  <th className="text-left py-3 px-4 text-slate-700 dark:text-slate-200 font-semibold">Lecturer</th>
                  <th className="text-center py-3 px-4 text-slate-700 dark:text-slate-200 font-semibold">Attendance</th>
                  <th className="text-center py-3 px-4 text-slate-700 dark:text-slate-200 font-semibold">Rate</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-200 font-semibold">Methods</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 dark:border-white/[0.06] hover:bg-gray-50/80 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3 px-4 align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-gray-900 dark:text-white">{s.title}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1.5">
                          <Badge color="blue">{s.course.code}</Badge>
                          {format(sessionDate(s), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300 align-top">
                      {s.course.lecturer.firstName} {s.course.lecturer.lastName}
                    </td>
                    <td className="py-3 px-4 text-center align-top">
                      <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{s.totalCheckedIn}</span>
                      <span className="text-gray-400"> / {s.totalEnrolled}</span>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-28 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${s.attendanceRate >= 70 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, s.attendanceRate)}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${s.attendanceRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {s.attendanceRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        {s.checkInBreakdown.BLE > 0 && <Badge color="purple">BLE {s.checkInBreakdown.BLE}</Badge>}
                        {s.checkInBreakdown.QR > 0 && <Badge color="yellow">QR {s.checkInBreakdown.QR}</Badge>}
                        {s.checkInBreakdown.MANUAL > 0 && <Badge color="gray">M {s.checkInBreakdown.MANUAL}</Badge>}
                        {s.checkInBreakdown.BLE + s.checkInBreakdown.QR + s.checkInBreakdown.MANUAL === 0 && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !error && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-gray-500 dark:text-gray-400">
                      <Activity size={36} className="mx-auto mb-3 opacity-25" aria-hidden />
                      <p className="font-medium">No sessions match your filters</p>
                      <p className="text-xs mt-1 max-w-sm mx-auto">
                        {statsList.length === 0
                          ? 'There is no class history yet, or your account cannot see these records.'
                          : 'Try clearing search or choosing “All courses”.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-5 border border-red-200/60 dark:border-red-900/35 bg-red-50/30 dark:bg-red-950/15">
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300 flex items-center gap-2 mb-2">
              <AlertTriangle size={16} aria-hidden />
              At-risk sessions (&lt;70%)
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              Pulled from all loaded sessions (not filtered by search).
            </p>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {lowAttendanceSessions.length === 0 ? (
                <p className="text-center text-xs text-emerald-700 dark:text-emerald-400 py-4 font-medium">
                  No sessions under 70% with enrollments.
                </p>
              ) : (
                lowAttendanceSessions.slice(0, 8).map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-white dark:bg-white/5 border border-red-100 dark:border-red-900/25"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{s.course.code}</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums shrink-0">
                        {s.attendanceRate}%
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{s.title}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-card p-5 border border-gray-200/80 dark:border-white/10">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Method breakdown (all loaded)</h3>
            <div className="space-y-4">
              {(
                [
                  { label: 'BLE proximity', key: 'BLE' as const, color: '#6366f1' },
                  { label: 'QR scan', key: 'QR' as const, color: '#f97316' },
                  { label: 'Manual', key: 'MANUAL' as const, color: '#64748b' },
                ] as const
              ).map((method) => {
                const total = statsList.reduce((acc, s) => acc + (s.checkInBreakdown[method.key] || 0), 0);
                const grandTotal = statsList.reduce((acc, s) => acc + s.totalCheckedIn, 0) || 1;
                const pct = Math.round((total / grandTotal) * 100);
                return (
                  <div key={method.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">{method.label}</span>
                      <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
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

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-white/15 px-6 text-center">
      <Activity className="text-gray-300 dark:text-gray-600 mb-2" size={28} aria-hidden />
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
