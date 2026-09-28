import { useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { FileDown, RefreshCw, Search, Smile, Star, Table2, Users } from 'lucide-react';
import { exportNpsAnalyticsPdf } from '../../lib/adminPdfExport';
import { downloadCsv } from '../../lib/csv';
import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  BarChart,
  Legend,
  Cell,
} from 'recharts';
import type { NpsByLecturerRow, NpsParticipationByGenderRow, School } from '../../types';
import { clsx } from 'clsx';

const DASH_OPTS = { refetchIntervalMs: 60_000, refetchWhenVisible: true } as const;

const C = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  grid: 'rgba(148, 163, 184, 0.22)',
};

const GENDER_COLOR: Record<string, string> = {
  Female: C.rose,
  Male: C.indigo,
  Other: C.violet,
  'Prefer not to say': C.slate,
};

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.92)',
  fontSize: 12,
  color: '#f1f5f9',
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
};

function formatClassDate(iso: string) {
  try {
    const raw = parseISO(iso);
    return Number.isNaN(raw.getTime()) ? iso : format(raw, 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

/**
 * Executive Ed Phase 9 — reads the two NPS-engine analytics endpoints (Phase 6's SQL views) into
 * charts an SBS Program Manager / VC actually cares about: session-level satisfaction by lecturer
 * and participation split by gender, neither of which is a per-student row (both are already
 * aggregated server-side, so nothing here needs Phase 4's demographic masking).
 */
export function NpsAnalyticsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: allSchools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const execEdSchools = useMemo(
    () => (allSchools ?? []).filter((s) => s.features?.execEdSuite),
    [allSchools],
  );
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  // SUPER_ADMIN must explicitly pick one of the execEdSuite schools (the endpoints require an
  // explicit ?schoolId= for that role); every other role is scoped to their own school server-side.
  const schoolId = isSuperAdmin ? selectedSchoolId : '';
  const canQuery = !isSuperAdmin || Boolean(schoolId);
  const qs = schoolId ? `?schoolId=${schoolId}` : '';

  const { data: npsRows, loading: npsLoading, error: npsError, refetch: refetchNps } = useApi<NpsByLecturerRow[]>(
    canQuery ? `/feedback/analytics/nps-by-lecturer${qs}` : null,
    DASH_OPTS,
  );
  const { data: participationRows, loading: partLoading, error: partError, refetch: refetchPart } = useApi<NpsParticipationByGenderRow[]>(
    canQuery ? `/feedback/analytics/participation-by-gender${qs}` : null,
    DASH_OPTS,
  );

  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const nps = npsRows ?? [];
  const participation = participationRows ?? [];

  const filteredNps = useMemo(() => {
    if (!search) return nps;
    const q = search.toLowerCase();
    return nps.filter(
      (r) =>
        r.course_name.toLowerCase().includes(q) ||
        r.course_code.toLowerCase().includes(q) ||
        r.lecturer_name.toLowerCase().includes(q) ||
        r.class_title.toLowerCase().includes(q),
    );
  }, [nps, search]);

  const overallStats = useMemo(() => {
    const rated = nps.filter((r) => r.avg_nps != null && r.response_count > 0);
    const totalResponses = rated.reduce((sum, r) => sum + r.response_count, 0);
    const weightedSum = rated.reduce((sum, r) => sum + (r.avg_nps ?? 0) * r.response_count, 0);
    const overallAvg = totalResponses > 0 ? weightedSum / totalResponses : null;
    const courseCount = new Set(nps.map((r) => r.course_id)).size;
    const sessionCount = new Set(nps.map((r) => r.class_id)).size;
    return { overallAvg, totalResponses, courseCount, sessionCount };
  }, [nps]);

  const npsByCourse = useMemo(() => {
    const groups = new Map<string, { code: string; sum: number; count: number }>();
    for (const r of nps) {
      if (r.avg_nps == null || r.response_count === 0) continue;
      const g = groups.get(r.course_code) ?? { code: r.course_code, sum: 0, count: 0 };
      g.sum += r.avg_nps * r.response_count;
      g.count += r.response_count;
      groups.set(r.course_code, g);
    }
    return Array.from(groups.values())
      .map((g) => ({ course: g.code, avgNps: Math.round((g.sum / g.count) * 10) / 10 }))
      .sort((a, b) => b.avgNps - a.avgNps);
  }, [nps]);

  const participationByCourse = useMemo(() => {
    const groups = new Map<string, Record<string, number | string>>();
    const genders = new Set<string>();
    for (const r of participation) {
      const gender = r.gender ?? 'Not shared';
      genders.add(gender);
      const g = groups.get(r.course_code) ?? { course: r.course_code };
      g[gender] = r.participation_rate_pct;
      groups.set(r.course_code, g);
    }
    return { rows: Array.from(groups.values()), genders: Array.from(genders) };
  }, [participation]);

  async function refreshAll() {
    await Promise.all([refetchNps(), refetchPart()]);
  }

  async function handleExportPdf() {
    setExporting('pdf');
    try {
      await exportNpsAnalyticsPdf(nps, participation);
    } catch {
      window.alert('Could not generate PDF. If this persists, try Chrome or Edge on desktop.');
    } finally {
      setExporting(null);
    }
  }

  function handleExportCsv() {
    setExporting('csv');
    try {
      downloadCsv(
        'tcheck-nps-by-lecturer.csv',
        ['Course', 'Lecturer', 'Session', 'Date', 'Avg NPS', 'Responses'],
        nps.map((r) => [r.course_code, r.lecturer_name, r.class_title, formatClassDate(r.class_date), r.avg_nps, r.response_count]),
      );
    } finally {
      setExporting(null);
    }
  }

  const cardShell =
    'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] p-5 shadow-[var(--app-shadow)] dark:border-white/10 dark:bg-gradient-to-br dark:from-white/[0.07] dark:to-white/[0.02]';

  const loading = npsLoading || partLoading;
  const error = npsError ?? partError;

  return (
    <div className="mx-auto max-w-[1680px] space-y-8 text-[color:var(--app-text)]">
      <header className="relative overflow-hidden rounded-3xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50/80 p-6 shadow-lg shadow-indigo-500/10 dark:border-white/10 dark:from-indigo-950/40 dark:via-slate-950/80 dark:to-fuchsia-950/30 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-500/15" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200">
              <Star size={14} className="text-fuchsia-500 dark:text-fuchsia-300" aria-hidden />
              Executive Ed
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">NPS analytics</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Post-session satisfaction scores and participation split by gender — every student who checked in is prompted once, right after class.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="min-w-[200px] rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-white/15 dark:bg-slate-900/80 dark:text-white"
                aria-label="Select school"
              >
                <option value="">Select a school…</option>
                {execEdSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <Button type="button" variant="secondary" disabled={!canQuery || exporting !== null} onClick={() => void handleExportPdf()} className="gap-2">
              <FileDown size={16} className={exporting === 'pdf' ? 'animate-pulse text-indigo-600' : ''} />
              {exporting === 'pdf' ? 'PDF…' : 'PDF'}
            </Button>
            <Button type="button" variant="secondary" disabled={!canQuery || exporting !== null} onClick={handleExportCsv} className="gap-2">
              <Table2 size={16} />
              {exporting === 'csv' ? 'CSV…' : 'CSV'}
            </Button>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={!canQuery || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white disabled:opacity-50 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-500' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {isSuperAdmin && !schoolId && (
        <div className={clsx(cardShell, 'text-center text-sm text-slate-500 dark:text-slate-400')}>
          {execEdSchools.length === 0
            ? 'No school has Executive Ed enabled yet — turn it on under Settings to see NPS analytics.'
            : 'Pick a school above to load its NPS analytics.'}
        </div>
      )}

      {error && (
        <div className={clsx(cardShell, 'flex flex-col gap-3 border-rose-500/35 bg-gradient-to-r from-rose-500/12 to-amber-500/10 sm:flex-row sm:items-center sm:justify-between')}>
          <p className="text-sm text-rose-900 dark:text-rose-100/90">{error}</p>
          <button type="button" onClick={() => void refreshAll()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 hover:opacity-95">
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {canQuery && (
        <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Overall NPS',
              value: overallStats.overallAvg == null ? '—' : overallStats.overallAvg.toFixed(1),
              hint: 'Weighted by response count',
              icon: Star,
              className: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-cyan-50 text-emerald-900 dark:border-emerald-500/20 dark:from-emerald-950/50 dark:to-cyan-950/30 dark:text-emerald-50',
              accent: C.emerald,
            },
            {
              label: 'Responses',
              value: overallStats.totalResponses.toLocaleString(),
              hint: `${overallStats.sessionCount} sessions rated`,
              icon: Smile,
              className: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-950 dark:border-violet-500/25 dark:from-violet-950/45 dark:to-indigo-950/35 dark:text-violet-100',
              accent: C.violet,
            },
            {
              label: 'Courses covered',
              value: overallStats.courseCount.toLocaleString(),
              hint: 'With at least one rated session',
              icon: Users,
              className: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-rose-50 text-amber-950 dark:border-amber-500/25 dark:from-amber-950/40 dark:to-rose-950/30 dark:text-amber-50',
              accent: C.amber,
            },
            {
              label: 'Ledger rows',
              value: nps.length.toLocaleString(),
              hint: 'Session rows loaded',
              icon: Table2,
              className: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-indigo-50 text-sky-950 dark:border-sky-500/20 dark:from-sky-950/40 dark:to-indigo-950/30 dark:text-sky-50',
              accent: C.cyan,
            },
          ].map((k) => (
            <div key={k.label} className={clsx('relative overflow-hidden rounded-2xl border p-5 shadow-md transition-transform hover:-translate-y-0.5', k.className)}>
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl" style={{ background: k.accent }} />
              <k.icon className="relative mb-3 h-6 w-6 opacity-90" style={{ color: k.accent }} aria-hidden />
              <p className="relative text-[10px] font-bold uppercase tracking-widest opacity-80">{k.label}</p>
              <p className="relative mt-1 text-3xl font-bold tabular-nums tracking-tight md:text-[2.15rem]">{k.value}</p>
              <p className="relative mt-2 text-xs leading-snug opacity-80">{k.hint}</p>
            </div>
          ))}
        </section>
      )}

      {canQuery && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className={clsx(cardShell, 'min-h-[320px]')}>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Average NPS by course</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Weighted by response count, 0–10 scale</p>
            <div className="mt-4 h-[260px]">
              {npsByCourse.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={npsByCourse} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="course" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} width={30} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => [v, 'Avg NPS']} />
                    <Bar dataKey="avgNps" radius={[6, 6, 0, 0]}>
                      {npsByCourse.map((d) => (
                        <Cell key={d.course} fill={d.avgNps >= 8 ? C.emerald : d.avgNps >= 6 ? C.amber : C.rose} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <Star className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No ratings yet</p>
                </div>
              )}
            </div>
          </div>

          <div className={clsx(cardShell, 'min-h-[320px]')}>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Participation by gender</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Present check-ins ÷ possible check-ins, per course</p>
            <div className="mt-4 h-[260px]">
              {participationByCourse.rows.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={participationByCourse.rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="course" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} width={36} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => [`${v}%`, 'Participation']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {participationByCourse.genders.map((g) => (
                      <Bar key={g} dataKey={g} name={g} fill={GENDER_COLOR[g] ?? C.slate} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <Users className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No participation data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {canQuery && (
        <section aria-label="Session ledger" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-white/10">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Session ledger</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Every session with at least one submitted rating</p>
            </div>
            <div className="relative min-w-[220px]">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search course, lecturer, session…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm dark:border-white/15 dark:bg-slate-900/80 dark:text-white"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 shadow-lg dark:border-white/10 dark:from-slate-900/90 dark:to-slate-950/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-cyan-500/10 text-left text-xs uppercase tracking-wide text-slate-600 dark:border-white/10 dark:from-indigo-500/15 dark:via-violet-500/10 dark:to-cyan-500/10 dark:text-slate-300">
                    <th className="px-4 py-3 font-bold">Course</th>
                    <th className="px-4 py-3 font-bold">Lecturer</th>
                    <th className="px-4 py-3 font-bold">Session</th>
                    <th className="px-4 py-3 font-bold">Date</th>
                    <th className="px-4 py-3 text-right font-bold">Avg NPS</th>
                    <th className="px-4 py-3 text-right font-bold">Responses</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNps.map((r, idx) => (
                    <tr
                      key={r.class_id}
                      className={clsx(
                        'border-b border-slate-100 dark:border-white/[0.06]',
                        idx % 2 === 1 && 'bg-slate-50/50 dark:bg-white/[0.02]',
                      )}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{r.course_code}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.lecturer_name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.class_title}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatClassDate(r.class_date)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={{
                            background: r.avg_nps == null ? 'rgba(148, 163, 184, 0.2)' : r.avg_nps >= 8 ? 'rgba(16, 185, 129, 0.18)' : r.avg_nps >= 6 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                            color: r.avg_nps == null ? C.slate : r.avg_nps >= 8 ? C.emerald : r.avg_nps >= 6 ? C.amber : C.rose,
                          }}
                        >
                          {r.avg_nps == null ? '—' : r.avg_nps.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.response_count}</td>
                    </tr>
                  ))}
                  {filteredNps.length === 0 && !error && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                        <Star className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                        {nps.length === 0 ? 'No sessions rated yet.' : 'Nothing matches your search.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
