import { useState, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import {
  GraduationCap, Search, Filter, ChevronDown, ChevronRight, X,
  BookOpen, AlertTriangle, TrendingDown, TrendingUp, Minus,
} from 'lucide-react';
import type { User, Course, Major, Cohort, Level } from '../../types';

const RECENT_ABSENCE_DISPLAY_COUNT = 5;

// Deterministic dummy attendance % from student ID
function getDummyAttendancePct(id: string): number {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return 45 + (hash % 54);
}

function getHealthStatus(pct: number): { label: string; color: 'green' | 'yellow' | 'red'; dot: string } {
  if (pct >= 75) return { label: 'Safe', color: 'green', dot: 'bg-emerald-400' };
  if (pct >= 60) return { label: 'Warning', color: 'yellow', dot: 'bg-amber-400' };
  return { label: 'Critical', color: 'red', dot: 'bg-red-500' };
}

function getRiskScore(id: string): { score: number; trend: 'up' | 'stable' | 'down' } {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const score = 30 + (hash % 70);
  const trendN = hash % 3;
  const trend = trendN === 0 ? 'up' : trendN === 1 ? 'stable' : 'down';
  return { score, trend };
}

// Dummy per-course stats for the drawer
function getDummyCourseStats(studentId: string, courses: { id: string; name: string; code: string }[]) {
  return courses.slice(0, 4).map((c, i) => {
    const hash = (studentId + c.id).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const pct = 45 + ((hash + i * 7) % 54);
    return { courseId: c.id, courseName: c.name, courseCode: c.code, pct };
  });
}

// Dummy recent absences
const ABSENCE_DATES = [
  '2026-03-18', '2026-03-14', '2026-03-11', '2026-03-07', '2026-03-04',
];
function getDummyAbsences(studentId: string, courses: { name: string; code: string }[]) {
  const hash = studentId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const count = 2 + (hash % (RECENT_ABSENCE_DISPLAY_COUNT - 1));
  return Array.from({ length: count }, (_, i) => ({
    date: ABSENCE_DATES[i] || ABSENCE_DATES[0],
    courseName: courses[(hash + i) % Math.max(courses.length, 1)]?.name || 'Unknown Course',
  }));
}

interface StudentWithEnrollments extends User {
  enrollments?: { course: Course }[];
}

interface StudentDrawerProps {
  student: StudentWithEnrollments;
  onClose: () => void;
}

function StudentDrawer({ student, onClose }: StudentDrawerProps) {
  const pct = getDummyAttendancePct(student.id);
  const health = getHealthStatus(pct);
  const { score: riskScore, trend } = getRiskScore(student.id);
  const enrolledCourses = (student.enrollments || []).map((e) => e.course).filter(Boolean);
  const courseStats = getDummyCourseStats(
    student.id,
    enrolledCourses.map((c) => ({ id: c.id, name: c.name, code: c.code })),
  );
  const absences = getDummyAbsences(
    student.id,
    enrolledCourses.map((c) => ({ name: c.name, code: c.code })),
  );

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-600 dark:text-slate-400';
  const riskLabel = riskScore > 75 ? 'On Track' : riskScore >= 50 ? 'Medium Risk' : 'High Risk';
  const riskColor = riskScore > 75 ? 'text-emerald-600 dark:text-emerald-400' : riskScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 md:right-0 md:top-0 md:left-auto md:bottom-0 md:w-[40vw] bg-white dark:bg-gray-900 border-t md:border-t-0 md:border-l border-gray-200 dark:border-white/10 z-50 flex flex-col shadow-2xl max-h-[90vh] md:max-h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              {student.firstName?.[0]}{student.lastName?.[0]}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                {student.firstName} {student.lastName}
              </h3>
              <p className="text-xs text-slate-600">{student.studentId || student.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
              <p className="text-2xl font-bold text-slate-950 dark:text-white">{pct}%</p>
              <p className="text-xs text-slate-600 mt-0.5">Overall</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
              <p className={`text-2xl font-bold ${riskColor}`}>{riskScore}</p>
              <p className="text-xs text-slate-600 mt-0.5">Risk Score</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
              <p className={`text-sm font-bold mt-1 ${riskColor}`}>{riskLabel}</p>
              <div className={`flex items-center justify-center gap-1 mt-0.5 ${trendColor}`}>
                <TrendIcon size={14} />
                <span className="text-xs capitalize">{trend}</span>
              </div>
            </div>
          </div>

          {/* Health */}
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${health.dot}`} />
            <Badge color={health.color}>{health.label}</Badge>
            <span className="text-xs text-slate-600">Attendance status</span>
          </div>

          {/* Per-course attendance */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BookOpen size={12} /> Active Courses
            </h4>
            {courseStats.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No enrolled courses.</p>
            ) : (
              <div className="space-y-2.5">
                {courseStats.map((cs) => {
                  const barColor = cs.pct >= 75 ? 'bg-emerald-500' : cs.pct >= 60 ? 'bg-amber-400' : 'bg-red-500';
                  return (
                    <div key={cs.courseId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-800 dark:text-gray-300 truncate mr-2">
                          {cs.courseName}
                        </span>
                        <span className="text-xs font-bold text-slate-950 dark:text-white flex-shrink-0">{cs.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${cs.pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent absences */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Last {RECENT_ABSENCE_DISPLAY_COUNT} Absences
            </h4>
            {absences.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No recent absences.</p>
            ) : (
              <div className="space-y-2">
                {absences.map((ab, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{ab.courseName}</span>
                    <span className="text-xs font-medium text-slate-600">
                      {new Date(ab.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function AllStudentsPage() {
  const { user: currentUser } = useAuth();
  const schoolScope = currentUser?.role === 'SUB_ADMIN' ? `&schoolId=${currentUser.schoolId}` : '';
  const { data: students } = useApi<StudentWithEnrollments[]>(`/users?role=STUDENT&status=APPROVED${schoolScope}`);
  const { data: courses } = useApi<Course[]>('/courses');

  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [drawerStudent, setDrawerStudent] = useState<StudentWithEnrollments | null>(null);

  const facets = useMemo(() => {
    if (!courses) return { levels: [], majors: [], cohorts: [] };
    const levelsMap = new Map<string, Level>();
    const majorsMap = new Map<string, Major>();
    const cohortsMap = new Map<string, Cohort>();
    for (const c of courses) {
      c.levels?.forEach(({ level }) => levelsMap.set(level.id, level));
      c.majors?.forEach(({ major }) => majorsMap.set(major.id, major));
      c.cohorts?.forEach(({ cohort }) => cohortsMap.set(cohort.id, cohort));
    }
    return {
      levels: Array.from(levelsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      majors: Array.from(majorsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      cohorts: Array.from(cohortsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [courses]);

  const courseTagMap = useMemo(() => {
    if (!courses) return new Map<string, { levelIds: string[]; majorIds: string[]; cohortIds: string[] }>();
    const map = new Map<string, { levelIds: string[]; majorIds: string[]; cohortIds: string[] }>();
    for (const c of courses) {
      map.set(c.id, {
        levelIds: c.levels?.map(({ level }) => level.id) ?? [],
        majorIds: c.majors?.map(({ major }) => major.id) ?? [],
        cohortIds: c.cohorts?.map(({ cohort }) => cohort.id) ?? [],
      });
    }
    return map;
  }, [courses]);

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          (s.studentId || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedLevels.length > 0 || selectedMajors.length > 0 || selectedCohorts.length > 0) {
        const studentCourseIds = s.enrollments?.map((e) => e.course?.id).filter(Boolean) ?? [];
        if (studentCourseIds.length === 0) return false;
        const matchesFilter = studentCourseIds.some((cid) => {
          const tags = courseTagMap.get(cid!);
          if (!tags) return false;
          const levelMatch = selectedLevels.length === 0 || selectedLevels.some((id) => tags.levelIds.includes(id));
          const majorMatch = selectedMajors.length === 0 || selectedMajors.some((id) => tags.majorIds.includes(id));
          const cohortMatch = selectedCohorts.length === 0 || selectedCohorts.some((id) => tags.cohortIds.includes(id));
          return levelMatch && majorMatch && cohortMatch;
        });
        if (!matchesFilter) return false;
      }
      return true;
    });
  }, [students, search, selectedLevels, selectedMajors, selectedCohorts, courseTagMap]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) => {
    setter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const clearFilters = () => {
    setSelectedLevels([]);
    setSelectedMajors([]);
    setSelectedCohorts([]);
    setSearch('');
  };

  const activeFilterCount = selectedLevels.length + selectedMajors.length + selectedCohorts.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">All Students</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {filtered.length} of {students?.length ?? 0} students
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Filter sidebar */}
        <div className={`flex-shrink-0 transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'}`}>
          <div className="glass-card p-4 space-y-5 sticky top-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Filter size={12} /> Filters
              </span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer">Clear all</button>
              )}
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <FacetSection title="Level" items={facets.levels} selected={selectedLevels} onToggle={toggle(setSelectedLevels)} />
            <FacetSection title="Major" items={facets.majors} selected={selectedMajors} onToggle={toggle(setSelectedMajors)} />
            <FacetSection title="Cohort" items={facets.cohorts} selected={selectedCohorts} onToggle={toggle(setSelectedCohorts)} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            >
              <Filter size={16} />
            </button>
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedLevels.map((id) => {
                  const lvl = facets.levels.find((l) => l.id === id);
                  return lvl ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400">
                      {lvl.name}
                      <button onClick={() => toggle(setSelectedLevels)(id)} className="cursor-pointer"><X size={10} /></button>
                    </span>
                  ) : null;
                })}
                {selectedMajors.map((id) => {
                  const maj = facets.majors.find((m) => m.id === id);
                  return maj ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 dark:bg-green-500/20 dark:text-green-400">
                      {maj.name}
                      <button onClick={() => toggle(setSelectedMajors)(id)} className="cursor-pointer"><X size={10} /></button>
                    </span>
                  ) : null;
                })}
                {selectedCohorts.map((id) => {
                  const coh = facets.cohorts.find((c) => c.id === id);
                  return coh ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 dark:bg-yellow-500/20 dark:text-yellow-400">
                      {coh.name}
                      <button onClick={() => toggle(setSelectedCohorts)(id)} className="cursor-pointer"><X size={10} /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm gradient-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Major / Year</th>
                  <th>Overall Attendance</th>
                  <th>Health Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-gray-300">
                {filtered.map((s) => {
                  const pct = getDummyAttendancePct(s.id);
                  const health = getHealthStatus(pct);
                  const majorName = s.enrollments?.[0]?.course?.majors?.[0]?.major?.name;
                  const cohortName = s.enrollments?.[0]?.course?.cohorts?.[0]?.cohort?.name;

                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {s.firstName?.[0]}{s.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-950 dark:text-white">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{s.studentId || s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs">
                          <p className="font-medium text-slate-800 dark:text-gray-300">{majorName || '—'}</p>
                          <p className="text-slate-600 dark:text-slate-400">{cohortName || '—'}</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${health.dot}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-950 dark:text-white text-xs">{pct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium`}>
                          <span className={`w-2 h-2 rounded-full ${health.dot}`} />
                          <Badge color={health.color}>{health.label}</Badge>
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setDrawerStudent(s)}
                          className="text-xs font-medium text-blue-500 hover:text-blue-600 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          View Profile →
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <GraduationCap size={40} className="mx-auto text-slate-400 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {activeFilterCount > 0 ? 'No students match the current filters.' : 'No students found.'}
                      </p>
                      {activeFilterCount > 0 && (
                        <button onClick={clearFilters} className="mt-2 text-xs text-blue-500 hover:text-blue-600 cursor-pointer">
                          Clear all filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-out drawer */}
      {drawerStudent && (
        <StudentDrawer student={drawerStudent} onClose={() => setDrawerStudent(null)} />
      )}
    </div>
  );
}

function FacetSection({
  title, items, selected, onToggle,
}: {
  title: string;
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        {selected.length > 0 && (
          <span className="ml-auto text-blue-500 normal-case tracking-normal font-medium">{selected.length}</span>
        )}
      </button>
      {expanded && (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500/40 dark:border-white/20 dark:bg-white/5 cursor-pointer"
              />
              <span className="text-sm text-slate-800 dark:text-gray-300 truncate">{item.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
