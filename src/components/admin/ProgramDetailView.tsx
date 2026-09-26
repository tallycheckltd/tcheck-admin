import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { FacilitiesQueue } from '../facilities/FacilitiesQueue';
import {
  Users, GraduationCap, Wrench, PieChart, Mail, BookOpen, ClipboardCheck, ChevronDown, LogIn, LogOut,
} from 'lucide-react';

interface ProgramCourse {
  courseId: string;
  name: string;
  code: string;
  lecturer: { firstName: string; lastName: string } | null;
  enrolled: number;
  classCount: number;
  present: number;
  possible: number;
  attendanceRate: number;
}
interface ProgramStudent {
  id: string; firstName: string; lastName: string; email: string;
  studentId: string | null; jobTitle: string | null; company: string | null;
}
interface ProgramGenderRow {
  majorId: string; majorName: string;
  totalStudents: number | null;
  genderCounts: Record<string, number> | null;
  insufficientData: boolean;
}
interface ProgramCheckIn {
  id: string;
  student: { id: string; firstName: string; lastName: string; studentId: string | null };
  courseName: string; courseCode: string; classTitle: string;
  checkInAt: string; checkOutAt: string | null;
  checkInType: string; status: string;
}
interface ProgramDetail {
  id: string; name: string; year: number; schoolId: string;
  startDate: string | null; endDate: string | null;
  studentCount: number; pendingWelcomeCount: number;
  cem: { id: string; firstName: string; lastName: string; email: string } | null;
  courses: ProgramCourse[];
  totals: { enrolled: number; present: number; possible: number; attendanceRate: number };
  genderBreakdown: ProgramGenderRow[];
  tickets: { open: number; acknowledged: number; resolved: number; breached: number };
  students: ProgramStudent[];
  checkIns: ProgramCheckIn[];
}

const dateRange = (start: string | null, end: string | null) => {
  if (!start || !end) return 'Not scheduled yet';
  const f = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return f(start) === f(end) ? f(start) : `${f(start)} – ${f(end)}`;
};
const dateTime = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const GENDER_COLOR: Record<string, string> = {
  FEMALE: 'bg-pink-500', MALE: 'bg-blue-500', UNSPECIFIED: 'bg-gray-400',
};

/** Collapsed by default — per explicit request, a programme page with every section's full
 * content open at once "feels very populated." Clicking the header toggles just this one
 * section. `defaultOpen` lets a section (Facilities) start expanded when it's the whole point of
 * navigating here rather than background detail. */
function Collapsible({ title, icon: Icon, count, defaultOpen = false, children }: {
  title: string; icon: React.ElementType; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left cursor-pointer"
      >
        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon size={18} className="text-blue-500" /> {title}
          {count !== undefined && <span className="text-sm font-normal text-gray-400">({count})</span>}
        </h2>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </section>
  );
}

/**
 * "Click a programme, see everything about it, end to end" — one shared view backing both the
 * CEM/Head-of-CEM's own programme page and the Dean-facing per-programme drill-down, so the two
 * audiences can never see a different picture of the same programme. Backed by the single
 * GET /cem/programs/:cohortId endpoint (cemDashboard.service.ts's getProgramDetail), which already
 * enforces who's allowed to see which programme — this component just renders whatever comes back.
 *
 * Every section below Facilities is a collapsed-by-default Collapsible (explicit feedback: "make
 * it feel less populated") — Facilities starts open since real ticket actions (acknowledge/
 * escalate/resolve, via the shared FacilitiesQueue component) are the whole reason to be here for
 * some visitors, not background detail to tuck away.
 */
