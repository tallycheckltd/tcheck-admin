import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

export interface CourseDrilldownGroup {
  course: { id: string; code: string; name: string };
  count: number;
}

interface CourseDrilldownProps {
  groups: CourseDrilldownGroup[];
  onSelect: (courseId: string) => void;
  /** Singular noun for the per-card count, e.g. "session". */
  countNoun: string;
  /** Plural form — "class" pluralizes irregularly ("classes"), so this isn't derived automatically. */
  countNounPlural: string;
  emptyTitle: string;
}

/**
 * Level 1 of the course -> sessions/classes -> detail drill-down used by both Lecturer and
 * Admin/HOD for Attendance and Classes (Section 2/3 of the IA overhaul) — one grid implementation
 * instead of four near-identical copies that would drift out of sync.
 */
export function CourseDrilldown({ groups, onSelect, countNoun, countNounPlural, emptyTitle }: CourseDrilldownProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map(({ course, count }) => (
        <button
          key={course.id}
          onClick={() => onSelect(course.id)}
          className="glass-card p-5 text-left hover:ring-2 hover:ring-blue-500/30 transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-blue-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{course.code}</span>
              </div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white mt-1 truncate">{course.name}</p>
            </div>
            <ChevronRight size={16} className="text-slate-400 dark:text-slate-600 flex-shrink-0 mt-1" />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
            {count} {count === 1 ? countNoun : countNounPlural}
          </p>
        </button>
      ))}
      {groups.length === 0 && (
        <div className="col-span-full">
          <EmptyState icon={BookOpen} title={emptyTitle} size="md" />
        </div>
      )}
    </div>
  );
}

/** Back button shown above the Level 1 heading once a course is selected — identical in both drill-downs. */
export function CourseDrilldownBackLink({ onClick, label = 'All Courses' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-1 cursor-pointer"
    >
      <ChevronLeft size={15} /> {label}
    </button>
  );
}
