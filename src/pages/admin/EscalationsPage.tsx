import { useState, useMemo } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LifeBuoy, Clock, CheckCircle2, AlertTriangle, GraduationCap, BookOpen, Search } from 'lucide-react';
import type { Escalation } from '../../types';

const timeAgo = (dateStr: string) => {
  // eslint-disable-next-line react-hooks/purity -- relative time uses wall clock at render
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/** Escalations sitting open longer read hotter — a fresh one is routine, a day-old one is a
 * student who's been stuck with no resolution, which deserves to visually stand out. */
function urgency(e: Escalation): { label: string; color: 'red' | 'yellow' | 'blue' } {
  if (e.status === 'RESOLVED') return { label: 'Resolved', color: 'blue' };
  const hours = (Date.now() - new Date(e.createdAt).getTime()) / 3_600_000;
  if (hours >= 24) return { label: 'Stale', color: 'red' };
  if (hours >= 2) return { label: 'Waiting', color: 'yellow' };
  return { label: 'New', color: 'red' };
}

export function EscalationsPage() {
  const { user } = useAuth();
  const isLecturer = user?.role === 'LECTURER';
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const { data: escalations, refetch } = useApi<Escalation[]>(
    statusFilter === 'ALL' ? '/escalations' : `/escalations?status=${statusFilter}`,
    { refetchIntervalMs: 30_000, refetchWhenVisible: true },
  );
  const { mutate: resolve, loading: resolving } = useMutation<Escalation>('patch');

  const filtered = useMemo(() => {
    const list = escalations || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((e) =>
      `${e.student?.firstName} ${e.student?.lastName}`.toLowerCase().includes(q) ||
      (e.class?.course.name || '').toLowerCase().includes(q) ||
      e.reason.toLowerCase().includes(q));
  }, [escalations, search]);

  const openCount = (escalations || []).filter((e) => e.status === 'OPEN').length;
  const staleCount = (escalations || []).filter((e) => e.status === 'OPEN' && urgency(e).label === 'Stale').length;
  const selected = filtered.find((e) => e.id === selectedId) || null;

  const handleResolve = async (id: string) => {
    await resolve(`/escalations/${id}/resolve`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Escalations</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isLecturer ? 'Students who tapped "Escalate to Lecturer" on a stuck check-in' : 'Check-in escalations across your school'}
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <LifeBuoy size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-950 dark:text-white">{openCount}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Open right now</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-950 dark:text-white">{staleCount}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Open 24h+ (stale)</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-950 dark:text-white">
              {(escalations || []).filter((e) => e.status === 'RESOLVED').length}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Resolved (this view)</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-22rem)]">
        <div className="w-96 flex flex-col">
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search student, course, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 mb-4">
            {(['OPEN', 'RESOLVED', 'ALL'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === s
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="glass-card flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.map((e) => {
              const u = urgency(e);
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    selectedId === e.id
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-950 dark:text-white truncate flex-1">
                      {e.student?.firstName} {e.student?.lastName}
                    </p>
                    <span className="text-xs text-slate-600 dark:text-slate-400 flex-shrink-0">{timeAgo(e.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                    <BookOpen size={11} className="flex-shrink-0" /> {e.class?.course.name} — {e.class?.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-1">{e.reason}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge color={u.color}>{u.label}</Badge>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <LifeBuoy size={32} className="text-slate-400 dark:text-gray-600 mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400">No escalations{statusFilter !== 'ALL' ? ` (${statusFilter.toLowerCase()})` : ''}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 glass-card flex flex-col overflow-hidden">
          {selected ? (
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {selected.student?.firstName?.[0]}{selected.student?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-950 dark:text-white">
                      {selected.student?.firstName} {selected.student?.lastName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <GraduationCap size={12} /> {selected.student?.studentId || 'No student ID on file'}
                    </p>
                  </div>
                </div>
                <Badge color={urgency(selected).color}>{urgency(selected).label}</Badge>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Class</p>
                <p className="text-sm text-slate-950 dark:text-white">
                  {selected.class?.course.name} ({selected.class?.course.code}) — {selected.class?.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Clock size={11} />
                  {selected.class?.startTime && new Date(selected.class.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>

              <div className="rounded-xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 p-4 space-y-1.5">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">What the student reported</p>
                <p className="text-sm text-slate-950 dark:text-white">{selected.reason}</p>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-500">Escalated {timeAgo(selected.createdAt)}</p>

              {selected.status === 'OPEN' ? (
                <Button onClick={() => handleResolve(selected.id)} disabled={resolving} className="w-full">
                  <CheckCircle2 size={16} className="mr-1.5" /> Mark Resolved
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 p-4 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-slate-950 dark:text-white">
                    Resolved by {selected.resolvedBy?.firstName} {selected.resolvedBy?.lastName}
                    {selected.resolvedAt && ` · ${timeAgo(selected.resolvedAt)}`}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <LifeBuoy size={48} className="mx-auto mb-4 text-gray-200 dark:text-gray-700" />
                <p className="text-slate-600 text-sm">Select an escalation to see the full picture</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