export function ProgramDetailView({ cohortId }: { cohortId: string }) {
  const { data: program, loading } = useApi<ProgramDetail>(`/cem/programs/${cohortId}`);

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!program) {
    return (
      <div className="glass-card p-8 text-center">
        <GraduationCap size={28} className="mx-auto text-gray-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">This programme isn&apos;t available to you (or doesn&apos;t exist).</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{program.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{dateRange(program.startDate, program.endDate)} · {program.year}</p>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-700 dark:text-gray-300">
          <span className="flex items-center gap-1.5"><Users size={14} className="text-blue-500" /> {program.studentCount} student{program.studentCount === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-1.5"><BookOpen size={14} className="text-blue-500" /> {program.courses.length} course{program.courses.length === 1 ? '' : 's'}</span>
          {program.cem && (
            <span className="flex items-center gap-1.5">
              <Mail size={14} className="text-blue-500" /> CEM: {program.cem.firstName} {program.cem.lastName} (
              <a href={`mailto:${program.cem.email}`} className="text-blue-500 hover:underline">{program.cem.email}</a>)
            </span>
          )}
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{program.totals.enrolled}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Enrolled</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{program.totals.present}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Present check-ins</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{program.totals.attendanceRate}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Attendance rate</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className={`text-2xl font-bold ${program.tickets.breached > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
            {program.tickets.open + program.tickets.acknowledged}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Open facility tickets</p>
        </div>
      </div>
      {program.totals.enrolled > 0 && program.totals.attendanceRate < 20 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 px-1">
          A low rate here usually means most of the roster hasn&apos;t had a class yet or hasn&apos;t checked in — see Check-Ins below for exactly who has.
        </p>
      )}

      {/* Facilities — open by default; real ticket actions via the same component the admin
          Facilities Queue and CEM Facilities page already use. */}
      <Collapsible title="Facilities" icon={Wrench} defaultOpen>
        <FacilitiesQueue cohortId={cohortId} />
      </Collapsible>

      {/* Check-Ins — explicit request: see who actually checked in/out, not just a percentage. */}
      <Collapsible title="Check-Ins" icon={ClipboardCheck} count={program.checkIns.length}>
        {!program.checkIns.length ? (
          <EmptyState icon={ClipboardCheck} title="No check-ins yet" description="Check-ins across every course in this programme will appear here." size="sm" />
        ) : (
          <div className="rounded-xl border border-gray-100 dark:border-white/5 overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3">Student</th>
                  <th className="text-left py-2 px-3">Course / Session</th>
                  <th className="text-left py-2 px-3"><LogIn size={12} className="inline mr-1" />Check-in</th>
                  <th className="text-left py-2 px-3"><LogOut size={12} className="inline mr-1" />Check-out</th>
                  <th className="text-left py-2 px-3">Type</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {program.checkIns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200">
                      {c.student.firstName} {c.student.lastName}
                      {c.student.studentId && <span className="text-gray-400 font-mono text-xs ml-1">({c.student.studentId})</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                      {c.courseCode} — {c.classTitle}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{dateTime(c.checkInAt)}</td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{c.checkOutAt ? dateTime(c.checkOutAt) : '—'}</td>
                    <td className="py-2 px-3"><Badge color="blue">{c.checkInType}</Badge></td>
                    <td className="py-2 px-3">
                      <Badge color={c.status === 'PRESENT' ? 'green' : c.status === 'LATE' ? 'yellow' : 'red'}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>

      {/* Courses in this programme — the thing that was missing */}
      <Collapsible title="Courses in this programme" icon={BookOpen} count={program.courses.length}>
        {!program.courses.length ? (
          <EmptyState icon={BookOpen} title="No courses yet" description="Courses tagged into this programme will appear here." size="sm" />
        ) : (
          <div className="rounded-xl border border-gray-100 dark:border-white/5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="text-left py-2.5 px-4">Course</th>
                  <th className="text-left py-2.5 px-4">Lecturer</th>
                  <th className="text-right py-2.5 px-4">Enrolled</th>
                  <th className="text-right py-2.5 px-4">Sessions</th>
                  <th className="text-right py-2.5 px-4">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {program.courses.map((c) => (
                  <tr key={c.courseId}>
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{c.code}</p>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-300">
                      {c.lecturer ? `${c.lecturer.firstName} ${c.lecturer.lastName}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-700 dark:text-gray-300">{c.enrolled}</td>
                    <td className="py-2.5 px-4 text-right text-gray-700 dark:text-gray-300">{c.classCount}</td>
                    <td className="py-2.5 px-4 text-right">
                      <Badge color={c.attendanceRate >= 75 ? 'green' : c.attendanceRate >= 50 ? 'yellow' : 'red'}>{c.attendanceRate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>

      {/* Gender breakdown — aggregate only, per programme/major, never a per-student figure */}
      {program.genderBreakdown.length > 0 && (
        <Collapsible title="Gender breakdown by programme" icon={PieChart}>
          <div className="space-y-3">
            {program.genderBreakdown.map((row) => (
              <div key={row.majorId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{row.majorName}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {row.insufficientData ? 'Too few students to show' : `${row.totalStudents} student${row.totalStudents === 1 ? '' : 's'}`}
                  </span>
                </div>
                {!row.insufficientData && row.genderCounts && row.totalStudents && (
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5">
                    {Object.entries(row.genderCounts).map(([gender, count]) => (
                      <div
                        key={gender}
                        className={GENDER_COLOR[gender] ?? 'bg-gray-400'}
                        style={{ width: `${(count / row.totalStudents!) * 100}%` }}
                        title={`${gender}: ${count}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Roster */}
      <Collapsible title="Students" icon={Users} count={program.students.length}>
        {!program.students.length ? (
          <EmptyState icon={Users} title="No students yet" description="Enrolled students for this programme will appear here." size="sm" />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5 max-h-80 overflow-y-auto">
            {program.students.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {s.jobTitle ? `${s.jobTitle}${s.company ? ` · ${s.company}` : ''}` : s.email}
                  </p>
                </div>
                {s.studentId && <span className="text-xs text-gray-400 font-mono">{s.studentId}</span>}
              </div>
            ))}
          </div>
        )}
      </Collapsible>
    </div>
  );
}
