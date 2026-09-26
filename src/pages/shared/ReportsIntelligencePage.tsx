import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileDown, Lock, Table2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { OverviewReport, ProgrammeReport, ReportAttendance, ReportFeedback, ReportCampaigns, School, SessionReport } from '../../types';
import { dayLabel, overviewCsv, overviewPdf, periodLabel, programmeCsv, programmePdf, rate, score } from '../../lib/reportsExport';

/**
 * SBS Phase 6 — Reports & Executive Intelligence: Overview → Programme → Session, all from
 * /reports/* (role-scoped server-side, the same scope as Feedback Intelligence). Every figure
 * shows its numerator/denominator; feedback is anonymous and withheld below 3 responses; the only
 * "areas to review" are sessions/programmes under the school's configured attendance threshold.
 * Filters live in the URL, so back/forward and shared links keep the view.
 */

const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const PRESETS = [
  { key: 'week', label: 'This week', range: () => { const t = new Date(); const monday = addDays(t, -((t.getDay() + 6) % 7)); return [localYmd(monday), localYmd(t)]; } },
  { key: 'month', label: 'This month', range: () => { const t = new Date(); return [localYmd(new Date(t.getFullYear(), t.getMonth(), 1)), localYmd(t)]; } },
  { key: '30', label: 'Last 30 days', range: () => { const t = new Date(); return [localYmd(addDays(t, -29)), localYmd(t)]; } },
  { key: '90', label: 'Last 90 days', range: () => { const t = new Date(); return [localYmd(addDays(t, -89)), localYmd(t)]; } },
] as const;

const ROSTER_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'SCHOOL_ADMIN', 'LECTURER'];

function Figure({ label, value, basis, delta, emphasis }: { label: string; value: string; basis: string; delta?: string | null; emphasis?: boolean }) {
  return (
    <div className="py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
      <p className={clsx('font-semibold tabular-nums text-slate-950 dark:text-white mt-1 leading-none', emphasis ? 'text-5xl' : 'text-3xl')}>{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 tabular-nums">{basis}</p>
      {delta && <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">{delta}</p>}
    </div>
  );
}

/** "↑ 2.1 points vs the previous 30 days" — only when both sides exist. */
function deltaText(cur: number | null, prev: number | null | undefined, unit: 'pts' | 'score', days: number): string | null {
  if (cur == null || prev == null) return null;
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return `Unchanged vs the previous ${days} days`;
  return `${d > 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}${unit === 'pts' ? ' points' : ''} vs the previous ${days} days`;
}

function Heading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 dark:border-white/10 pb-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{children}</h2>
      {right}
    </div>
  );
}

function Headline({ a, prev, f, c, days }: { a: ReportAttendance; prev?: ReportAttendance | null; f: ReportFeedback; c: ReportCampaigns; days: number }) {
  const fc = f.current;
  return (
    <section aria-label="Headline figures" className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-gray-100 dark:divide-white/10">
      <Figure emphasis label="Attendance" value={rate(a.attendanceRate)} basis={`${a.present} of ${a.expected} expected · ${a.sessions} session${a.sessions === 1 ? '' : 's'}`} delta={deltaText(a.attendanceRate, prev?.attendanceRate, 'pts', days)} />
      <Figure label="On-time arrival" value={rate(a.onTimeRate)} basis={`${a.onTime} of ${a.onTime + a.late + a.extremelyLate} · ${a.late} late, ${a.extremelyLate} very late`} delta={deltaText(a.onTimeRate, prev?.onTimeRate, 'pts', days)} />
      <Figure label="Check-out completion" value={rate(a.checkOutRate)} basis={`${a.checkedOut} of ${a.checkedOut + a.missingCheckOut} due · ${a.missingCheckOut} missing`} delta={deltaText(a.checkOutRate, prev?.checkOutRate, 'pts', days)} />
      <Figure label="Session feedback"
        value={fc?.overall.average == null ? (fc && fc.responses > 0 ? 'Withheld' : '—') : score(fc.overall.average)}
        basis={fc ? `${fc.responses} response${fc.responses === 1 ? '' : 's'} · ${rate(fc.responseRate)} response rate` : 'No sessions with feedback open'}
        delta={deltaText(fc?.overall.average ?? null, f.previous?.overall.average, 'score', days)} />
      <Figure label="Campaign response" value={rate(c.responseRate)} basis={`${c.responses} of ${c.recipients} delegates · ${c.campaigns} campaign${c.campaigns === 1 ? '' : 's'} sent`} />
      <Figure label="Rejected check-in attempts" value={String(a.rejected)} basis="Failed identity checks — never counted as attendance" delta={prev ? `${prev.rejected} in the previous ${days} days` : null} />
    </section>
  );
}

