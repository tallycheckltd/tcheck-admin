import { Fragment, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import {
  Activity,
  Building2,
  FileDown,
  RefreshCw,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LineChartCard } from '../../components/charts/LineChartCard';
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
} from 'recharts';
import type { CampusAnalytics, ClassAttendanceStat } from '../../types';
import { clsx } from 'clsx';

const DASH_OPTS = { refetchIntervalMs: 60_000, refetchWhenVisible: true } as const;

const CHART_BLUE = '#3b82f6';
const CHART_GRID = 'rgba(148, 163, 184, 0.25)';
const AMBER = '#b45309';
const GREEN = '#059669';

function sessionDate(d: ClassAttendanceStat) {
  try {
    const raw = typeof d.date === 'string' ? parseISO(d.date) : new Date(d.date);
    return Number.isNaN(raw.getTime()) ? new Date(d.date) : raw;
  } catch {
    return new Date(d.date);
  }
}

/** `dateIso` from API may be `YYYY-MM-DD` or full ISO. */
function formatSessionDayLabel(dateIso: string) {
  if (!dateIso) return '—';
  const raw =
    dateIso.length >= 10 && dateIso[10] === 'T' ? parseISO(dateIso) : parseISO(`${dateIso}T12:00:00`);
  if (Number.isNaN(raw.getTime())) return dateIso;
  return format(raw, 'MMM d, yyyy');
}

