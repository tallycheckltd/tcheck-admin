import { Fragment, useId, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  Activity,
  BarChart3,
  Building2,
  FileDown,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { exportCampusAnalyticsPdf, exportTrendAnalysisPdf } from '../../lib/adminPdfExport';
import { downloadCsv } from '../../lib/csv';
import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Area,
  Line,
  ComposedChart,
  Legend,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { CampusAnalytics, ClassAttendanceStat } from '../../types';
import { clsx } from 'clsx';

const DASH_OPTS = { refetchIntervalMs: 60_000, refetchWhenVisible: true } as const;

/** Rich analytics palette — tuned for light + dark */
const C = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  fuchsia: '#d946ef',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  slate: '#64748b',
  grid: 'rgba(148, 163, 184, 0.22)',
  gridDark: 'rgba(148, 163, 184, 0.12)',
};

function sessionDate(d: ClassAttendanceStat) {
  try {
    const raw = typeof d.date === 'string' ? parseISO(d.date) : new Date(d.date);
    return Number.isNaN(raw.getTime()) ? new Date(d.date) : raw;
  } catch {
    return new Date(d.date);
  }
}

function formatSessionDayLabel(dateIso: string) {
  if (!dateIso) return '—';
  const raw =
    dateIso.length >= 10 && dateIso[10] === 'T' ? parseISO(dateIso) : parseISO(`${dateIso}T12:00:00`);
  if (Number.isNaN(raw.getTime())) return dateIso;
  return format(raw, 'MMM d, yyyy');
}

/** Heat cell: cool (empty) → indigo → magenta by intensity */
function heatColor(intensity: number, max: number) {
  const t = max > 0 ? Math.min(1, intensity / max) : 0;
  const h = 220 + t * 95;
  const s = 35 + t * 55;
  const l = 52 - t * 18;
  return `hsl(${h} ${s}% ${l}%)`;
}

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.92)',
  fontSize: 12,
  color: '#f1f5f9',
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
};

