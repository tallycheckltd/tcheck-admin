import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, LogOut, Send, ShieldAlert, Star, Table2, Users, UserX } from 'lucide-react';
import type { MissingCheckOuts, OverviewReport, ProgrammeReport, ReportAttendance, ReportPeriodOut, ReportTrendWeek, SessionReport } from '../../types';
import { dayLabel, missingCheckOutsCsv, rate, score } from '../../lib/reportsExport';
import { BelowPill, Card, Delta, Empty, RateBar, Tile, WeeklyBars } from './InsightsUi';

/**
 * Insights → Overview (formerly Executive Reports): the management summary — attendance,
 * punctuality, check-out, the feedback headline, what needs attention, programmes, week by week,
 * missing check-outs. Programme and session drill-downs render in the same card language.
 */

const weekPoints = (trend: ReportTrendWeek[]) => trend.map((w) => ({
  label: `w/c ${dayLabel(w.weekStart)}`.replace(/ \d{4}$/, ''),
  value: w.attendanceRate,
  sub: `${w.attended ?? w.present} of ${w.expected} expected · ${w.sessions} session${w.sessions === 1 ? '' : 's'}`,
}));

/** The attendance tiles shared by overview and programme views. */
function AttendanceTiles({ a, prev, days, feedback, onFeedback }: {
  a: ReportAttendance; prev?: ReportAttendance | null; days?: number;
  feedback?: { value: number | null; responses: number; rate: number | null } | null;
  onFeedback?: () => void;
}) {
  const verdicts = a.onTime + a.late + a.extremelyLate;
  const due = a.checkedOut + a.missingCheckOut;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Attendance" icon={<Users size={18} />} color="blue" value={rate(a.attendanceRate)}
        basis={`${a.attended} of ${a.expected} expected · ${a.sessions} session${a.sessions === 1 ? '' : 's'}${a.incomplete ? ` · ${a.incomplete} incomplete` : ''}`}
        delta={<Delta current={a.attendanceRate} previous={prev?.attendanceRate} days={days} />} />
      {verdicts > 0 && (
        <Tile label="On-time arrival" icon={<Clock size={18} />} color="green" value={rate(a.onTimeRate)}
          basis={`${a.onTime} of ${verdicts} · ${a.late} late, ${a.extremelyLate} very late`}
          delta={<Delta current={a.onTimeRate} previous={prev?.onTimeRate} days={days} />} />
      )}
      {due > 0 && (
        <Tile label="Check-out completion" icon={<LogOut size={18} />} color="purple" value={rate(a.checkOutRate)}
          basis={`${a.checkedOut} of ${due} due · ${a.missingCheckOut} missing`}
          delta={<Delta current={a.checkOutRate} previous={prev?.checkOutRate} days={days} />} />
      )}
      {feedback && (
        <Tile label="Session feedback" icon={<Star size={18} />} color="amber"
          value={feedback.value == null ? (feedback.responses ? 'Withheld' : '—') : score(feedback.value).replace(' / 10', '')}
          suffix={feedback.value == null ? undefined : '/ 10'}
          basis={feedback.responses ? `${feedback.responses} response${feedback.responses === 1 ? '' : 's'} · ${rate(feedback.rate)} response rate` : 'No responses yet'}
          onClick={onFeedback} hint={onFeedback ? 'Open feedback' : undefined} />
      )}
    </div>
  );
}

