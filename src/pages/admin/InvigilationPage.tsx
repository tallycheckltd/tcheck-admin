import { Fragment, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { usePagination } from '../../hooks/usePagination';
import { ScanEye, ChevronDown, CheckCircle2, XCircle, Users, GraduationCap, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Pagination, RowNumberHead, RowNumberCell } from '../../components/ui/Pagination';

interface ExamCardCourse {
  courseId: string;
  courseCode: string;
  courseName: string;
  total: number;
  attended: number;
  percentage: number;
}

interface ExamCardRow {
  student: { id: string; firstName: string; lastName: string; studentId: string | null };
  courses: ExamCardCourse[];
  eligible: boolean;
}

type StudentCourseRow = { student: ExamCardRow['student']; course: ExamCardCourse };
type CourseGroup = { courseId: string; courseCode: string; courseName: string; rows: StudentCourseRow[] };

function matchesSearch(s: ExamCardRow['student'], search: string) {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    s.firstName.toLowerCase().includes(q) ||
    s.lastName.toLowerCase().includes(q) ||
    (s.studentId?.toLowerCase().includes(q) ?? false)
  );
}

const thClass = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400';

/** Attendance bar + "12/15 · 80%" — green when the student clears the school's threshold. */
function AttendanceMeter({ course, eligible }: { course: ExamCardCourse; eligible: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-[160px]">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          className={clsx('h-full rounded-full', eligible ? 'bg-emerald-500' : 'bg-red-500')}
          style={{ width: `${Math.min(100, course.percentage)}%` }}
        />
      </div>
      <span className="w-24 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {course.attended}/{course.total} · <span className={clsx('font-semibold', eligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{course.percentage}%</span>
      </span>
    </div>
  );
}

