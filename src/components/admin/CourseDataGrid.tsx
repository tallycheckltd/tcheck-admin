import { useState, useEffect, useMemo, useCallback } from 'react';
import { Filter, ChevronDown, ChevronRight, Plus, X, Save, Search, BookOpen, GraduationCap, Layers } from 'lucide-react';
import type { Course, Major, Cohort, Level } from '../../types';
import { Badge } from '../ui/Badge';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SavedView {
  name: string;
  filters: { levels: string[]; majors: string[]; cohorts: string[] };
  groupBy: string | null;
}

type GroupByOption = 'major' | 'level' | 'cohort' | null;

interface CourseDataGridProps {
  courses: Course[];
}

const STORAGE_KEY = 'tcheck-saved-views';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistViews(views: SavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

/** Extract unique facet values from the courses array. */
function extractFacets(courses: Course[]) {
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
}

/* ------------------------------------------------------------------ */
/*  Multi-select checkbox list                                         */
/* ------------------------------------------------------------------ */

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
        className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        {selected.length > 0 && (
          <span className="ml-auto text-blue-500 normal-case tracking-normal font-medium">
            {selected.length}
          </span>
        )}
      </button>
      {expanded && (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {items.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500/40 dark:border-white/20 dark:bg-white/5 cursor-pointer"
                />
                <span className="text-sm text-slate-800 dark:text-gray-300 truncate">
                  {item.name}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible group header                                           */
/* ------------------------------------------------------------------ */

function GroupHeader({
  label,
  count,
  expanded,
  onToggle,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer mb-2"
    >
      {expanded ? (
        <ChevronDown size={14} className="text-slate-600 dark:text-slate-400" />
      ) : (
        <ChevronRight size={14} className="text-slate-600 dark:text-slate-400" />
      )}
      <span className="text-sm font-semibold text-slate-950 dark:text-white">{label}</span>
      <span className="ml-auto text-xs text-slate-600 dark:text-slate-400">{count} course{count !== 1 ? 's' : ''}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Course row                                                         */
/* ------------------------------------------------------------------ */

function CourseRow({ course }: { course: Course }) {
  return (
    <div className="glass-card px-5 py-4 flex items-center gap-4 group">
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-slate-950 dark:text-white truncate">
            {course.name}
          </span>
          <Badge color="blue">{course.code}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {course.lecturer && (
            <span>
              {course.lecturer.firstName} {course.lecturer.lastName}
            </span>
          )}
          {course.room && <span>Room: {course.room}</span>}
        </div>
      </div>

      {/* Junction badges */}
      <div className="hidden md:flex flex-wrap items-center gap-1.5 max-w-xs">
        {course.levels?.map(({ level }) => (
          <Badge key={level.id} color="purple">{level.name}</Badge>
        ))}
        {course.majors?.map(({ major }) => (
          <Badge key={major.id} color="green">{major.name}</Badge>
        ))}
        {course.cohorts?.map(({ cohort }) => (
          <Badge key={cohort.id} color="yellow">{cohort.name}</Badge>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 flex-shrink-0">
        <span className="flex items-center gap-1">
          <GraduationCap size={12} />
          {course._count?.enrollments ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <BookOpen size={12} />
          {course._count?.classes ?? 0}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CourseDataGrid({ courses }: CourseDataGridProps) {
  /* --- Sidebar toggle --- */
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* --- Search --- */
  const [search, setSearch] = useState('');

  /* --- Filters --- */
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);

  /* --- Group by --- */
  const [groupBy, setGroupBy] = useState<GroupByOption>(null);

  /* --- Collapsed groups --- */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  /* --- Saved views --- */
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews);
  const [activeViewIndex, setActiveViewIndex] = useState<number | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // Sync saved views to localStorage
  useEffect(() => {
    persistViews(savedViews);
  }, [savedViews]);

  /* --- Facets --- */
  const facets = useMemo(() => extractFacets(courses), [courses]);

  /* --- Toggle helpers --- */
  const toggle = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) => {
      setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      setActiveViewIndex(null);
    },
    [],
  );

  const toggleLevel = toggle(setSelectedLevels);
  const toggleMajor = toggle(setSelectedMajors);
  const toggleCohort = toggle(setSelectedCohorts);

  const clearFilters = () => {
    setSelectedLevels([]);
    setSelectedMajors([]);
    setSelectedCohorts([]);
    setGroupBy(null);
    setActiveViewIndex(null);
    setSearch('');
  };

  const activeFilterCount = selectedLevels.length + selectedMajors.length + selectedCohorts.length;

  /* --- Apply a saved view --- */
  const applyView = (index: number) => {
    const view = savedViews[index];
    if (!view) return;
    setSelectedLevels(view.filters.levels);
    setSelectedMajors(view.filters.majors);
    setSelectedCohorts(view.filters.cohorts);
    setGroupBy((view.groupBy as GroupByOption) ?? null);
    setActiveViewIndex(index);
    setCollapsedGroups(new Set());
  };

  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;
    const view: SavedView = {
      name,
      filters: { levels: selectedLevels, majors: selectedMajors, cohorts: selectedCohorts },
      groupBy,
    };
    const updated = [...savedViews, view];
    setSavedViews(updated);
    setActiveViewIndex(updated.length - 1);
    setNewViewName('');
    setShowSaveInput(false);
  };

  const removeView = (index: number) => {
    const updated = savedViews.filter((_, i) => i !== index);
    setSavedViews(updated);
    if (activeViewIndex === index) setActiveViewIndex(null);
    else if (activeViewIndex !== null && activeViewIndex > index) setActiveViewIndex(activeViewIndex - 1);
  };

  /* --- Filtered courses --- */
  const filtered = useMemo(() => {
    return courses.filter((c) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matchesText =
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          `${c.lecturer?.firstName ?? ''} ${c.lecturer?.lastName ?? ''}`.toLowerCase().includes(q) ||
          (c.room ?? '').toLowerCase().includes(q);
        if (!matchesText) return false;
      }

      // Level filter
      if (selectedLevels.length > 0) {
        const courselevels = c.levels?.map(({ level }) => level.id) ?? [];
        if (!selectedLevels.some((id) => courselevels.includes(id))) return false;
      }

      // Major filter
      if (selectedMajors.length > 0) {
        const courseMajors = c.majors?.map(({ major }) => major.id) ?? [];
        if (!selectedMajors.some((id) => courseMajors.includes(id))) return false;
      }

      // Cohort filter
      if (selectedCohorts.length > 0) {
        const courseCohorts = c.cohorts?.map(({ cohort }) => cohort.id) ?? [];
        if (!selectedCohorts.some((id) => courseCohorts.includes(id))) return false;
      }

      return true;
    });
  }, [courses, search, selectedLevels, selectedMajors, selectedCohorts]);

  /* --- Grouped courses --- */
  const grouped = useMemo<{ label: string; key: string; courses: Course[] }[] | null>(() => {
    if (!groupBy) return null;

    const groups = new Map<string, { label: string; courses: Course[] }>();

    for (const course of filtered) {
      let entries: { id: string; name: string }[] = [];

      if (groupBy === 'level') {
        entries = course.levels?.map(({ level }) => level) ?? [];
      } else if (groupBy === 'major') {
        entries = course.majors?.map(({ major }) => major) ?? [];
      } else if (groupBy === 'cohort') {
        entries = course.cohorts?.map(({ cohort }) => cohort) ?? [];
      }

      if (entries.length === 0) {
        const key = '__ungrouped__';
        if (!groups.has(key)) groups.set(key, { label: 'Unassigned', courses: [] });
        groups.get(key)!.courses.push(course);
      } else {
        for (const entry of entries) {
          if (!groups.has(entry.id)) groups.set(entry.id, { label: entry.name, courses: [] });
          groups.get(entry.id)!.courses.push(course);
        }
      }
    }

    return Array.from(groups.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => {
        if (a.key === '__ungrouped__') return 1;
        if (b.key === '__ungrouped__') return -1;
        return a.label.localeCompare(b.label);
      });
  }, [filtered, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* --- Render --- */
  return (
    <div className="space-y-4">
      {/* Saved view tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={clearFilters}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeViewIndex === null && activeFilterCount === 0
              ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/10'
          }`}
        >
          All Courses
        </button>

        {savedViews.map((view, i) => (
          <div key={i} className="flex items-center gap-0">
            <button
              onClick={() => applyView(i)}
              className={`px-3 py-1.5 rounded-l-lg text-xs font-medium transition-colors cursor-pointer ${
                activeViewIndex === i
                  ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/10'
              }`}
            >
              {view.name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeView(i);
              }}
              className={`px-1.5 py-1.5 rounded-r-lg text-xs transition-colors cursor-pointer ${
                activeViewIndex === i
                  ? 'bg-blue-600 text-blue-200 hover:text-white'
                  : 'bg-gray-100 text-slate-600 dark:text-slate-400 hover:text-gray-600 dark:bg-white/5 dark:text-slate-400 dark:hover:text-gray-300'
              }`}
              title="Remove view"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {showSaveInput ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCurrentView();
                if (e.key === 'Escape') {
                  setShowSaveInput(false);
                  setNewViewName('');
                }
              }}
              placeholder="View name..."
              autoFocus
              className="w-32 px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              onClick={saveCurrentView}
              disabled={!newViewName.trim()}
              className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors cursor-pointer"
              title="Save view"
            >
              <Save size={12} />
            </button>
            <button
              onClick={() => {
                setShowSaveInput(false);
                setNewViewName('');
              }}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveInput(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 border border-dashed border-gray-300 dark:border-white/10 transition-colors cursor-pointer"
          >
            <Plus size={12} />
            Save View
          </button>
        )}
      </div>

      {/* Main layout: sidebar + grid */}
      <div className="flex gap-4">
        {/* Filter sidebar */}
        <div
          className={`flex-shrink-0 transition-all duration-200 ${
            sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'
          }`}
        >
          <div className="glass-card p-4 space-y-5 sticky top-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Filter size={12} />
                Filters
              </span>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Search within filters */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <FacetSection
              title="Level"
              items={facets.levels}
              selected={selectedLevels}
              onToggle={toggleLevel}
            />
            <FacetSection
              title="Major"
              items={facets.majors}
              selected={selectedMajors}
              onToggle={toggleMajor}
            />
            <FacetSection
              title="Cohort"
              items={facets.cohorts}
              selected={selectedCohorts}
              onToggle={toggleCohort}
            />

            {/* Group By */}
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                Group By
              </span>
              <select
                value={groupBy ?? ''}
                onChange={(e) => {
                  setGroupBy((e.target.value || null) as GroupByOption);
                  setCollapsedGroups(new Set());
                  setActiveViewIndex(null);
                }}
                className="w-full rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
              >
                <option value="">None</option>
                <option value="level">Level</option>
                <option value="major">Major</option>
                <option value="cohort">Cohort</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title={sidebarOpen ? 'Hide filters' : 'Show filters'}
              >
                <Filter size={16} />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {filtered.length} of {courses.length} course{courses.length !== 1 ? 's' : ''}
              </span>
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-1.5 ml-2">
                  {selectedLevels.map((id) => {
                    const lvl = facets.levels.find((l) => l.id === id);
                    return lvl ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
                      >
                        {lvl.name}
                        <button onClick={() => toggleLevel(id)} className="hover:text-purple-900 dark:hover:text-purple-200 cursor-pointer">
                          <X size={10} />
                        </button>
                      </span>
                    ) : null;
                  })}
                  {selectedMajors.map((id) => {
                    const maj = facets.majors.find((m) => m.id === id);
                    return maj ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 dark:bg-green-500/20 dark:text-green-400"
                      >
                        {maj.name}
                        <button onClick={() => toggleMajor(id)} className="hover:text-emerald-900 dark:hover:text-green-200 cursor-pointer">
                          <X size={10} />
                        </button>
                      </span>
                    ) : null;
                  })}
                  {selectedCohorts.map((id) => {
                    const coh = facets.cohorts.find((c) => c.id === id);
                    return coh ? (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 dark:bg-yellow-500/20 dark:text-yellow-400"
                      >
                        {coh.name}
                        <button onClick={() => toggleCohort(id)} className="hover:text-amber-900 dark:hover:text-yellow-200 cursor-pointer">
                          <X size={10} />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {groupBy && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Layers size={12} />
                Grouped by {groupBy}
              </div>
            )}
          </div>

          {/* Course list */}
          {filtered.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Search size={40} className="mx-auto text-slate-400 dark:text-gray-600 mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No courses match the current filters.
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs text-blue-500 hover:text-blue-600 cursor-pointer transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : grouped ? (
            <div className="space-y-3">
              {grouped.map((group) => {
                const isCollapsed = collapsedGroups.has(group.key);
                return (
                  <div key={group.key}>
                    <GroupHeader
                      label={group.label}
                      count={group.courses.length}
                      expanded={!isCollapsed}
                      onToggle={() => toggleGroup(group.key)}
                    />
                    {!isCollapsed && (
                      <div className="space-y-2 ml-4">
                        {group.courses.map((course) => (
                          <CourseRow key={course.id} course={course} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((course) => (
                <CourseRow key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
