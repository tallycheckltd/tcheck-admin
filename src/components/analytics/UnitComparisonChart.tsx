import { useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';

interface UnitRow {
  unitId: string;
  name: string;
  level: 'FACULTY' | 'DEPARTMENT';
  attendanceRatePct: number | null;
  enrolledCount: number | null;
  sessionCount: number;
  isViewerUnit: boolean;
  insufficientData: boolean;
}
interface UnitComparison { level: 'FACULTY' | 'DEPARTMENT'; minEnrolled: number; units: UnitRow[] }

// One measure, one series: the viewer's own unit is the accent, every other unit a neutral. Both pass 3:1
// contrast on their surface and stay separable under colour-vision deficiency (checked with the dataviz
// validator); identity is never colour alone — the own unit is also labelled "You" and named in the legend.
const OWN = 'bg-[#2a78d6] dark:bg-[#3987e5]';
const PEER = 'bg-[#8a8985] dark:bg-[#8f8e88]';
const BAR_MAX_PX = 24;

/**
 * QA plan Phase 12 — attendance rate for every Faculty/Department at the school, side by side, own unit
 * highlighted. Aggregate rate + count only (the server exposes nothing else), and a unit below the enrolment
 * floor is listed as "not enough data" rather than plotted, so a tiny unit's number can't pass for a person's.
 */
export function UnitComparisonChart() {
  const { user } = useAuth();
  const isDean = user?.role === 'DEAN';
  const isHod = user?.role === 'HOD' || user?.role === 'DEPUTY_HOD';
  const fixedLevel = isDean ? 'FACULTY' : isHod ? 'DEPARTMENT' : null;
  const [pickedLevel, setPickedLevel] = useState<'FACULTY' | 'DEPARTMENT'>('DEPARTMENT');
  const level = fixedLevel ?? pickedLevel;
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  // SUPER_ADMIN has no single school here; the endpoint needs one.
  const enabled = !!user && user.role !== 'SUPER_ADMIN';
  const { data, error } = useApi<UnitComparison>(enabled ? `/attendance/unit-comparison?level=${level}` : null);

  const plotted = useMemo(() => (data?.units ?? []).filter((u) => !u.insufficientData), [data]);
  const hidden = useMemo(() => (data?.units ?? []).filter((u) => u.insufficientData), [data]);
  const unitWord = level === 'FACULTY' ? 'faculties' : 'departments';

  // Not applicable for this viewer (SUPER_ADMIN with no school picked) or still loading — no
  // message needed, this isn't a failure state. Nothing else returns null any more: QA plan B6 —
  // an error, or a school with no units to compare, used to render nothing at all with no way to
  // tell "broken" from "no data yet" apart. Say which one it is.
  if (!enabled) return null;

  if (error) {
    return (
      <section aria-label={`Attendance by ${unitWord}`} className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Attendance by {level === 'FACULTY' ? 'faculty' : 'department'}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Couldn't load the comparison right now. Try again shortly.
        </p>
      </section>
    );
  }

  if (!data) return null; // still loading — not a failure state, nothing to say yet

  if (data.units.length === 0) {
    return (
      <section aria-label={`Attendance by ${unitWord}`} className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Attendance by {level === 'FACULTY' ? 'faculty' : 'department'}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No courses are tagged to a {level === 'FACULTY' ? 'faculty' : 'department'} yet, so there's nothing to
          compare. Set a course's org unit on the Courses page to have it show up here.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={`Attendance by ${unitWord}`} className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Attendance by {level === 'FACULTY' ? 'faculty' : 'department'}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Share of possible check-ins that happened, across sessions already held. Aggregate only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!fixedLevel && (
            <div role="group" aria-label="Compare by" className="inline-flex overflow-hidden rounded-xl border border-slate-200 text-xs font-semibold dark:border-white/10">
              {(['FACULTY', 'DEPARTMENT'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  onClick={() => setPickedLevel(l)}
                  className={`px-3 py-1.5 cursor-pointer ${level === l ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {l === 'FACULTY' ? 'Faculties' : 'Departments'}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300 cursor-pointer"
          >
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        </div>
      </div>

      {plotted.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-label="Legend">
          {plotted.some((u) => u.isViewerUnit) && (
            <li className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${OWN}`} aria-hidden /> Your unit</li>
          )}
          <li className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${PEER}`} aria-hidden /> {plotted.some((u) => u.isViewerUnit) ? `Other ${unitWord}` : `All ${unitWord}`}</li>
        </ul>
      )}

      {asTable ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr><th className="py-2 pr-4">Unit</th><th className="py-2 pr-4">Attendance</th><th className="py-2 pr-4">Enrolled</th><th className="py-2">Sessions held</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-800 dark:text-slate-100">
              {data.units.map((u) => (
                <tr key={u.unitId}>
                  <td className="py-2 pr-4">{u.name}{u.isViewerUnit ? ' (you)' : ''}</td>
                  <td className="py-2 pr-4">{u.insufficientData ? 'Not enough data' : `${u.attendanceRatePct}%`}</td>
                  <td className="py-2 pr-4">{u.insufficientData ? `Fewer than ${data.minEnrolled}` : u.enrolledCount}</td>
                  <td className="py-2">{u.sessionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 space-y-2" role="list">
          {plotted.map((u) => (
            <div
              key={u.unitId}
              role="listitem"
              className="grid grid-cols-[minmax(7rem,14rem)_1fr] items-center gap-3"
              onMouseEnter={() => setHover(u.unitId)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(u.unitId)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${u.name}${u.isViewerUnit ? ' (your unit)' : ''}: ${u.attendanceRatePct}% attendance, ${u.enrolledCount} enrolled, ${u.sessionCount} sessions held`}
            >
              <span className="truncate text-sm text-slate-800 dark:text-slate-100">
                {u.name}{u.isViewerUnit && <span className="ml-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">You</span>}
              </span>
              <div className="relative flex items-center gap-2">
                <div className="h-6 flex-1 rounded-r bg-slate-100/70 dark:bg-white/5" style={{ maxHeight: BAR_MAX_PX }}>
                  {/* square at the baseline, 4px rounded at the data end */}
                  <div className={`h-full rounded-r-[4px] ${u.isViewerUnit ? OWN : PEER}`} style={{ width: `${Math.max(1, u.attendanceRatePct ?? 0)}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{u.attendanceRatePct}%</span>
                {hover === u.unitId && (
                  <div role="tooltip" className="pointer-events-none absolute -top-9 right-0 z-10 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900">
                    {u.enrolledCount} enrolled · {u.sessionCount} sessions held
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hidden.length > 0 && !asTable && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Not enough data to show (fewer than {data.minEnrolled} enrolled): {hidden.map((u) => u.name + (u.isViewerUnit ? ' (you)' : '')).join(', ')}.
        </p>
      )}
    </section>
  );
}