const cardClass =
  'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] p-5 shadow-[var(--app-shadow)] dark:bg-white/[0.04] dark:border-white/10';

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

  const trendLineData = useMemo(() => {
    if (!campus?.overallTrendSparkline?.length) return [];
    return campus.overallTrendSparkline.map((p) => ({ date: p.label, value: p.value }));
  }, [campus]);

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

  if (showInitialSpinner) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-blue-600 dark:border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 text-[color:var(--app-text)]">
      {(campusError || rowsError) && (
        <div
          className={clsx(
            cardClass,
            'flex flex-col gap-3 border-amber-500/30 bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between',
          )}
        >
          <p className="text-sm text-amber-950 dark:text-amber-100/90">{campusError ?? rowsError}</p>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--app-text)] md:text-3xl">Attendance analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--app-text-muted)]">
            Live campus metrics, gate telemetry, and session ledger. Refreshes while this tab is open.
            {campus?.fetchedAtIso && (
              <span className="ml-1 text-[var(--app-text-muted)]">
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
            className="gap-2"
          >
            <FileDown size={16} className={pdfExporting ? 'animate-pulse' : ''} />
            {pdfExporting ? 'PDF…' : 'Download PDF'}
          </Button>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="min-w-[140px] rounded-xl border border-[var(--app-border)] bg-[var(--app-elevated-solid)] px-3 py-2.5 text-sm text-[var(--app-text)] dark:bg-white/5"
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
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input
              type="search"
              placeholder="Search session or course…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-elevated-solid)] py-2.5 pl-9 pr-3 text-sm text-[var(--app-text)] dark:bg-white/5"
            />
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={campusLoading || rowsLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-sm text-[var(--app-text-secondary)] hover:bg-[var(--nav-hover-bg)] disabled:opacity-50"
          >
            <RefreshCw size={16} className={campusLoading || rowsLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {campus && (
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Campus attendance', value: `${campus.overallAttendancePct}%`, hint: `${campus.sessionCount} sessions` },
            { label: 'Gate blocks (90d)', value: blockedTotal.toLocaleString(), hint: `BLE ${campus.blockedGateAttemptsBle} · QR ${campus.blockedGateAttemptsQr}` },
            { label: 'Under 75%', value: campus.atRiskStudentCount.toLocaleString(), hint: 'Approved students' },
            { label: 'Sessions in ledger', value: statsList.length.toLocaleString(), hint: 'All classes in scope' },
          ].map((k) => (
            <div key={k.label} className={cardClass}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">{k.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--app-text)] md:text-3xl">{k.value}</p>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">{k.hint}</p>
            </div>
          ))}
        </section>
      )}

      {campus && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LineChartCard title="Attendance trend (daily)" data={trendLineData} color={CHART_BLUE} />
          <div className={cardClass}>
            <h3 className="mb-1 text-sm font-semibold text-[var(--app-text)]">Participation by week</h3>
            <p className="mb-4 text-xs text-[var(--app-text-muted)]">Seated rate per week from roster-backed maths.</p>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={campus.attendanceDecayByWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weekFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_BLUE} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_BLUE} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    width={36}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-elevated-solid)',
                      fontSize: 12,
                    }}
                    formatter={(v: number | undefined, _n, p) => [
                      `${v}% · ${p.payload.volumePresent}/${p.payload.volumeEligible} present`,
                      'Rate',
                    ]}
                  />
                  <Area type="monotone" dataKey="pct" stroke={CHART_BLUE} strokeWidth={2} fill="url(#weekFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {campus && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
              <h3 className="text-sm font-semibold text-[var(--app-text)]">Watch list (&lt; 75%)</h3>
            </div>
            <div className="max-h-[280px] overflow-auto rounded-xl border border-[var(--app-border-soft)] dark:border-white/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-[var(--app-surface-muted)] text-xs uppercase tracking-wide text-[var(--app-text-muted)] dark:bg-white/10">
                  <tr>
                    <th className="py-2.5 pl-3 font-medium">Student</th>
                    <th className="py-2.5 px-2 font-medium">ID</th>
                    <th className="py-2.5 pr-3 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {campus.atRiskStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-[var(--app-text-muted)]">
                        No students under 75% in this scope.
                      </td>
                    </tr>
                  ) : (
                    campus.atRiskStudents.map((s) => (
                      <tr
                        key={`${s.studentId}-${s.displayName}`}
                        className="border-t border-[var(--app-border-soft)] hover:bg-[var(--nav-hover-bg)] dark:border-white/10"
                      >
                        <td className="py-2 pl-3 font-medium text-[var(--app-text)]">{s.displayName}</td>
                        <td className="px-2 font-mono text-xs text-[var(--app-text-muted)]">{s.studentId}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{
                              background: s.attendancePct < 60 ? 'rgba(220, 38, 38, 0.15)' : `${AMBER}22`,
                              color: s.attendancePct < 60 ? '#b91c1c' : AMBER,
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

          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[var(--app-text-muted)]" aria-hidden />
              <h3 className="text-sm font-semibold text-[var(--app-text)]">Check-ins by weekday & hour</h3>
            </div>
            {heatMatrix && (
              <div className="overflow-x-auto">
                <div
                  className="grid gap-px rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-px dark:border-white/10"
                  style={{
                    gridTemplateColumns: `56px repeat(${heatMatrix.hours.length}, minmax(0,1fr))`,
                  }}
                >
                  <div />
                  {heatMatrix.hours.map((h) => (
                    <div key={h} className="truncate px-0.5 text-center text-[10px] text-[var(--app-text-muted)]">
                      {h}h
                    </div>
                  ))}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, ri) => (
                    <Fragment key={label}>
                      <div className="flex items-center pl-2 text-[11px] font-medium text-[var(--app-text-muted)]">{label}</div>
                      {heatMatrix.matrix[ri].map((intensity, ci) => (
                        <div
                          key={`${label}-${heatMatrix.hours[ci]}`}
                          className="aspect-square min-h-[16px]"
                          title={`${label} ${heatMatrix.hours[ci]}:00`}
                          style={{
                            background: `rgba(59, 130, 246, ${0.05 + intensity * 0.88})`,
                          }}
                        />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] text-[var(--app-text-muted)]">
              Volume by session start hour ({campus.hourRange.start}:00–{campus.hourRange.end}:00).
            </p>
          </div>
        </div>
      )}

      {campus && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <h3 className="text-sm font-semibold text-[var(--app-text)]">Enrollment vs turnout by room</h3>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">Eligible seats vs check-ins per venue.</p>
            <div className="mt-4 h-[260px]">
              {campus.roomUtilization.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--app-text-muted)]">
                  Add rooms on courses or sessions to see this chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={campus.roomUtilization.map((r) => ({
                      ...r,
                      name: r.room.length > 14 ? `${r.room.slice(0, 14)}…` : r.room,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 6" horizontal strokeOpacity={0.5} vertical={false} />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        background: 'var(--app-elevated-solid)',
                        border: '1px solid var(--app-border)',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="enrolledTotal" fill="#64748b" name="Eligible" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="checkedInTotal" fill={CHART_BLUE} name="Checked in" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--app-text-muted)]" aria-hidden />
              <h3 className="text-sm font-semibold text-[var(--app-text)]">Zero-attendance sessions</h3>
            </div>
            <p className="text-xs text-[var(--app-text-muted)]">Past 60 days: enrolled but no check-ins logged.</p>
            <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {campus.unloggedSessions.length === 0 ? (
                <p className="py-10 text-center text-sm text-emerald-700 dark:text-emerald-400/90">All scoped sessions have check-ins.</p>
              ) : (
                campus.unloggedSessions.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] px-3 py-2 dark:border-white/10"
                  >
                    <p className="text-sm font-semibold text-[var(--app-text)]">{u.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                      {u.courseCode} · {formatSessionDayLabel(u.dateIso)} · {u.lecturerName} · {u.enrolled} enrolled
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <section aria-label="Session ledger" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Session ledger</h2>
          <p className="text-xs text-[var(--app-text-muted)]">BLE / QR / Manual counts from live records.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] shadow-[var(--app-shadow)] dark:border-white/10 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--app-text-muted)] dark:border-white/10">
                  <th className="px-4 py-3 font-semibold">Session / course</th>
                  <th className="px-4 py-3 font-semibold">Lecturer</th>
                  <th className="px-4 py-3 text-center font-semibold">Present</th>
                  <th className="px-4 py-3 font-semibold">Rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Methods</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--app-border-soft)] transition-colors hover:bg-[var(--nav-hover-bg)] dark:border-white/10"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-[var(--app-text)]">{s.title}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                          <Badge color="gray">{s.course.code}</Badge>
                          {format(sessionDate(s), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-[var(--app-text-secondary)]">
                      {s.course.lecturer.firstName} {s.course.lecturer.lastName}
                    </td>
                    <td className="px-4 py-3 text-center align-top tabular-nums text-[var(--app-text)]">
                      {s.totalCheckedIn}
                      <span className="text-[var(--app-text-muted)]"> / {s.totalEnrolled}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--app-surface-muted)] dark:bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, s.attendanceRate)}%`,
                              background: s.attendanceRate >= 75 ? GREEN : AMBER,
                            }}
                          />
                        </div>
                        <span
                          className={clsx(
                            'text-[11px] font-semibold tabular-nums',
                            s.attendanceRate >= 75 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300',
                          )}
                        >
                          {s.attendanceRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        {s.checkInBreakdown.BLE > 0 && (
                          <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] text-violet-800 dark:text-violet-200">
                            BLE {s.checkInBreakdown.BLE}
                          </span>
                        )}
                        {s.checkInBreakdown.QR > 0 && (
                          <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[11px] text-purple-800 dark:text-purple-200">
                            QR {s.checkInBreakdown.QR}
                          </span>
                        )}
                        {s.checkInBreakdown.MANUAL > 0 && (
                          <span className="rounded-md bg-slate-500/25 px-2 py-0.5 text-[11px] text-[var(--app-text-secondary)]">
                            M {s.checkInBreakdown.MANUAL}
                          </span>
                        )}
                        {s.checkInBreakdown.BLE + s.checkInBreakdown.QR + s.checkInBreakdown.MANUAL === 0 && (
                          <span className="text-xs text-[var(--app-text-muted)]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !rowsError && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-[var(--app-text-muted)]">
                      <Activity className="mx-auto mb-2 h-9 w-9 opacity-40" aria-hidden />
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