/** One table of students for a course — used by the single-course view and each expanded group. */
function StudentTable({ rows, threshold, resetKey, nested = false }: { rows: StudentCourseRow[]; threshold: number; resetKey: string; nested?: boolean }) {
  const pager = usePagination(rows, { resetKey });
  return (
    <div className={clsx(nested && 'rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden')}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-white/10">
              <RowNumberHead />
              <th className={thClass}>Student</th>
              <th className={clsx(thClass, 'hidden sm:table-cell')}>Student ID</th>
              <th className={thClass}>Attendance</th>
              <th className={clsx(thClass, 'text-right')}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {pager.rows.map(({ student, course }, i) => {
              const eligible = course.percentage >= threshold;
              return (
                <tr key={`${student.id}-${course.courseId}`} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <RowNumberCell n={pager.offset + i + 1} />
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-slate-500 dark:text-gray-400 font-bold text-[11px] flex-shrink-0">
                        {student.firstName[0]}{student.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-gray-400 font-mono sm:hidden">{student.studentId || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500 dark:text-gray-400 font-mono">{student.studentId || '—'}</td>
                  <td className="px-4 py-3"><AttendanceMeter course={course} eligible={eligible} /></td>
                  <td className="px-4 py-3 text-right">
                    <Badge color={eligible ? 'green' : 'red'}>{eligible ? 'Eligible' : 'Not Eligible'}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination {...pager.props} />
    </div>
  );
}

export function InvigilationPage() {
  const { user } = useAuth();
  const attendanceThreshold = user?.school?.attendanceThreshold ?? 80;
  const { data: cards, loading } = useApi<ExamCardRow[]>('/attendance/exam-cards', {
    refetchIntervalMs: 60_000,
    refetchWhenVisible: true,
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'eligible' | 'ineligible'>('all');
  const [courseFilter, setCourseFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of cards ?? []) {
      for (const c of row.courses) map.set(c.courseId, c.courseCode);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [cards]);

  // Single-course view — per-course eligibility takes over, since a course selector implies
  // the invigilator is proctoring exactly this exam and only this unit's attendance matters.
  const singleCourseRows = useMemo(() => {
    if (!courseFilter) return [];
    return (cards ?? [])
      .map((row) => ({ student: row.student, course: row.courses.find((c) => c.courseId === courseFilter) }))
      .filter((r): r is StudentCourseRow => !!r.course)
      .filter((r) => matchesSearch(r.student, search))
      .filter((r) => {
        const eligible = r.course.percentage >= attendanceThreshold;
        return filter === 'eligible' ? eligible : filter === 'ineligible' ? !eligible : true;
      });
  }, [cards, courseFilter, search, filter, attendanceThreshold]);

  // All-courses view — grouped by course, each with its own eligible/not-eligible mini-stat.
  const courseGroups = useMemo(() => {
    if (courseFilter) return [];
    const groups = new Map<string, CourseGroup>();
    for (const row of cards ?? []) {
      if (!matchesSearch(row.student, search)) continue;
      for (const c of row.courses) {
        const eligible = c.percentage >= attendanceThreshold;
        if (filter === 'eligible' && !eligible) continue;
        if (filter === 'ineligible' && eligible) continue;
        let g = groups.get(c.courseId);
        if (!g) {
          g = { courseId: c.courseId, courseCode: c.courseCode, courseName: c.courseName, rows: [] };
          groups.set(c.courseId, g);
        }
        g.rows.push({ student: row.student, course: c });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }, [cards, courseFilter, search, filter, attendanceThreshold]);

  const filterKey = `${search}|${filter}|${courseFilter}`;
  const groupPager = usePagination(courseGroups, { resetKey: filterKey });

  const eligibleCount = cards?.filter((c) => c.eligible).length ?? 0;
  const ineligibleCount = (cards?.length ?? 0) - eligibleCount;
  const hasFilters = !!search || filter !== 'all' || !!courseFilter;
  const clearFilters = () => { setSearch(''); setFilter('all'); setCourseFilter(''); };
  const selectedCourseCode = uniqueCourses.find(([id]) => id === courseFilter)?.[1];

  const summary = [
    { label: 'Students', value: cards?.length ?? 0, icon: Users, tone: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10' },
    { label: 'Eligible', value: eligibleCount, icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10' },
    { label: 'Not eligible', value: ineligibleCount, icon: XCircle, tone: 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/10' },
  ];

  const noMatch = (
    <EmptyState
      icon={GraduationCap}
      title={cards && cards.length === 0 ? 'No exam cards yet' : 'No students match'}
      description={cards && cards.length === 0
        ? 'Students appear here once they are enrolled on courses with recorded classes.'
        : 'Try a different search, course or eligibility filter.'}
      action={hasFilters && cards && cards.length > 0 ? (
        <button type="button" onClick={clearFilters} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
          Clear filters
        </button>
      ) : undefined}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ScanEye className="text-blue-500" /> Invigilation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Live exam-eligibility roster — the same data invigilators see when they scan a student's exam card.
            Cleared at {attendanceThreshold}% attendance; refreshes every minute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl border border-gray-100 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2">
              <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', tone)}><Icon size={15} /></span>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight tabular-nums">{value.toLocaleString()}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Search + filters live on the card itself so the list and what's narrowing it read as one unit. */}
        <div className="flex flex-col gap-3 border-b border-gray-100 dark:border-white/5 p-4 lg:flex-row lg:items-center">
          <div className="flex-1 min-w-[240px]">
            <SearchInput placeholder="Search by name or student ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 min-w-[220px]">
            <BookOpen size={16} className="text-gray-400 flex-shrink-0" />
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white cursor-pointer"
            >
              <option value="">All courses (grouped)</option>
              {uniqueCourses.map(([id, code]) => (
                <option key={id} value={id}>{code}</option>
              ))}
            </select>
          </div>
          <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-xl gap-1 self-start lg:self-auto">
            {(['all', 'eligible', 'ineligible'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize whitespace-nowrap',
                  filter === f
                    ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                {f === 'ineligible' ? 'Not Eligible' : f}
              </button>
            ))}
          </div>
        </div>

        {loading && !cards ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : courseFilter ? (
          singleCourseRows.length === 0 ? noMatch : (
            <>
              <div className="px-4 pt-3 pb-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{selectedCourseCode}</span>
                {' · '}{singleCourseRows.length.toLocaleString()} {singleCourseRows.length === 1 ? 'student' : 'students'}
              </div>
              <StudentTable rows={singleCourseRows} threshold={attendanceThreshold} resetKey={filterKey} />
            </>
          )
        ) : courseGroups.length === 0 ? noMatch : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-white/10">
                    <RowNumberHead />
                    <th className={thClass}>Course</th>
                    <th className={clsx(thClass, 'text-right')}>Students</th>
                    <th className={clsx(thClass, 'hidden md:table-cell')}>Eligibility</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {groupPager.rows.map((group, i) => {
                    const isOpen = expanded === group.courseId;
                    const groupEligible = group.rows.filter((r) => r.course.percentage >= attendanceThreshold).length;
                    const groupIneligible = group.rows.length - groupEligible;
                    const pct = group.rows.length ? Math.round((groupEligible / group.rows.length) * 100) : 0;
                    return (
                      <Fragment key={group.courseId}>
                        <tr
                          onClick={() => setExpanded(isOpen ? null : group.courseId)}
                          className={clsx('cursor-pointer transition-colors', isOpen ? 'bg-blue-50/40 dark:bg-white/[0.04]' : 'hover:bg-gray-50/50 dark:hover:bg-white/5')}
                          aria-expanded={isOpen}
                        >
                          <RowNumberCell n={groupPager.offset + i + 1} />
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{group.courseName}</p>
                            <p className="text-xs text-gray-400 font-mono">{group.courseCode}</p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-200">{group.rows.length.toLocaleString()}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-3 min-w-[220px]">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-red-100 dark:bg-red-500/20">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs tabular-nums whitespace-nowrap">
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{groupEligible} eligible</span>
                                <span className="text-gray-300 dark:text-gray-600"> · </span>
                                <span className="font-semibold text-red-600 dark:text-red-400">{groupIneligible} not</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ChevronDown size={16} className={clsx('inline text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="px-4 pb-4 pt-1 bg-blue-50/20 dark:bg-white/[0.02]">
                              <StudentTable rows={group.rows} threshold={attendanceThreshold} resetKey={filterKey} nested />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...groupPager.props} />
          </>
        )}
      </div>
    </div>
  );
}