/** Sessions below the attendance threshold — the most useful list, so it leads, amber-edged. */
function NeedsAttention({ r, onSession }: { r: OverviewReport; onSession: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const n = r.attention.sessionsBelowThresholdCount;
  const progs = r.attention.programmesBelowThreshold;
  if (n === 0 && progs.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 size={16} /> Every session and programme is at or above the {r.attention.threshold}% attendance threshold.
      </div>
    );
  }
  const list = all ? r.attention.sessionsBelowThreshold : r.attention.sessionsBelowThreshold.slice(0, 5);
  return (
    <Card accent="attention" title="Needs attention"
      subtitle={[
        n ? `${n} session${n === 1 ? '' : 's'} below the ${r.attention.threshold}% attendance threshold` : null,
        progs.length ? `${progs.length} programme${progs.length === 1 ? '' : 's'} below it: ${progs.map((p) => p.name).join(', ')}` : null,
      ].filter(Boolean).join(' · ')}
      action={<AlertTriangle size={18} className="text-amber-500" aria-hidden />}>
      <ul className="divide-y divide-gray-100 dark:divide-white/10">
        {list.map((s) => (
          <li key={s.classId}>
            <button type="button" onClick={() => onSession(s.classId)} className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_160px_auto] items-center gap-x-4 gap-y-1 py-2.5 text-left cursor-pointer hover:bg-gray-50/60 dark:hover:bg-white/[0.03] rounded-lg px-1">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{s.courseCode} — {s.title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{dayLabel(s.date)}{s.facilitatorName ? ` · ${s.facilitatorName}` : ''}</span>
              </span>
              <span className="hidden sm:block"><RateBar value={s.attendanceRate} threshold={r.attention.threshold} /></span>
              <span className="text-right text-sm tabular-nums">
                <span className="font-semibold text-amber-700 dark:text-amber-300">{rate(s.attendanceRate)}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{s.attended} / {s.expected}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {r.attention.sessionsBelowThreshold.length > 5 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer">
          {all ? 'Show fewer' : n > r.attention.sessionsBelowThreshold.length ? `Show the ${r.attention.sessionsBelowThreshold.length} lowest of ${n}` : `Show all ${n}`}
        </button>
      )}
    </Card>
  );
}

/** Rows of name + attendance bar vs threshold; used for programmes and courses. */
function RateRows({ rows, threshold, onOpen, limit = 10 }: {
  rows: { id: string; name: string; meta: string; a: ReportAttendance }[]; threshold: number; onOpen?: (id: string) => void; limit?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <>
    <ul className="divide-y divide-gray-100 dark:divide-white/10">
      {shown.map((row) => {
        const below = row.a.attendanceRate != null && row.a.attendanceRate < threshold;
        const inner = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className={`text-sm font-medium ${onOpen ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>{row.name}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{rate(row.a.attendanceRate)}</span>
            </span>
            <RateBar value={row.a.attendanceRate} threshold={threshold} />
            <span className="flex items-center justify-between gap-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              <span>{row.meta} · {row.a.attended} / {row.a.expected}</span>
              {below ? <BelowPill threshold={threshold} /> : row.a.onTimeRate != null ? <span>On time {rate(row.a.onTimeRate)}</span> : null}
            </span>
          </>
        );
        const cls = 'w-full flex flex-col gap-1.5 py-3 px-1 text-left rounded-lg';
        return (
          <li key={row.id}>
            {onOpen
              ? <button type="button" onClick={() => onOpen(row.id)} className={`${cls} cursor-pointer hover:bg-gray-50/60 dark:hover:bg-white/[0.03]`}>{inner}</button>
              : <div className={cls}>{inner}</div>}
          </li>
        );
      })}
    </ul>
    {rows.length > limit && (
      <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer">
        {all ? 'Show fewer' : `Show all ${rows.length}`}
      </button>
    )}
    </>
  );
}

/** Checked in, never checked out, window closed — not counted as attended. */
function MissingCheckOutsCard({ m, period, label, onSession }: { m?: MissingCheckOuts; period: ReportPeriodOut; label: string; onSession: (id: string) => void }) {
  const [more, setMore] = useState(false);
  if (!m) return null;
  const shown = m.rows.slice(0, more ? 50 : 8);
  return (
    <Card title={`Missing check-outs${m.total ? ` · ${m.total}` : ''}`}
      subtitle={m.total ? "Checked in but never checked out — the session doesn't count as attended." : undefined}
      action={m.total ? <button type="button" onClick={() => missingCheckOutsCsv(m, label, period)} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer"><Table2 size={13} /> CSV</button> : undefined}>
      {m.total === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 size={15} className="text-emerald-500" /> Everyone who checked in also checked out.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {shown.map((r) => (
              <li key={r.attendanceId} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
                <span className="min-w-0 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><UserX size={15} /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.name}{r.studentId ? <span className="font-normal text-slate-500"> · {r.studentId}</span> : null}</span>
                    <button type="button" onClick={() => onSession(r.classId)} className="block truncate text-xs text-blue-700 dark:text-blue-300 hover:underline cursor-pointer">{r.courseCode} — {r.sessionTitle} · {dayLabel(r.date)}</button>
                  </span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">In {new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-3 text-xs">
            {m.rows.length > 8 && (
              <button type="button" onClick={() => setMore((v) => !v)} className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer">
                {more ? 'Show fewer' : `Show ${Math.min(m.rows.length, 50) - 8} more`}
              </button>
            )}
            {m.total > shown.length && <span className="text-slate-500 dark:text-slate-400">Showing {shown.length} of {m.total} · the CSV has everyone</span>}
          </div>
        </>
      )}
    </Card>
  );
}

export function OverviewView({ r, scopeLabel, onProgramme, onSession, onFeedback }: {
  r: OverviewReport; scopeLabel: string; onProgramme: (id: string) => void; onSession: (id: string) => void; onFeedback: () => void;
}) {
  if (r.attendance.sessions === 0 && !r.feedback.current?.responses && r.campaigns.campaigns === 0) {
    return <Card title="Nothing to report yet"><Empty title="No delivered sessions in this period">Sessions appear once their check-in window has closed. Try a longer period.</Empty></Card>;
  }
  const fc = r.feedback.current;
  const weeks = weekPoints(r.trend);
  return (
    <div className="space-y-6">
      <AttendanceTiles a={r.attendance} prev={r.previousAttendance} days={r.period.days}
        feedback={fc ? { value: fc.overall.average, responses: fc.responses, rate: fc.responseRate } : { value: null, responses: 0, rate: null }}
        onFeedback={onFeedback} />

      {(r.campaigns.campaigns > 0 || r.attendance.rejected > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {r.campaigns.campaigns > 0 && (
            <Tile label="Campaign response" icon={<Send size={18} />} color="cyan" value={rate(r.campaigns.responseRate)}
              basis={`${r.campaigns.responses} of ${r.campaigns.recipients} delegates · ${r.campaigns.campaigns} campaign${r.campaigns.campaigns === 1 ? '' : 's'}`} />
          )}
          {r.attendance.rejected > 0 && (
            <Tile label="Rejected check-in attempts" icon={<ShieldAlert size={18} />} color="red" value={String(r.attendance.rejected)}
              basis={`Failed identity checks — never counted · ${r.previousAttendance.rejected} in the previous ${r.period.days} days`} />
          )}
        </div>
      )}

      <NeedsAttention r={r} onSession={onSession} />

      <div className="grid gap-6 xl:grid-cols-5 xl:items-start">
        <Card className="xl:col-span-3" title="Attendance by week" subtitle={`Attended ÷ expected, per week · dashed line = ${r.attendanceThreshold}% threshold`}>
          {weeks.filter((w) => w.value != null).length >= 2
            ? <WeeklyBars data={weeks} max={100} threshold={r.attendanceThreshold} unit="%" name="Attendance" />
            : <Empty title="Not enough weeks yet">The weekly view appears once sessions have run in two or more weeks.</Empty>}
        </Card>
        <Card className="xl:col-span-2" title="Programmes" subtitle="Lowest attendance first · click for the programme report">
          {r.programmes.length
            ? <RateRows threshold={r.attendanceThreshold} onOpen={onProgramme}
                rows={r.programmes.map((p) => ({ id: p.cohortId, name: `${p.name} (${p.year})`, meta: `${p.courseCount} course${p.courseCount === 1 ? '' : 's'} · ${p.sessions} session${p.sessions === 1 ? '' : 's'}`, a: p }))} />
            : <Empty title="No programmes in scope" />}
        </Card>
      </div>

      <MissingCheckOutsCard m={r.missingCheckOuts} period={r.period} label={scopeLabel} onSession={onSession} />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sessions count on their scheduled day once check-in has closed. Attendance = attended ÷ expected (enrolled by the session's end, plus anyone who checked in); a check-in without a check-out after the window closes is incomplete and not counted. Comparisons are with the previous {r.period.days} days.
      </p>
    </div>
  );
}

export function ProgrammeView({ r, scopeLabel, onSession, onFeedback }: { r: ProgrammeReport; scopeLabel: string; onSession: (id: string) => void; onFeedback: () => void }) {
  const fc = r.feedback.current;
  const weeks = weekPoints(r.trend);
  return (
    <div className="space-y-6">
      <AttendanceTiles a={r.attendance}
        feedback={fc ? { value: fc.overall.average, responses: fc.responses, rate: fc.responseRate } : { value: null, responses: 0, rate: null }}
        onFeedback={onFeedback} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Attendance by week" subtitle={`Dashed line = ${r.attendanceThreshold}% threshold`}>
          {weeks.filter((w) => w.value != null).length >= 2
            ? <WeeklyBars data={weeks} max={100} threshold={r.attendanceThreshold} unit="%" name="Attendance" />
            : <Empty title="Not enough weeks yet" />}
        </Card>
        <Card className="xl:col-span-2" title="Courses" subtitle="Attendance per course">
          {r.courses.length
            ? <RateRows threshold={r.attendanceThreshold}
                rows={r.courses.map((c) => ({ id: c.courseId, name: c.name, meta: `${c.code}${c.facilitatorName ? ` · ${c.facilitatorName}` : ''}`, a: c }))} />
            : <Empty title="No courses" />}
        </Card>
      </div>
      <Card title="Sessions" subtitle="Newest first · click for the session report">
        {r.sessions.length === 0 ? <Empty title="No delivered sessions in this period" /> : (
          <RateRows threshold={r.attendanceThreshold} onOpen={onSession}
            rows={r.sessions.map((s) => ({ id: s.classId, name: s.title, meta: `${dayLabel(s.date)} · ${s.courseCode}${s.incomplete ? ` · ${s.incomplete} missing check-out` : ''}`, a: s }))} />
        )}
      </Card>
      <MissingCheckOutsCard m={r.missingCheckOuts} period={r.period} label={r.programme.name ?? scopeLabel} onSession={onSession} />
    </div>
  );
}

export function SessionView({ r, canSeeRoster }: { r: SessionReport; canSeeRoster: boolean }) {
  const a = r.attendance;
  const f = r.feedback;
  return (
    <div className="space-y-6">
      <Card title={`${r.session.courseName} — ${r.session.title}`}
        subtitle={`${dayLabel(r.session.date)}${r.session.room ? ` · ${r.session.room}` : ''}${r.session.facilitatorName ? ` · ${r.session.facilitatorName}` : ''}`}
        action={canSeeRoster ? <Link to={`/attendance/${r.session.classId}`} className="text-xs font-medium text-blue-600 dark:text-blue-400">Open the roster →</Link> : undefined}>
        {!r.delivered
          ? <p className="text-sm text-slate-600 dark:text-slate-400">This session hasn't been delivered yet — attendance is reported once its check-in window closes.</p>
          : <AttendanceTiles a={a} />}
      </Card>
      <Card title="Session feedback" subtitle="Anonymous · figures appear from 3 responses">
        {!f.opened ? <p className="text-sm text-slate-600 dark:text-slate-400">Feedback opens shortly before the session ends.</p>
          : f.withheld ? <p className="text-sm text-slate-600 dark:text-slate-400">{f.responses} response{f.responses === 1 ? '' : 's'} from {f.eligible} attendees. Scores and comments appear once at least 3 delegates have responded.</p>
            : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Tile label="Overall" icon={<Star size={18} />} color="amber" value={f.overall == null ? '—' : f.overall.toFixed(1)} suffix="/ 10" basis={`${f.responses} responses · ${rate(f.responseRate)} of ${f.eligible}`} />
                  {f.facilitator != null && <Tile label="Facilitator" icon={<Users size={18} />} color="blue" value={f.facilitator.toFixed(1)} suffix="/ 10" />}
                  {f.relevance != null && <Tile label="Relevance" icon={<CheckCircle2 size={18} />} color="green" value={f.relevance.toFixed(1)} suffix="/ 5" />}
                </div>
                {f.comments.length > 0 && (
                  <ul className="grid gap-3 md:grid-cols-2">
                    {f.comments.map((c, i) => <li key={i} className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-slate-200 dark:border-white/15 pl-3">“{c}”</li>)}
                  </ul>
                )}
              </div>
            )}
      </Card>
    </div>
  );
}