export function AttendanceAnalyticsPage() {
  const uid = useId().replace(/:/g, '');
  const { data: campus, loading: campusLoading, error: campusError, refetch: refetchCampus } = useApi<CampusAnalytics>(
    '/attendance/campus-analytics',
    DASH_OPTS,
  );
  const { data: sessionRows, loading: rowsLoading, error: rowsError, refetch: refetchRows } = useApi<ClassAttendanceStat[]>(
    '/attendance/class-stats',
    DASH_OPTS,
  );
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [trendExporting, setTrendExporting] = useState<'pdf' | 'csv' | null>(null);

  const statsList = sessionRows ?? [];
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

  const trendLineData = useMemo(() => {
    if (!campus?.overallTrendSparkline?.length) return [];
    return campus.overallTrendSparkline.map((p) => ({ date: p.label, value: p.value }));
  }, [campus]);

  const trendHasData = trendLineData.length > 0 && trendLineData.some((d) => d.value > 0);

  const blockedTotal = campus ? campus.blockedGateAttemptsBle + campus.blockedGateAttemptsQr : 0;
  const gatePieData = useMemo(() => {
    if (!campus || blockedTotal === 0) return [];
    return [
      { name: 'TB blocks', value: campus.blockedGateAttemptsBle, color: C.violet },
      { name: 'QR blocks', value: campus.blockedGateAttemptsQr, color: C.cyan },
    ].filter((d) => d.value > 0);
  }, [campus, blockedTotal]);

  const heatMatrix = useMemo(() => {
    if (!campus) return null;
    const { start, end } = campus.hourRange;
    const cols = end - start + 1;
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(cols).fill(0));
    for (const c of campus.trafficHeatmapCells) {
      const col = c.hour - start;
      if (col >= 0 && col < cols && c.dayIdx >= 0 && c.dayIdx < 7) {
        matrix[c.dayIdx][col] = Math.max(matrix[c.dayIdx][col], c.intensity);
      }
    }
    const hours = Array.from({ length: cols }, (_, i) => start + i);
    return { matrix, hours, max: campus.trafficHeatmapMax || 1 };
  }, [campus]);

  const showInitialSpinner =
    (!campus && campusLoading && !campusError) || (!statsList.length && rowsLoading && !rowsError);

  async function refreshAll() {
    await Promise.all([refetchCampus(), refetchRows()]);
  }

  async function handleExportPdf() {
    if (!campus) return;
    setPdfExporting(true);
    try {
      await exportCampusAnalyticsPdf(campus, filtered);
    } catch {
      window.alert('Could not generate PDF. If this persists, try Chrome or Edge on desktop.');
    } finally {
      setPdfExporting(false);
    }
  }

  async function handleExportTrendPdf() {
    if (!campus) return;
    setTrendExporting('pdf');
    try {
      await exportTrendAnalysisPdf(campus);
    } catch {
      window.alert('Could not generate PDF. If this persists, try Chrome or Edge on desktop.');
    } finally {
      setTrendExporting(null);
    }
  }

  function handleExportTrendCsv() {
    if (!campus) return;
    setTrendExporting('csv');
    try {
      downloadCsv(
        'tcheck-trend-analysis.csv',
        ['Week', 'Attendance %', 'Present', 'Eligible'],
        campus.attendanceDecayByWeek.map((w) => [w.weekLabel, w.pct, w.volumePresent, w.volumeEligible]),
      );
    } finally {
      setTrendExporting(null);
    }
  }

  const cardShell =
    'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] p-5 shadow-[var(--app-shadow)] dark:border-white/10 dark:bg-gradient-to-br dark:from-white/[0.07] dark:to-white/[0.02]';

  if (showInitialSpinner) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-white/20 dark:border-t-fuchsia-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-8 text-[color:var(--app-text)]">
      {(campusError || rowsError) && (
        <div
          className={clsx(
            cardShell,
            'flex flex-col gap-3 border-rose-500/35 bg-gradient-to-r from-rose-500/12 to-amber-500/10 sm:flex-row sm:items-center sm:justify-between',
          )}
        >
          <p className="text-sm text-rose-900 dark:text-rose-100/90">{campusError ?? rowsError}</p>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 hover:opacity-95"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      <header className="relative overflow-hidden rounded-3xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50/80 p-6 shadow-lg shadow-indigo-500/10 dark:border-white/10 dark:from-indigo-950/40 dark:via-slate-950/80 dark:to-fuchsia-950/30 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-500/15" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200">
              <Sparkles size={14} className="text-fuchsia-500 dark:text-fuchsia-300" aria-hidden />
              Live analytics
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">Attendance analytics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Colorful charts for campus pulse, weekly participation, traffic heat, and rooms — all from your API. Refreshes while this tab is open.
              {campus?.fetchedAtIso && (
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Last update {format(parseISO(campus.fetchedAtIso), 'MMM d, h:mm a')}.
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!campus || pdfExporting}
              onClick={() => void handleExportPdf()}
              className="gap-2 border-indigo-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/10"
            >
              <FileDown size={16} className={pdfExporting ? 'animate-pulse text-indigo-600' : ''} />
              {pdfExporting ? 'PDF…' : 'Download PDF'}
            </Button>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="min-w-[140px] rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-white/15 dark:bg-slate-900/80 dark:text-white"
              aria-label="Filter sessions by course"
            >
              <option value="">All courses</option>
              {uniqueCourses.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <div className="relative min-w-[180px]">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search session or course…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm dark:border-white/15 dark:bg-slate-900/80 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={campusLoading || rowsLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white disabled:opacity-50 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} className={campusLoading || rowsLoading ? 'animate-spin text-indigo-500' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {campus && (
        <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Campus attendance',
              value: `${campus.overallAttendancePct}%`,
              hint: `${campus.sessionCount} sessions in scope`,
              icon: BarChart3,
              className:
                'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-cyan-50 text-emerald-900 dark:border-emerald-500/20 dark:from-emerald-950/50 dark:to-cyan-950/30 dark:text-emerald-50',
              accent: C.emerald,
            },
            {
              label: 'Gate blocks (90d)',
              value: blockedTotal.toLocaleString(),
              hint: `TB ${campus.blockedGateAttemptsBle} · QR ${campus.blockedGateAttemptsQr}`,
              icon: ShieldAlert,
              className:
                'border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-950 dark:border-violet-500/25 dark:from-violet-950/45 dark:to-indigo-950/35 dark:text-violet-100',
              accent: C.violet,
            },
            {
              label: 'Under 75%',
              value: campus.atRiskStudentCount.toLocaleString(),
              hint: 'Approved students on watch list',
              icon: Users,
              className:
                'border-amber-200/80 bg-gradient-to-br from-amber-50 to-rose-50 text-amber-950 dark:border-amber-500/25 dark:from-amber-950/40 dark:to-rose-950/30 dark:text-amber-50',
              accent: C.amber,
            },
            {
              label: 'Ledger rows',
              value: statsList.length.toLocaleString(),
              hint: 'Session stats loaded',
              icon: Activity,
              className:
                'border-sky-200/80 bg-gradient-to-br from-sky-50 to-indigo-50 text-sky-950 dark:border-sky-500/20 dark:from-sky-950/40 dark:to-indigo-950/30 dark:text-sky-50',
              accent: C.sky,
            },
          ].map((k) => (
            <div
              key={k.label}
              className={clsx(
                'relative overflow-hidden rounded-2xl border p-5 shadow-md transition-transform hover:-translate-y-0.5',
                k.className,
              )}
            >
              <div
                className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl"
                style={{ background: k.accent }}
              />
              <k.icon className="relative mb-3 h-6 w-6 opacity-90" style={{ color: k.accent }} aria-hidden />
              <p className="relative text-[10px] font-bold uppercase tracking-widest opacity-80">{k.label}</p>
              <p className="relative mt-1 text-3xl font-bold tabular-nums tracking-tight md:text-[2.15rem]">{k.value}</p>
              <p className="relative mt-2 text-xs leading-snug opacity-80">{k.hint}</p>
            </div>
          ))}
        </section>
      )}

      {campus && gatePieData.length > 0 && (
        <div className={clsx(cardShell, 'flex flex-col items-center justify-center gap-3 py-6 sm:flex-row sm:justify-between sm:px-8')}>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Gate block mix (90 days)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">TB vs QR automated rejections</p>
          </div>
          <div className="h-[140px] w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gatePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={62} paddingAngle={3}>
                  {gatePieData.map((e) => (
                    <Cell key={e.name} fill={e.color} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-slate-600 dark:text-slate-300">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {campus && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className={clsx(cardShell, 'min-h-[320px]')}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Daily attendance trend</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Line + soft area — campus seated rate</p>
              </div>
              <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-200">
                {trendLineData.length} pts
              </span>
            </div>
            <div className="h-[260px]">
              {trendHasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendLineData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id={`${uid}-trendArea`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.indigo} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={C.fuchsia} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id={`${uid}-trendLine`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={C.indigo} />
                        <stop offset="100%" stopColor={C.fuchsia} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} className="dark:opacity-60" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      width={40}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(v) => `${v}%`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => [`${v}%`, 'Attendance']} />
                    <ReferenceLine y={75} stroke={C.emerald} strokeDasharray="6 6" strokeOpacity={0.7} label={{ value: '75%', fill: '#94a3b8', fontSize: 10 }} />
                    <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${uid}-trendArea)`} isAnimationActive={false} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={`url(#${uid}-trendLine)`}
                      strokeWidth={3}
                      dot={{ r: 4, fill: C.indigo, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, fill: C.fuchsia, stroke: '#fff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <BarChart3 className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Not enough trend points yet</p>
                </div>
              )}
            </div>
          </div>

          <div className={clsx(cardShell, 'min-h-[320px]')}>
            <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Weekly participation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Area + line vs 75% target</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleExportTrendPdf()}
                  disabled={!campus || trendExporting !== null}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 cursor-pointer"
                >
                  {trendExporting === 'pdf' ? 'PDF…' : 'Trend PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleExportTrendCsv}
                  disabled={!campus || trendExporting !== null}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 cursor-pointer"
                >
                  {trendExporting === 'csv' ? 'CSV…' : 'Trend CSV'}
                </button>
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={campus.attendanceDecayByWeek} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id={`${uid}-weekFill`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.cyan} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C.violet} stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} className="dark:opacity-50" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    width={40}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number | undefined, _n, p) => [
                      `${v}% · ${p.payload.volumePresent}/${p.payload.volumeEligible} present`,
                      'Rate',
                    ]}
                  />
                  <ReferenceLine y={75} stroke={C.emerald} strokeDasharray="5 5" strokeOpacity={0.85} />
                  <Area type="monotone" dataKey="pct" legendType="none" stroke={C.cyan} strokeWidth={2} fill={`url(#${uid}-weekFill)`} isAnimationActive={false} />
                  <Line type="monotone" dataKey="pct" name="Weekly %" stroke={C.violet} strokeWidth={2.5} dot={{ r: 3, fill: C.violet }} isAnimationActive={false} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {campus && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className={clsx(cardShell)}>
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" aria-hidden />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Watch list (&lt; 75%)</h3>
            </div>
            <div className="max-h-[300px] overflow-auto rounded-xl border border-slate-200/80 dark:border-white/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-gradient-to-r from-amber-100/90 to-rose-100/70 text-xs uppercase tracking-wide text-amber-900/80 dark:from-amber-950/90 dark:to-rose-950/70 dark:text-amber-100/90">
                  <tr>
                    <th className="py-3 pl-4 font-semibold">Student</th>
                    <th className="py-3 px-2 font-semibold">ID</th>
                    <th className="py-3 pr-4 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {campus.atRiskStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        No students under 75% in this scope.
                      </td>
                    </tr>
                  ) : (
                    campus.atRiskStudents.map((s, i) => (
                      <tr
                        key={`${s.studentId}-${s.displayName}`}
                        className={clsx(
                          'border-t border-slate-100 dark:border-white/[0.06]',
                          i % 2 === 0 ? 'bg-white/50 dark:bg-white/[0.02]' : 'bg-amber-50/20 dark:bg-amber-500/[0.04]',
                        )}
                      >
                        <td className="py-2.5 pl-4 font-medium text-slate-900 dark:text-white">{s.displayName}</td>
                        <td className="px-2 font-mono text-xs text-slate-500 dark:text-slate-400">{s.studentId}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold"
                            style={{
                              background: s.attendancePct < 60 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.25)',
                              color: s.attendancePct < 60 ? C.rose : C.amber,
                            }}
                          >
                            {s.attendancePct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={clsx(cardShell)}>
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-cyan-500" aria-hidden />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Traffic heatmap</h3>
            </div>
            {heatMatrix && (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
                <div
                  className="grid gap-px rounded-lg bg-slate-900/5 p-px dark:bg-black/40"
                  style={{
                    gridTemplateColumns: `52px repeat(${heatMatrix.hours.length}, minmax(0,1fr))`,
                  }}
                >
                  <div />
                  {heatMatrix.hours.map((h) => (
                    <div key={h} className="truncate px-0.5 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {h}h
                    </div>
                  ))}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, ri) => (
                    <Fragment key={label}>
                      <div className="flex items-center pl-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
                      {heatMatrix.matrix[ri].map((intensity, ci) => (
                        <div
                          key={`${label}-${heatMatrix.hours[ci]}`}
                          className="aspect-square min-h-[18px] rounded-[3px] ring-1 ring-white/10 transition-transform hover:scale-110 hover:z-10"
                          title={`${label} ${heatMatrix.hours[ci]}:00 — intensity ${intensity.toFixed(2)}`}
                          style={{
                            background: heatColor(intensity, heatMatrix.max),
                          }}
                        />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              Hue shifts from slate → indigo → magenta with volume ({campus.hourRange.start}:00–{campus.hourRange.end}:00).
            </p>
          </div>
        </div>
      )}

      {campus && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className={clsx(cardShell)}>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Rooms: eligible vs checked in</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Horizontal bars — compare capacity vs turnout</p>
            <div className="mt-4 h-[280px]">
              {campus.roomUtilization.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Add rooms on courses or sessions to populate this chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={campus.roomUtilization.map((r) => ({
                      ...r,
                      name: r.room.length > 16 ? `${r.room.slice(0, 16)}…` : r.room,
                    }))}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                  >
                    <defs>
                      <linearGradient id={`${uid}-barEnroll`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#475569" />
                      </linearGradient>
                      <linearGradient id={`${uid}-barCheck`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={C.cyan} />
                        <stop offset="100%" stopColor={C.indigo} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.grid} strokeDasharray="4 6" horizontal strokeOpacity={0.6} vertical={false} />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={84} tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="enrolledTotal" name="Eligible seats" fill={`url(#${uid}-barEnroll)`} radius={[0, 6, 6, 0]} barSize={14} />
                    <Bar dataKey="checkedInTotal" name="Checked in" fill={`url(#${uid}-barCheck)`} radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={clsx(cardShell)}>
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-rose-400" aria-hidden />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Zero-attendance sessions</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Past 60 days — enrolled but no check-ins</p>
            <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {campus.unloggedSessions.length === 0 ? (
                <p className="rounded-xl border border-emerald-200/60 bg-emerald-50/80 py-10 text-center text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
                  All scoped sessions have at least one check-in.
                </p>
              ) : (
                campus.unloggedSessions.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-rose-200/60 bg-gradient-to-r from-rose-50/90 to-amber-50/50 px-4 py-3 dark:border-rose-500/25 dark:from-rose-950/35 dark:to-amber-950/20"
                  >
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{u.title}</p>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {u.courseCode} · {formatSessionDayLabel(u.dateIso)} · {u.lecturerName} · {u.enrolled} enrolled
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <section aria-label="Session ledger" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Session ledger</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Rates and TB / QR / Manual mix per row</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2 py-1 text-violet-800 dark:text-violet-200">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              TB
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/15 px-2 py-1 text-fuchsia-800 dark:text-fuchsia-200">
              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
              QR
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/20 px-2 py-1 text-slate-700 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Manual
            </span>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 shadow-lg dark:border-white/10 dark:from-slate-900/90 dark:to-slate-950/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-cyan-500/10 text-left text-xs uppercase tracking-wide text-slate-600 dark:border-white/10 dark:from-indigo-500/15 dark:via-violet-500/10 dark:to-cyan-500/10 dark:text-slate-300">
                  <th className="px-4 py-3 font-bold">Session / course</th>
                  <th className="px-4 py-3 font-bold">Lecturer</th>
                  <th className="px-4 py-3 text-center font-bold">Present</th>
                  <th className="px-4 py-3 font-bold">Rate</th>
                  <th className="px-4 py-3 text-right font-bold">Methods</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={clsx(
                      'border-b border-slate-100 transition-colors hover:bg-indigo-50/40 dark:border-white/[0.06] dark:hover:bg-indigo-500/[0.06]',
                      idx % 2 === 1 && 'bg-slate-50/50 dark:bg-white/[0.02]',
                    )}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 dark:text-white">{s.title}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Badge color="gray">{s.course.code}</Badge>
                          {format(sessionDate(s), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300">
                      {s.course.lecturer.firstName} {s.course.lecturer.lastName}
                    </td>
                    <td className="px-4 py-3 text-center align-top tabular-nums text-slate-900 dark:text-white">
                      {s.totalCheckedIn}
                      <span className="text-slate-400"> / {s.totalEnrolled}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="h-2.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, s.attendanceRate)}%`,
                              opacity: s.attendanceRate >= 75 ? 1 : 0.9,
                              background:
                                s.attendanceRate >= 75
                                  ? `linear-gradient(90deg, ${C.emerald}, ${C.cyan})`
                                  : `linear-gradient(90deg, ${C.amber}, ${C.rose})`,
                            }}
                          />
                        </div>
                        <span
                          className={clsx(
                            'text-[11px] font-bold tabular-nums',
                            s.attendanceRate >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300',
                          )}
                        >
                          {s.attendanceRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        {s.checkInBreakdown.BLE > 0 && (
                          <span className="rounded-md bg-gradient-to-r from-violet-500/25 to-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-violet-900 dark:text-violet-100">
                            TB {s.checkInBreakdown.BLE}
                          </span>
                        )}
                        {s.checkInBreakdown.QR > 0 && (
                          <span className="rounded-md bg-gradient-to-r from-fuchsia-500/25 to-pink-500/20 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-900 dark:text-fuchsia-100">
                            QR {s.checkInBreakdown.QR}
                          </span>
                        )}
                        {s.checkInBreakdown.MANUAL > 0 && (
                          <span className="rounded-md bg-slate-500/25 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            M {s.checkInBreakdown.MANUAL}
                          </span>
                        )}
                        {s.checkInBreakdown.BLE + s.checkInBreakdown.QR + s.checkInBreakdown.MANUAL === 0 && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !rowsError && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                      <Activity className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                      Nothing matches your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