function RateCell({ a, threshold }: { a: ReportAttendance; threshold: number }) {
  const low = a.attendanceRate != null && a.attendanceRate < threshold;
  return (
    <td className="py-3 pr-4 text-right tabular-nums">
      <span className={clsx('font-semibold', low ? 'text-amber-700 dark:text-amber-300' : 'text-slate-950 dark:text-white')}>{rate(a.attendanceRate)}</span>
      {low && <span className="block text-[11px] text-amber-700 dark:text-amber-300">Below {threshold}%</span>}
      <span className="block text-xs text-slate-500 dark:text-slate-400">{a.present} / {a.expected}</span>
    </td>
  );
}

function Voice({ f }: { f: ReportFeedback }) {
  return (
    <section aria-labelledby="voice" className="space-y-3">
      <Heading right={<span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{f.comments.total} comment{f.comments.total === 1 ? '' : 's'}</span>}><span id="voice">Delegate voice</span></Heading>
      {f.comments.withheld ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Comments appear once at least {f.minResponses} delegates have responded, so no remark can be traced to one person.</p>
      ) : f.comments.items.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">No written comments in this period.</p>
      ) : (
        <>
          <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            {f.comments.items.slice(0, 12).map((c, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-slate-200 dark:border-white/15 pl-3 leading-relaxed">“{c}”</li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400">Submitted comments, unattributed and in alphabetical order{f.comments.items.length > 12 ? ` · 12 of ${f.comments.total} shown` : ''}.</p>
        </>
      )}
    </section>
  );
}

function Trend({ weeks }: { weeks: OverviewReport['trend'] }) {
  if (weeks.filter((w) => w.attendanceRate != null).length < 2) return null;
  return (
    <section aria-labelledby="trend" className="space-y-3">
      <Heading><span id="trend">Attendance week by week</span></Heading>
      <ol className="flex flex-wrap gap-x-8 gap-y-3">
        {weeks.map((w) => (
          <li key={w.weekStart}>
            <p className="text-xs text-slate-500 dark:text-slate-400">w/c {dayLabel(w.weekStart)}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{rate(w.attendanceRate)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{w.present} / {w.expected} · {w.sessions} sess.</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ExportButtons({ onCsv, onPdf }: { onCsv: () => void; onPdf: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 cursor-pointer';
  return (
    <div className="flex gap-2">
      <button type="button" className={btn} onClick={onCsv}><Table2 size={15} /> CSV</button>
      <button type="button" className={btn} disabled={busy} onClick={async () => { setBusy(true); try { await onPdf(); } finally { setBusy(false); } }}>
        <FileDown size={15} /> {busy ? 'Preparing…' : 'PDF briefing'}
      </button>
    </div>
  );
}

const tableHead = 'text-left text-xs text-slate-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/10';

export function ReportsIntelligencePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [params, setParams] = useSearchParams();
  const [defFrom, defTo] = PRESETS[2].range();
  const from = params.get('from') ?? defFrom;
  const to = params.get('to') ?? defTo;
  const schoolId = params.get('school') ?? '';
  const programmeId = params.get('programme');
  const sessionId = params.get('session');
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) if (v == null || v === '') next.delete(k); else next.set(k, v);
    setParams(next);
  };

  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (isSuperAdmin && schoolId) p.set('schoolId', schoolId);
    return p.toString();
  }, [from, to, schoolId, isSuperAdmin]);
  const canQuery = !isSuperAdmin || !!schoolId;
  const rangeValid = from <= to;

  const overview = useApi<OverviewReport>(canQuery && rangeValid && !programmeId && !sessionId ? `/reports/overview?${qs}` : null);
  const programme = useApi<ProgrammeReport>(canQuery && rangeValid && programmeId && !sessionId ? `/reports/programmes/${programmeId}?${qs}` : null);
  const session = useApi<SessionReport>(canQuery && sessionId ? `/reports/sessions/${sessionId}${isSuperAdmin && schoolId ? `?schoolId=${schoolId}` : ''}` : null);

  const scopeLabel = isSuperAdmin
    ? schools?.find((s) => s.id === schoolId)?.name ?? 'Selected school'
    : user?.role === 'LECTURER' ? 'Your sessions'
      : user?.role === 'CLIENT_EXPERIENCE_MANAGER' ? 'Your programmes'
        : user?.school?.name ?? 'Your school';
  const activePreset = PRESETS.find((p) => { const [f, t] = p.range(); return f === from && t === to; })?.key ?? 'custom';
  const selectClass = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white';

  const current = sessionId ? session : programmeId ? programme : overview;

  return (
    <div className="space-y-10 max-w-6xl">
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Reports</p>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white mt-1">
            {sessionId ? 'Session report' : programmeId ? (programme.data?.programme.name ?? 'Programme report') : 'Executive Education overview'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {scopeLabel}{!sessionId ? ` · ${periodLabel({ from, to })}` : ''}
          </p>
        </div>

        {(programmeId || sessionId) && (
          <nav aria-label="Report level" className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => set({ programme: null, session: null })} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 cursor-pointer">
              <ChevronLeft size={15} /> Overview
            </button>
            {programmeId && sessionId && (
              <>
                <span className="text-slate-400">/</span>
                <button type="button" onClick={() => set({ session: null })} className="text-blue-600 dark:text-blue-400 cursor-pointer">{programme.data?.programme.name ?? 'Programme'}</button>
              </>
            )}
          </nav>
        )}

        {!sessionId && (
          <div className="flex flex-wrap items-end gap-3">
            {isSuperAdmin && (
              <label className="text-xs text-slate-600 dark:text-slate-400">School
                <select value={schoolId} onChange={(e) => set({ school: e.target.value, programme: null, session: null })} className={clsx(selectClass, 'block mt-1')}>
                  <option value="">Select a school…</option>
                  {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="text-xs text-slate-600 dark:text-slate-400">Period
              <select value={activePreset} onChange={(e) => { const p = PRESETS.find((x) => x.key === e.target.value); if (p) { const [f, t] = p.range(); set({ from: f, to: t }); } }} className={clsx(selectClass, 'block mt-1')}>
                {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                <option value="custom" disabled>Custom range</option>
              </select>
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">From
              <input type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} className={clsx(selectClass, 'block mt-1')} />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">To
              <input type="date" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} className={clsx(selectClass, 'block mt-1')} />
            </label>
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 ml-auto pb-2"><Lock size={11} /> Feedback anonymous · withheld below 3 responses</p>
          </div>
        )}
      </header>

      {!canQuery ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Select a school to see its reports.</p>
      ) : !rangeValid && !sessionId ? (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">The start date must be on or before the end date.</p>
      ) : current.error ? (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">This report could not be loaded. {current.error}</div>
      ) : !current.data ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Preparing the report…</p>
      ) : sessionId && session.data ? (
        <SessionView r={session.data} canSeeRoster={ROSTER_ROLES.includes(user?.role ?? '')} />
      ) : programmeId && programme.data ? (
        <ProgrammeView r={programme.data} scopeLabel={scopeLabel} onSession={(id) => set({ session: id })} />
      ) : overview.data ? (
        <OverviewView r={overview.data} scopeLabel={scopeLabel} onProgramme={(id) => set({ programme: id })} onSession={(id) => set({ session: id })} />
      ) : null}
    </div>
  );
}

function OverviewView({ r, scopeLabel, onProgramme, onSession }: { r: OverviewReport; scopeLabel: string; onProgramme: (id: string) => void; onSession: (id: string) => void }) {
  const attention = r.attention.sessionsBelowThresholdCount + r.attention.programmesBelowThreshold.length;
  if (r.attendance.sessions === 0 && !r.feedback.current?.responses && r.campaigns.campaigns === 0) {
    return (
      <div className="py-12 text-center border-y border-gray-100 dark:border-white/10">
        <p className="text-base font-medium text-slate-800 dark:text-slate-200">No delivered sessions in this period</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sessions appear here once their check-in window has closed. Try a longer period.</p>
      </div>
    );
  }
  return (
    <>
      <div className="flex justify-end -mt-4"><ExportButtons onCsv={() => overviewCsv(r, scopeLabel)} onPdf={() => overviewPdf(r, scopeLabel)} /></div>
      <Headline a={r.attendance} prev={r.previousAttendance} f={r.feedback} c={r.campaigns} days={r.period.days} />

      <section aria-labelledby="attention" className="space-y-3">
        <Heading><span id="attention">Areas to review</span></Heading>
        {attention === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No session or programme is below the school's {r.attention.threshold}% attendance threshold in this period.</p>
        ) : (
          <>
            <ul className="space-y-1 text-sm text-slate-800 dark:text-slate-200">
              {r.attention.sessionsBelowThresholdCount > 0 && <li>{r.attention.sessionsBelowThresholdCount} session{r.attention.sessionsBelowThresholdCount === 1 ? '' : 's'} below the {r.attention.threshold}% attendance threshold</li>}
              {r.attention.programmesBelowThreshold.length > 0 && <li>{r.attention.programmesBelowThreshold.length} programme{r.attention.programmesBelowThreshold.length === 1 ? '' : 's'} below the threshold: {r.attention.programmesBelowThreshold.map((p) => p.name).join(', ')}</li>}
            </ul>
            {r.attention.sessionsBelowThreshold.length > 0 && (
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {r.attention.sessionsBelowThreshold.map((s) => (
                  <li key={s.classId}>
                    <button type="button" onClick={() => onSession(s.classId)} className="w-full flex items-baseline justify-between gap-4 py-2.5 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] rounded-lg px-1">
                      <span><span className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.courseCode} — {s.title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{dayLabel(s.date)}{s.facilitatorName ? ` · ${s.facilitatorName}` : ''}</span></span>
                      <span className="text-sm tabular-nums text-amber-700 dark:text-amber-300 shrink-0">{rate(s.attendanceRate)} <span className="text-slate-500 dark:text-slate-400">({s.present} / {s.expected})</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {r.programmes.length > 0 && (
        <section aria-labelledby="programmes" className="space-y-2">
          <Heading><span id="programmes">Programmes</span></Heading>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className={tableHead}><th className="py-2 pr-4 font-medium">Programme</th><th className="py-2 pr-4 font-medium text-right">Sessions</th><th className="py-2 pr-4 font-medium text-right">Attendance</th><th className="py-2 pr-4 font-medium text-right">On time</th><th className="py-2 font-medium text-right">Check-out</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {r.programmes.map((p) => (
                  <tr key={p.cohortId}>
                    <td className="py-3 pr-4"><button type="button" onClick={() => onProgramme(p.cohortId)} className="text-left font-medium text-blue-700 dark:text-blue-300 hover:underline cursor-pointer">{p.name} <span className="text-slate-500 dark:text-slate-400 font-normal">({p.year})</span></button><span className="block text-xs text-slate-500 dark:text-slate-400">{p.courseCount} course{p.courseCount === 1 ? '' : 's'}</span></td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{p.sessions}</td>
                    <RateCell a={p} threshold={r.attendanceThreshold} />
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{rate(p.onTimeRate)}</td>
                    <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{rate(p.checkOutRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Trend weeks={r.trend} />
      <Voice f={r.feedback} />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sessions are counted by their scheduled day once check-in has closed. Attendance is present ÷ expected (enrolled by the session's end, plus anyone recorded present); rejected check-in attempts never count as attendance. Comparisons are with the previous {r.period.days} days ({periodLabel(r.previousPeriod)}). Campaigns count in the period they were sent.
      </p>
    </>
  );
}

function ProgrammeView({ r, scopeLabel, onSession }: { r: ProgrammeReport; scopeLabel: string; onSession: (id: string) => void }) {
  return (
    <>
      <div className="flex justify-end -mt-4"><ExportButtons onCsv={() => programmeCsv(r)} onPdf={() => programmePdf(r, scopeLabel)} /></div>
      <Headline a={r.attendance} f={r.feedback} c={r.campaigns} days={r.period.days} />
      {r.courses.length > 0 && (
        <section aria-labelledby="courses" className="space-y-2">
          <Heading><span id="courses">Courses</span></Heading>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead><tr className={tableHead}><th className="py-2 pr-4 font-medium">Course</th><th className="py-2 pr-4 font-medium text-right">Sessions</th><th className="py-2 pr-4 font-medium text-right">Attendance</th><th className="py-2 pr-4 font-medium text-right">On time</th><th className="py-2 font-medium text-right">Check-out</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {r.courses.map((c) => (
                  <tr key={c.courseId}>
                    <td className="py-3 pr-4"><p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{c.code}{c.facilitatorName ? ` · ${c.facilitatorName}` : ''}</p></td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{c.sessions}</td>
                    <RateCell a={c} threshold={r.attendanceThreshold} />
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{rate(c.onTimeRate)}</td>
                    <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{rate(c.checkOutRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <Trend weeks={r.trend} />
      <section aria-labelledby="sessions" className="space-y-2">
        <Heading><span id="sessions">Sessions</span></Heading>
        {r.sessions.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-400">No delivered sessions in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className={tableHead}><th className="py-2 pr-4 font-medium">Session</th><th className="py-2 pr-4 font-medium text-right">Attendance</th><th className="py-2 pr-4 font-medium text-right">On time</th><th className="py-2 pr-4 font-medium text-right">Missing check-out</th><th className="py-2 font-medium text-right">Rejected</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {r.sessions.map((s) => (
                  <tr key={s.classId}>
                    <td className="py-3 pr-4"><button type="button" onClick={() => onSession(s.classId)} className="text-left font-medium text-blue-700 dark:text-blue-300 hover:underline cursor-pointer">{s.title}</button><span className="block text-xs text-slate-500 dark:text-slate-400">{dayLabel(s.date)} · {s.courseCode}</span></td>
                    <RateCell a={s} threshold={r.attendanceThreshold} />
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{rate(s.onTimeRate)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{s.missingCheckOut}</td>
                    <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{s.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Voice f={r.feedback} />
    </>
  );
}

function SessionView({ r, canSeeRoster }: { r: SessionReport; canSeeRoster: boolean }) {
  const a = r.attendance;
  const f = r.feedback;
  return (
    <>
      <div>
        <p className="text-lg font-semibold text-slate-950 dark:text-white">{r.session.courseName} — {r.session.title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{dayLabel(r.session.date)}{r.session.room ? ` · ${r.session.room}` : ''}{r.session.facilitatorName ? ` · ${r.session.facilitatorName}` : ''}</p>
        {canSeeRoster && <Link to={`/attendance/${r.session.classId}`} className="inline-block mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">Open the delegate roster</Link>}
      </div>
      {!r.delivered ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">This session hasn't been delivered yet — attendance is reported once its check-in window closes.</p>
      ) : (
        <section aria-label="Session figures" className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
          <Figure emphasis label="Attendance" value={`${a.present} / ${a.expected}`} basis={`${rate(a.attendanceRate)} of delegates expected${a.attendanceRate != null && a.attendanceRate < r.attendanceThreshold ? ` · below the ${r.attendanceThreshold}% threshold` : ''}`} />
          <Figure label="Punctuality" value={`${a.onTime} on time`} basis={`${a.late} late · ${a.extremelyLate} very late${a.manual ? ` · ${a.manual} marked manually` : ''}`} />
          <Figure label="Check-out" value={`${a.checkedOut} checked out`} basis={`${a.missingCheckOut} missing${a.checkOutOpen ? ` · ${a.checkOutOpen} still open` : ''}`} />
          <Figure label="Rejected attempts" value={String(a.rejected)} basis="Not counted as attendance" />
        </section>
      )}
      <section aria-labelledby="sfeedback" className="space-y-3">
        <Heading><span id="sfeedback">Session feedback</span></Heading>
        {!f.opened ? <p className="text-sm text-slate-600 dark:text-slate-400">Feedback opens shortly before the session ends.</p>
          : f.withheld ? <p className="text-sm text-slate-600 dark:text-slate-400">{f.responses} response{f.responses === 1 ? '' : 's'} from {f.eligible} attendees. Scores and comments appear once at least 3 delegates have responded.</p>
            : (
              <>
                <div className="grid gap-x-10 sm:grid-cols-3">
                  <Figure label="Overall" value={score(f.overall)} basis={`${f.responses} responses · ${rate(f.responseRate)} of ${f.eligible} attendees`} />
                  <Figure label="Facilitator" value={score(f.facilitator)} basis="Average" />
                  <Figure label="Relevance" value={score(f.relevance, 5)} basis="Average" />
                </div>
                {f.comments.length > 0 && (
                  <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
                    {f.comments.map((c, i) => <li key={i} className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-slate-200 dark:border-white/15 pl-3">“{c}”</li>)}
                  </ul>
                )}
              </>
            )}
      </section>
    </>
  );
}
