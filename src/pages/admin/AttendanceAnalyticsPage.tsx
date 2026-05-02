import { Fragment, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  BarChart3,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Activity,
  Users,
  Building2,
  FileDown,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { exportCampusAnalyticsPdf } from '../../lib/adminPdfExport';
import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';
import type { CampusAnalytics, ClassAttendanceStat } from '../../types';

const DASH_OPTS = { refetchIntervalMs: 60_000, refetchWhenVisible: true } as const;

const BLUE = '#5b7194';
const BLUE_DIM = '#3f4f66';
const AMBER = '#b45309';
const GREEN_MUTED = '#5f7d63';
const CHART_GRID = '#334155';

function sessionDate(d: ClassAttendanceStat) {
  try {
    const raw = typeof d.date === 'string' ? parseISO(d.date) : new Date(d.date);
    return Number.isNaN(raw.getTime()) ? new Date(d.date) : raw;
  } catch {
    return new Date(d.date);
  }
}

function ChartLegendPills({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3" role="list" aria-label="Chart legend">
      {items.map((it) => (
        <span
          key={it.label}
          role="listitem"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300 dark:border-slate-700/80 dark:bg-slate-950/50"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function MatteCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

export function AttendanceAnalyticsPage() {
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

  const blockedTotal = campus ? campus.blockedGateAttemptsBle + campus.blockedGateAttemptsQr : 0;

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
    return { matrix, hours };
  }, [campus]);

  const showInitialSpinner = (!campus && campusLoading && !campusError) || (!statsList.length && rowsLoading && !rowsError);

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

  if (showInitialSpinner) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-white/15 dark:border-t-slate-300" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1640px] space-y-6 text-[color:var(--app-text)]">
      {(campusError || rowsError) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 dark:border-amber-800/50 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900 dark:text-amber-100/90">
            {campusError ?? rowsError}
          </p>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 md:text-3xl">
            Campus analytics
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            High-density matte board for leadership reviews. Figures use enrolled seats, attendance records, and gated
            check-in attempts from the API (last 90 days for gate blocks).
            {campus?.fetchedAtIso && (
              <span className="ml-1 text-slate-500 dark:text-slate-500">
                Updated {format(parseISO(campus.fetchedAtIso), 'MMM d · h:mm a')}
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
            className="gap-2"
          >
            <FileDown size={16} className={pdfExporting ? 'animate-pulse' : ''} />
            {pdfExporting ? 'Building PDF…' : 'Download PDF'}
          </Button>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="min-w-[150px] appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950"
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
              placeholder="Find a session..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={campusLoading || rowsLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900/70"
          >
            <RefreshCw size={16} className={(campusLoading || rowsLoading) ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Row 1 — KPI pulse (33/33/33 → 12 columns) */}
      {campus && (
        <section aria-label="The campus pulse">
          <div className="grid grid-cols-12 gap-4">
            <MatteCard className="col-span-12 flex flex-col lg:col-span-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
                Overall campus attendance
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-6">
                <p className="text-6xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-50 md:text-[4.25rem]">
                  {campus.overallAttendancePct}
                  <span className="text-3xl text-slate-400">%</span>
                </p>
                <div className="mt-4 h-[52px] w-[160px] min-w-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={campus.overallTrendSparkline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <ChartLegendPills items={[{ color: BLUE, label: `Blue line · daily seated rate (${campus.overallTrendSparkline.length} points)` }]} />
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                Weighted by enrolled seats across {campus.sessionCount} sessions in scope.
              </p>
            </MatteCard>

            <MatteCard className="col-span-12 lg:col-span-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
                Automated gate blocks
              </p>
              <p className="mt-3 text-6xl font-semibold tabular-nums text-slate-900 dark:text-slate-50 md:text-[4.25rem]">
                {blockedTotal.toLocaleString()}
              </p>
              <ChartLegendPills
                items={[
                  { color: BLUE_DIM, label: `BLE rejects · ${campus.blockedGateAttemptsBle}` },
                  { color: BLUE, label: `QR rejects · ${campus.blockedGateAttemptsQr}` },
                ]}
              />
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                Failed proximity / beacon / QR / window checks retained for auditing (ninety‑day rolling window).
              </p>
            </MatteCard>

            <MatteCard className="col-span-12 lg:col-span-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
                    Below 75% threshold
                  </p>
                  <p className="mt-3 text-6xl font-semibold tabular-nums text-slate-900 dark:text-slate-50 md:text-[4.25rem]">
                    {campus.atRiskStudentCount.toLocaleString()}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                    Approved students rostered across the school scope with cumulative attendance strictly under 75%.
                  </p>
                </div>
                <Users className="h-10 w-10 shrink-0 text-slate-300 dark:text-slate-700" aria-hidden />
              </div>
            </MatteCard>
          </div>
        </section>
      )}

      {/* Row 2 — retention */}
      {campus && (
        <section aria-label="Student retention metrics" className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Student retention metrics
          </h2>
          <div className="grid grid-cols-12 gap-4">
            <MatteCard className="col-span-12 lg:col-span-6">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Attendance participation by week</h3>
                <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Buckets are chronological from the earliest session in your data (up to twelve weeks). Fill shows volume
                under the curve.
              </p>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={campus.attendanceDecayByWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="decayFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={BLUE} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 6" vertical={false} strokeOpacity={0.09} />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #334155',
                        background: '#0f172a',
                        fontSize: 12,
                      }}
                      formatter={(v: number | undefined, _n, props) => [
                        `${v}% · ${props.payload.volumePresent}/${props.payload.volumeEligible} present`,
                        'Rate',
                      ]}
                    />
                    <Area type="monotone" dataKey="pct" stroke={BLUE} strokeWidth={2} fill="url(#decayFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <ChartLegendPills
                items={[
                  { color: BLUE, label: 'Blue outline & fill · seated rate per week bucket' },
                  { color: GREEN_MUTED, label: `Muted green accent · institutional target corridor (manual: 75%+)` },
                ]}
              />
            </MatteCard>

            <MatteCard className="col-span-12 flex flex-col lg:col-span-6">
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-600" aria-hidden />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">75% watch list</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Top students under 75% (from backend roster maths). Rows use matte amber accents when far from the barrier.
              </p>
              <div className="mt-4 max-h-[300px] flex-1 overflow-auto rounded-xl border border-slate-100 dark:border-slate-900/70">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-[1] bg-slate-100/95 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/95 dark:text-slate-400">
                    <tr>
                      <th className="py-3 pl-4 pr-2 font-medium">Student</th>
                      <th className="py-3 px-2 font-medium">ID</th>
                      <th className="py-3 pl-2 pr-4 font-medium text-right">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campus.atRiskStudents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                          Nobody under 75% with recorded history.
                        </td>
                      </tr>
                    ) : (
                      campus.atRiskStudents.map((s) => (
                        <tr
                          key={`${s.studentId}-${s.displayName}`}
                          className="border-t border-slate-100 hover:bg-slate-50 dark:border-white/[0.04] dark:hover:bg-slate-900/35"
                        >
                          <td className="py-2.5 pl-4 font-medium text-slate-900 dark:text-slate-100">{s.displayName}</td>
                          <td className="py-2.5 px-2 font-mono text-xs text-slate-500">{s.studentId}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.attendancePct < 60 ? 'bg-red-950/40 text-red-200' : ''} ${s.attendancePct >= 60 && s.attendancePct < 75 ? `bg-opacity-70` : ''} `}
                              style={
                                s.attendancePct >= 60 && s.attendancePct < 75 ? { background: `${AMBER}22`, color: AMBER } : undefined
                              }
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
            </MatteCard>
          </div>
        </section>
      )}

      {/* Row 3 — operations */}
      {campus && heatMatrix && (
        <section aria-label="Operations and compliance" className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Operations & compliance
          </h2>
          <div className="grid grid-cols-12 gap-4">
            {/* Heatmap */}
            <MatteCard className="col-span-12 lg:col-span-4 overflow-x-auto">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" aria-hidden />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Traffic by weekday & hour</h3>
              </div>
              <ChartLegendPills items={[{ color: BLUE, label: `Deeper blue tiles · greater check‑in volume (max ${campus.trafficHeatmapMax})` }]} />
              <div className="mt-4 min-w-[360px]">
                <div
                  className="grid gap-px overflow-hidden rounded-lg border border-slate-700/40 bg-slate-800/30 p-px"
                  style={{
                    gridTemplateColumns: `64px repeat(${heatMatrix.hours.length}, minmax(0,1fr))`,
                  }}
                >
                  <div />
                  {heatMatrix.hours.map((h) => (
                    <div key={h} className="truncate px-0.5 text-center text-[10px] text-slate-500">
                      {h}h
                    </div>
                  ))}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, ri) => (
                    <Fragment key={label}>
                      <div className="flex items-center pl-2 text-[11px] font-medium text-slate-400">{label}</div>
                      {heatMatrix.matrix[ri].map((intensity, ci) => (
                        <div
                          key={`${label}-${heatMatrix.hours[ci]}`}
                          className="aspect-square min-h-[18px]"
                          title={`${label} · ${heatMatrix.hours[ci]}:00`}
                          style={{
                            background: `rgba(91, 113, 148, ${0.06 + intensity * 0.85})`,
                          }}
                        />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Built from summed check‑ins per weekday & start hour ({campus.hourRange.start}:00–{campus.hourRange.end}:00).
              </p>
            </MatteCard>

            {/* Room grouped bars */}
            <MatteCard className="col-span-12 lg:col-span-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enrollment vs turnout by room</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                “Capacity” proxies from enrolled seats; present counts are cumulative check‑ins logged for that venue.
              </p>
              <div className="mt-5 h-[300px]">
                {campus.roomUtilization.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Assign rooms on courses/sessions for richer optics.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campus.roomUtilization.map((r) => ({ ...r, name: r.room.length > 12 ? `${r.room.slice(0, 12)}…` : r.room }))} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 6" horizontal strokeOpacity={0.07} vertical={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#cbd5f5', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          background: '#0f172a',
                          border: '1px solid #334155',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="enrolledTotal" fill="#475569" name="Eligible seats" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="checkedInTotal" fill={BLUE} name="Checked in" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <ChartLegendPills
                items={[
                  { color: '#475569', label: 'Slate bars · cumulative enrolled seats' },
                  { color: BLUE, label: `Blue bars · cumulative check‑ins (${GREEN_MUTED}: reference line on table cards elsewhere)` },
                ]}
              />
            </MatteCard>

            {/* Faculty / unlogged */}
            <MatteCard className="col-span-12 flex flex-col lg:col-span-4">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" aria-hidden />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Zero-attendance sessions</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Past sessions within 60 days with enrollments yet no recorded attendance — escalate with faculty.
              </p>
              <div className="mt-4 max-h-[300px] flex-1 space-y-2 overflow-y-auto pr-1">
                {campus.unloggedSessions.length === 0 ? (
                  <p className="py-12 text-center text-sm text-emerald-800/90 dark:text-emerald-400/90">Everything has at least one check‑in ✓</p>
                ) : (
                  campus.unloggedSessions.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-xl border border-slate-700/60 bg-slate-900/30 px-3 py-2 text-[13px] dark:border-slate-800"
                    >
                      <p className="font-semibold text-slate-100">{u.title}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {u.courseCode} · {format(parseISO(`${u.dateIso}T12:00:00`), 'MMM d, yyyy')} · {u.lecturerName}{' '}
                        · enrolled {u.enrolled}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </MatteCard>
          </div>
        </section>
      )}

      {/* Detailed session ledger */}
      <section aria-label="Detailed session ledger" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Session ledger</h2>
          <ChartLegendPills
            items={[
              { color: BLUE_DIM, label: 'BLE beacon check-ins (badge violet in table)' },
              { color: '#7c6994', label: 'QR scans' },
              { color: '#64748b', label: 'Manual admin overrides' },
            ]}
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Session / course</th>
                  <th className="px-4 py-3 font-semibold">Lecturer</th>
                  <th className="px-4 py-3 text-center font-semibold">Attendance</th>
                  <th className="px-4 py-3 font-semibold">Rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Methods</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-white/[0.06] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900 dark:text-white">{s.title}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Badge color="gray">{s.course.code}</Badge>
                          {format(sessionDate(s), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                      {s.course.lecturer.firstName} {s.course.lecturer.lastName}
                    </td>
                    <td className="px-4 py-3 text-center align-top tabular-nums text-slate-900 dark:text-white">
                      {s.totalCheckedIn}
                      <span className="text-slate-400"> / {s.totalEnrolled}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, s.attendanceRate)}%`,
                              background: s.attendanceRate >= 75 ? GREEN_MUTED : AMBER,
                            }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            s.attendanceRate >= 75 ? 'text-emerald-800 dark:text-emerald-400/90' : ''
                          }`}
                          style={s.attendanceRate < 75 ? { color: AMBER } : undefined}
                        >
                          {s.attendanceRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        {s.checkInBreakdown.BLE > 0 && (
                          <span className="rounded-md bg-[#473c6b]/55 px-2 py-0.5 text-[11px] text-violet-200">BLE {s.checkInBreakdown.BLE}</span>
                        )}
                        {s.checkInBreakdown.QR > 0 && (
                          <span className="rounded-md bg-[#55445f]/55 px-2 py-0.5 text-[11px] text-purple-100">QR {s.checkInBreakdown.QR}</span>
                        )}
                        {s.checkInBreakdown.MANUAL > 0 && (
                          <span className="rounded-md bg-slate-700/55 px-2 py-0.5 text-[11px] text-slate-200">M {s.checkInBreakdown.MANUAL}</span>
                        )}
                        {s.checkInBreakdown.BLE + s.checkInBreakdown.QR + s.checkInBreakdown.MANUAL === 0 && (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !rowsError && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                      <Activity className="mx-auto mb-3 h-10 w-10 opacity-40" aria-hidden />
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
