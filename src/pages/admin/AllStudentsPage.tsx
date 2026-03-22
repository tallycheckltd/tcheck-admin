import { useState, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { GraduationCap, Search, Filter, ChevronDown, ChevronRight, X, Mail } from 'lucide-react';
import type { User, Course, Major, Cohort, Level } from '../../types';

interface StudentWithEnrollments extends User {
  enrollments?: { course: Course }[];
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

  // Extract facets from courses
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

  // Build a map of courseId -> tags for filtering
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

  // Filter students
  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matches =
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          (s.studentId || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Tag filters - check if student is enrolled in any course matching the filter
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Directory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} of {students?.length ?? 0} students
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Filter sidebar */}
        <div className={`flex-shrink-0 transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'}`}>
          <div className="glass-card p-4 space-y-5 sticky top-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Filter size={12} /> Filters
              </span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer">Clear all</button>
              )}
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            >
              <Filter size={16} />
            </button>
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5">
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
                  <th>Name</th>
                  <th>Student ID</th>
                  <th>Email</th>
                  <th>School</th>
                  <th>Status</th>
                  <th>Courses</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {s.firstName?.[0]}{s.lastName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs">{s.studentId || '-'}</td>
                    <td>
                      <span className="flex items-center gap-1 text-xs">
                        <Mail size={12} className="text-gray-400" />
                        {s.email}
                      </span>
                    </td>
                    <td>{s.school?.name || '-'}</td>
                    <td>
                      <Badge color={s.status === 'APPROVED' ? 'green' : s.status === 'PENDING' ? 'yellow' : 'red'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="font-medium">{s._count?.enrollments ?? 0}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <GraduationCap size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
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
    </div>
  );
}

// Reusable facet checkbox section
function FacetSection({
  title,
  items,
  selected,
  onToggle,
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
        className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
