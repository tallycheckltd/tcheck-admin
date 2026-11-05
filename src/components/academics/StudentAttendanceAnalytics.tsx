import { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { TablePager } from '../ui/TablePager';
import { exportStudentAttendanceAnalyticsPdf } from '../../lib/adminPdfExport';
import {
  buildStudentAttendanceCsv, byCourse, byPeriod, checkInTypeLabel, downloadText, fmtDate, fmtRate, fmtTime,
  rollup, sessionStatus, sessionsFromHistory, yearOf, yearsIn,
  type Grouping, type HistoryLike, type SessionsResponse, type StudentSession,
} from '../../lib/studentAttendanceAnalytics';
import type { UserDetail } from '../../types';

/*
 * Student profile → course attendance analytics (11-05). Every expected session for this student
 * (GET /users/:id/attendance-sessions), filtered by year and course, grouped by week or month.
 * Neutral look: plain numbers and words, no colour grading. On an older server without the
 * endpoint it falls back to check-ins only and says rates are unavailable.
 */

const selectCls = 'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white';
const th = 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';
const td = 'px-3 py-2 text-xs text-slate-700 dark:text-slate-300 tabular-nums';

export function StudentAttendanceAnalytics({ student, history }: {
  student: Pick<UserDetail, 'id' | 'firstName' | 'lastName' | 'studentId'>;
  history: HistoryLike[] | null;
}) {
  const [sessions, setSessions] = useState<StudentSession[] | null>(null);
  const [ratesKnown, setRatesKnown] = useState(true);
  const [year, setYear] = useState<string>('ALL');
  const [course, setCourse] = useState<string>('ALL');
  const [grouping, setGrouping] = useState<Grouping>('week');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<SessionsResponse>(`/users/${student.id}/attendance-sessions`)
      .then((res) => { if (!cancelled) { setSessions(res.sessions); setRatesKnown(true); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [student.id]);

  // Fallback: the server has no /attendance-sessions yet — use check-ins from the history already loaded.
  const all = useMemo(() => {
    if (sessions) return sessions;
    if (failed && history) return sessionsFromHistory(history);
    return null;
  }, [sessions, failed, history]);
  const rates = ratesKnown && !!sessions;

  const years = useMemo(() => (all ? yearsIn(all) : []), [all]);
  const courses = useMemo(() => (all ? byCourse(all) : []), [all]);
  const filtered = useMemo(() => (all ?? []).filter((s) =>
    (year === 'ALL' || yearOf(s) === Number(year)) && (course === 'ALL' || s.courseId === course),
  ), [all, year, course]);
  const summary = useMemo(() => rollup(filtered), [filtered]);
  const courseRows = useMemo(() => byCourse(filtered), [filtered]);
  const periods = useMemo(() => byPeriod(filtered, grouping), [filtered, grouping]);
  // Newest first in the records list.
  const records = useMemo(() => [...filtered].sort((a, b) => b.startTime.localeCompare(a.startTime)), [filtered]);

  if (!all) {
    return (
      <div className="glass-card p-4 text-xs text-slate-500">Loading course attendance analytics…</div>
    );
  }

  const total = records.length;
  const current = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
  const offset = current * pageSize;
  const pageRows = records.slice(offset, offset + pageSize);
  const maxExpected = Math.max(1, ...periods.map((p) => p.expected));

  const courseLabel = course === 'ALL' ? 'All courses' : (courses.find((c) => c.courseId === course)?.courseName ?? course);
  const filter = { year: year === 'ALL' ? 'All years' : year, course: courseLabel, grouping: grouping === 'week' ? 'By week' : 'By month' };
  const fileBase = `tcheck-student-attendance-${student.studentId ?? student.id}`;
  const rate = (r: number | null) => (rates ? fmtRate(r) : 'n/a');

  const downloadCsv = () => downloadText(`${fileBase}.csv`, buildStudentAttendanceCsv({
    studentName: `${student.firstName} ${student.lastName}`, studentId: student.studentId ?? null,
    filter, summary, courses: courseRows, periods, records, ratesKnown: rates,
  }));
  const downloadPdf = async () => {
    setExporting(true);
    try {
      await exportStudentAttendanceAnalyticsPdf({
        student, filterLine: `${filter.year} · ${filter.course} · ${filter.grouping}`, ratesKnown: rates, summary,
        courses: courseRows, periodHeading: filter.grouping, periods,
        records: records.map((r) => ({
          date: fmtDate(r.date), courseCode: r.courseCode, title: r.title,
          checkIn: fmtTime(r.checkInAt), checkOut: fmtTime(r.checkOutAt), status: sessionStatus(r),
        })),
        fileBase,
      });
    } finally {
      setExporting(false);
    }
  };

  const tiles: [string, string][] = [
    ['Attendance rate', rate(summary.rate)],
    ['Expected sessions', rates ? summary.expected.toLocaleString() : 'n/a'],
    ['Attended', summary.attended.toLocaleString()],
    ['Incomplete', summary.incomplete.toLocaleString()],
    ['Absent', rates ? summary.absent.toLocaleString() : 'n/a'],
    ['Late arrivals', rates ? summary.late.toLocaleString() : 'n/a'],
  ];

  return (
    <div className="glass-card overflow-hidden" data-testid="student-attendance-analytics">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Course attendance analytics</h3>
          {!rates && <p className="mt-0.5 text-[11px] text-slate-500">Expected sessions aren't available from the server, so only check-ins are shown and rates are left out.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Year" value={year} onChange={(e) => { setYear(e.target.value); setPage(0); }} className={selectCls}>
            <option value="ALL">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select aria-label="Course" value={course} onChange={(e) => { setCourse(e.target.value); setPage(0); }} className={selectCls}>
            <option value="ALL">All courses</option>
            {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.courseCode} · {c.courseName}</option>)}
          </select>
          <select aria-label="Group by" value={grouping} onChange={(e) => setGrouping(e.target.value as Grouping)} className={selectCls}>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
          <button type="button" onClick={downloadCsv} disabled={!total} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
            <Download size={12} /> CSV
          </button>
          <button type="button" onClick={downloadPdf} disabled={!total || exporting} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
            <FileText size={12} /> {exporting ? 'PDF…' : 'PDF'}
          </button>
        </div>
      </div>

      {!total ? (
        <p className="px-4 py-5 text-center text-xs text-slate-500">No sessions for this selection.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3 lg:grid-cols-6 dark:bg-white/5">
            {tiles.map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3 dark:bg-slate-900">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums text-slate-950 dark:text-white">{value}</div>
              </div>
            ))}
          </div>

          {/* Trend: attended (solid) of expected (outline) per week or month. */}
          <div className="border-t border-gray-100 px-4 py-3 dark:border-white/5">
            <div className="mb-2 text-[11px] font-medium text-slate-500">Attended of expected, {filter.grouping.toLowerCase()}</div>
            <div className="flex h-24 items-end gap-1 overflow-x-auto">
              {periods.map((p) => (
                <div key={p.key} className="flex min-w-[18px] flex-1 flex-col items-center gap-1" title={`${p.label}: ${p.attended} of ${p.expected} attended${rates ? ` (${fmtRate(p.rate)})` : ''}`}>
                  <div className="relative w-full max-w-[28px] rounded-sm border border-slate-300 dark:border-white/15" style={{ height: `${(p.expected / maxExpected) * 72}px` }}>
                    <div className="absolute inset-x-0 bottom-0 rounded-sm bg-slate-700 dark:bg-slate-300" style={{ height: `${p.expected ? (p.attended / p.expected) * 100 : 0}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-[10px] text-slate-400">{p.shortLabel}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-px border-t border-gray-100 bg-gray-100 lg:grid-cols-2 dark:border-white/5 dark:bg-white/5">
            <div className="overflow-x-auto bg-white dark:bg-slate-900">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-white/5">
                  <th className={th}>Course</th><th className={th}>Expected</th><th className={th}>Attended</th><th className={th}>Absent</th><th className={th}>Rate</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {courseRows.map((c) => (
                    <tr key={c.courseId}>
                      <td className={`${td} font-medium text-slate-900 dark:text-white`}>{c.courseCode} <span className="font-normal text-slate-500">{c.courseName}</span></td>
                      <td className={td}>{rates ? c.expected : 'n/a'}</td><td className={td}>{c.attended}</td><td className={td}>{rates ? c.absent : 'n/a'}</td><td className={td}>{rate(c.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="max-h-72 overflow-auto bg-white dark:bg-slate-900">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-white/5">
                  <th className={th}>{grouping === 'week' ? 'Week' : 'Month'}</th><th className={th}>Expected</th><th className={th}>Attended</th><th className={th}>Late</th><th className={th}>Rate</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {[...periods].reverse().map((p) => (
                    <tr key={p.key}>
                      <td className={td}>{p.label}</td><td className={td}>{rates ? p.expected : 'n/a'}</td><td className={td}>{p.attended}</td><td className={td}>{rates ? p.late : 'n/a'}</td><td className={td}>{rate(p.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-gray-100 dark:border-white/5">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-white/5">
                <th className={`${th} w-10`}>#</th><th className={th}>Date</th><th className={th}>Course</th><th className={th}>Class</th>
                <th className={th}>Check-in</th><th className={th}>Check-out</th><th className={th}>Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {pageRows.map((r, i) => (
                  <tr key={r.classId}>
                    <td className={`${td} text-slate-400`}>{offset + i + 1}</td>
                    <td className={td}>{fmtDate(r.date)}</td>
                    <td className={td}>{r.courseCode}</td>
                    <td className={td}>{r.title}</td>
                    <td className={td}>{r.checkInAt ? `${fmtTime(r.checkInAt)}${r.checkInType ? ` · ${checkInTypeLabel(r.checkInType)}` : ''}` : '—'}</td>
                    <td className={td}>{fmtTime(r.checkOutAt) || '—'}</td>
                    <td className={td}>{sessionStatus(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager page={current} pageSize={pageSize} total={total} noun="sessions" onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(0); }} />
          </div>
        </>
      )}
    </div>
  );
}
