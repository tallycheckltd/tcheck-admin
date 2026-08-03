import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { ScanEye, ChevronDown, CheckCircle2, XCircle, Users, GraduationCap } from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

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

export function InvigilationPage() {
  const { data: cards, loading } = useApi<ExamCardRow[]>('/attendance/exam-cards', {
    refetchIntervalMs: 60_000,
    refetchWhenVisible: true,
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'eligible' | 'ineligible'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = (cards || [])
    .filter((c) => (filter === 'eligible' ? c.eligible : filter === 'ineligible' ? !c.eligible : true))
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.student.firstName.toLowerCase().includes(q) ||
        c.student.lastName.toLowerCase().includes(q) ||
        (c.student.studentId?.toLowerCase().includes(q) ?? false)
      );
    });

  const eligibleCount = cards?.filter((c) => c.eligible).length ?? 0;
  const ineligibleCount = (cards?.length ?? 0) - eligibleCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ScanEye className="text-blue-500" /> Invigilation
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Live exam-eligibility roster — the same data invigilators see when they scan a student's exam card. Refreshes every minute.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Students" value={cards?.length ?? 0} icon={<Users size={24} />} color="blue" />
        <StatCard title="Eligible" value={eligibleCount} icon={<CheckCircle2 size={24} />} color="green" />
        <StatCard title="Not Eligible" value={ineligibleCount} icon={<XCircle size={24} />} color="red" />
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/10 backdrop-blur-md">
        <div className="flex-1 min-w-[280px]">
          <SearchInput placeholder="Search by name or student ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-xl gap-1">
          {(['all', 'eligible', 'ineligible'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${
                filter === f
                  ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {f === 'ineligible' ? 'Not Eligible' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students match" description="Try a different search or filter." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.map((row) => {
              const isOpen = expanded === row.student.id;
              return (
                <div key={row.student.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.student.id)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-slate-500 dark:text-gray-400 font-bold text-xs flex-shrink-0">
                        {row.student.firstName[0]}{row.student.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {row.student.firstName} {row.student.lastName}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{row.student.studentId || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 hidden sm:inline">{row.courses.length} course{row.courses.length === 1 ? '' : 's'}</span>
                      <Badge color={row.eligible ? 'green' : 'red'}>{row.eligible ? 'Eligible' : 'Not Eligible'}</Badge>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 bg-gray-50/50 dark:bg-white/[0.02]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                        {row.courses.map((c) => (
                          <div key={c.courseId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{c.courseCode}</p>
                              <p className="text-[10px] text-gray-400 truncate">{c.attended}/{c.total} classes</p>
                            </div>
                            <span className={`text-xs font-bold flex-shrink-0 ml-2 ${c.percentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {c.percentage}%
                            </span>
                          </div>
                        ))}
                        {row.courses.length === 0 && (
                          <p className="text-xs text-gray-400 italic py-2">Not enrolled in any course.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
