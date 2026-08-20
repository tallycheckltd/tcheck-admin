import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import {
  Activity, AlertTriangle, BookOpen, Clock, TrendingUp, ShieldAlert, FileDown,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { exportAttendanceOverviewPdf } from '../../lib/adminPdfExport';
import {
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { Badge } from '../../components/ui/Badge';
import type { ClassAttendanceStat, DashboardStats } from '../../types';

const DASHBOARD_REFRESH_MS = 30_000;

function buildNeedsAttention(stats: DashboardStats, classStats: ClassAttendanceStat[] | undefined) {
  const items: { title: string; detail: string; severity: 'high' | 'medium' | 'low'; href?: string }[] = [];
  const threshold = stats.attendanceThreshold;

  const lowAttendance = [...(classStats ?? [])]
    .filter((s) => s.totalEnrolled > 0 && s.attendanceRate < threshold)
    .sort((a, b) => a.attendanceRate - b.attendanceRate)
    .slice(0, 3)
    .map((s) => ({
      title: `Low attendance — ${s.course.code}`,
      detail: `${s.title} · ${Math.round(s.attendanceRate)}% present (${s.totalCheckedIn}/${s.totalEnrolled} checked in)`,
      severity: 'high' as const,
      href: `/live?classId=${s.id}`,
    }));
  items.push(...lowAttendance);

  if (stats.pendingApprovals > 0) {
    items.push({
      title: 'Pending account approvals',
      detail: `${stats.pendingApprovals} user(s) are waiting for administrator approval.`,
      severity: 'medium',
      href: '/admin/users?status=PENDING',
    });
  }

  return items;
}

export function AttendanceOverviewPage() {
  const dashOpts = { refetchIntervalMs: DASHBOARD_REFRESH_MS, refetchWhenVisible: true } as const;
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data: stats, loading } = useApi<DashboardStats>('/attendance/dashboard-stats', dashOpts);
  const { data: classStats } = useApi<ClassAttendanceStat[]>('/attendance/class-stats', dashOpts);

  const chartData = useMemo(() => {
    if (!classStats?.length) return [];
    const byCourse = new Map<string, { sum: number; count: number }>();
    for (const row of classStats) {
      const code = row.course.code;
      const prev = byCourse.get(code) ?? { sum: 0, count: 0 };
      prev.sum += row.attendanceRate;
      prev.count += 1;
      byCourse.set(code, prev);
    }
    return [...byCourse.entries()]
      .map(([label, agg]) => ({
        label,
        value: Math.round(agg.sum / Math.max(agg.count, 1)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [classStats]);

  const needsAttention = useMemo(() => (
    stats ? buildNeedsAttention(stats, classStats ?? undefined) : []
  ), [stats, classStats]);

  const hasWeeklyActivity = !!stats?.attendanceByDay?.some((d) => d.count > 0);

  if ((loading && !stats) || !stats) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">High-level summary of campus activity</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!stats || pdfBusy}
            onClick={async () => {
              if (!stats) return;
              setPdfBusy(true);
              try {
                await exportAttendanceOverviewPdf(stats, classStats ?? []);
              } catch {
                window.alert('Could not generate PDF. Try Chrome or Edge on desktop.');
              } finally {
                setPdfBusy(false);
              }
            }}
            className="gap-1.5"
          >
            <FileDown size={14} />
            {pdfBusy ? 'PDF…' : 'Download PDF'}
          </Button>
          <Badge color="blue">Live · auto-updates every 30s</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Today&apos;s attendance rate</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayRate}%</p>
              <span className={`text-xs font-semibold ${rateDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {rateDelta >= 0 ? '↑' : '↓'} {Math.abs(rateDelta)}%
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">Vs. enrolled students ({stats.totalStudents})</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-500">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Today&apos;s check-ins</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{stats.todayAttendances.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scheduled classes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{stats.totalClasses.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending approvals</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{stats.pendingApprovals.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-500" />
                Average attendance by course (%)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cumulative across all recorded sessions</p>
            </div>
          </div>
          <div className="h-[300px] w-full relative">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#243043" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }}
                    formatter={(value: number | string | undefined) => [`${Number(value ?? 0)}%`, 'Avg. attendance']}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                {hasWeeklyActivity ? (
                  <>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Course breakdown not available yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
                      Once class sessions appear in attendance, average rates by course code will populate this chart.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-full max-w-lg h-44 rounded-2xl border border-white/10 bg-slate-900/30 relative overflow-hidden mb-4">
                      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                      <div className="absolute bottom-4 left-6 right-6 grid grid-cols-5 gap-3">
                        {[38, 55, 42, 66, 49].map((h, idx) => (
                          <div key={`ph-${idx}`} className="rounded-md bg-blue-400/30" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Collecting campus data…</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
                      Insights will appear after your first tracked sessions.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            Needs attention
          </h2>
          <div className="space-y-3">
            {needsAttention.map((item, idx) => {
              const cardClass = `block rounded-xl border px-3 py-3 transition-colors ${
                item.severity === 'high'
                  ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15'
                  : item.severity === 'medium'
                    ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
                    : 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15'
              }`;
              const content = (
                <>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-1 leading-relaxed">{item.detail}</p>
                </>
              );
              return item.href ? (
                <Link key={`${item.title}-${idx}`} to={item.href} className={cardClass}>
                  {content}
                </Link>
              ) : (
                <div key={`${item.title}-${idx}`} className={cardClass}>
                  {content}
                </div>
              );
            })}
            {needsAttention.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                No sessions under {stats?.attendanceThreshold ?? 80}% attendance and no pending approvals. You&apos;re caught up.
              </p>
            )}
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert size={14} className="text-purple-400" />
                Security & integrity
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1 leading-relaxed">
                Use Fraud detection and Device verification in the sidebar for deeper reviews; those tools are not summarized here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
