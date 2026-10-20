import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Clock, Download, HeartHandshake, MessageCircleQuestion, Phone, Power, Search, Sparkles, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import type { TaliAccess } from './TaliSetup';

/**
 * TALI for staff (doc B3, B6). Rebuilt 2026-10-10 around one idea: don't show data, show what to do
 * next. Three sections:
 *   This week            who to check on (a short list with one-tap actions), then the picture
 *   Ask                  one box for a question in plain words, the answer as a chart and a sentence
 *   What students ask    what students are asking TALI and where it could not answer
 * Setting up (the school's documents) lives in Institution Setup; on/off lives in Settings.
 *
 * Every call goes to /insights/* on our own backend, which checks the role, the TALI permissions
 * and the switches, limits a Dean / HOD to their own faculty or department, and attaches names.
 */

type Tab = 'week' | 'ask' | 'students';
const muted = 'text-slate-600 dark:text-slate-400';
const strong = 'text-slate-950 dark:text-white';
const selectCls = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';
const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const BLUE = '#3B82F6';
const tooltipStyle = { backgroundColor: 'rgba(15,23,42,0.92)', border: 'none', borderRadius: 12, fontSize: 12, color: '#fff' } as const;

function Loading() { return <p className={clsx('text-sm', muted)}>Loading…</p>; }
function Problem({ error }: { error: string }) {
  return <GlassCard><p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><AlertTriangle size={16} /> {error}</p></GlassCard>;
}

// ── Students to check on ────────────────────────────────────────────────────────────────────
interface Finding {
  id: string; studentRef: string; studentName?: string | null; studentNumber?: string | null; category: string; status: string; score: number;
  reasons: string[]; metrics: { rate?: number; attended?: number; held?: number; consecutive?: number }; firstSeen?: string; lastActionAt?: string | null;
  actions?: { type: string; note?: string | null; createdAt?: string; actorName?: string | null }[];
  result?: { result: 'improved' | 'same' | 'worse' | 'too_early' | 'not_enough_classes'; before: { held: number; attended: number }; after: { held: number; attended: number } } | null;
}

/** "high" and "medium" are our words. Staff see how soon someone needs a check-in. */
const URGENCY: Record<string, { label: string; color: 'red' | 'yellow' | 'gray' }> = { high: { label: 'Urgent', color: 'red' }, medium: { label: 'This week', color: 'yellow' } };

/** TALI's reason codes ("below_threshold: ACC101 62% < 75%") in plain words. */
function reasonText(r: string): string {
  const i = r.indexOf(':');
  const code = i < 0 ? '' : r.slice(0, i);
  const rest = (i < 0 ? r : r.slice(i + 1)).trim();
  if (code === 'below_threshold') {
    const m = /^(\S+) (\d+)% < (\d+)%$/.exec(rest);
    if (m) return `${m[2]}% attendance in ${m[1]} (the school asks for ${m[3]}%)`;
  }
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** The one line that says why this student is on the list, in whole classes rather than a score. */
function whyLine(f: Finding): string {
  const { attended = 0, held = 0, consecutive = 0 } = f.metrics;
  if (consecutive >= 3) return `Missed the last ${consecutive} classes. Attended ${attended} of ${held} in the past 4 weeks.`;
  return `Attended ${attended} of ${held} classes in the past 4 weeks.`;
}

/** A suggestion, never an instruction: what to do is the member of staff's decision. */
function nextStep(f: Finding): string {
  const { rate = 1, consecutive = 0 } = f.metrics;
  if (consecutive >= 4) return 'Has not been seen for a while. A phone call today is the best first step.';
  if (rate < 0.5) return 'Attending less than half of classes. Arrange to meet in person.';
  return 'Starting to slip. A short message to check in is a good start.';
}

const ACTIONS: { type: string; label: string; done: string; icon: typeof Phone }[] = [
  { type: 'contacted_student', label: 'Contacted', done: 'contacted', icon: Phone },
  { type: 'meeting_held', label: 'Met', done: 'met', icon: Users },
  { type: 'referred_counsellor', label: 'Sent to counselling', done: 'referred to counselling', icon: HeartHandshake },
];
const ACTION_WORDS: Record<string, string> = { contacted_student: 'Contacted the student', meeting_held: 'Met the student', referred_counsellor: 'Referred to counselling', message_sent: 'Sent a message', assigned: 'Assigned to someone', other: 'Other' };
const RESULT_WORDS: Record<string, string> = {
  improved: 'Attendance improved after this.', same: 'Attendance stayed about the same after this.', worse: 'Attendance fell further after this.',
  too_early: 'Too early to tell. TALI compares the 3 weeks after with the 3 weeks before.', not_enough_classes: 'Not enough classes on either side to compare.',
};

function ToDoList({ canAct, onOpen, refreshKey, onChanged }: { canAct: boolean; onOpen: (id: string) => void; refreshKey: number; onChanged: () => void }) {
  const { data, loading, error, refetch } = useApi<{ items: Finding[] }>('/insights/flags?status=open&limit=100');
  useEffect(() => { if (refreshKey) void refetch({ silent: true }); }, [refreshKey, refetch]);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; undoId?: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Nobody has done anything yet, most urgent first (the order TALI returns).
  const waiting = useMemo(() => (data?.items ?? []).filter((f) => !f.lastActionAt && !gone.has(f.id)), [data, gone]);
  const shown = showAll ? waiting : waiting.slice(0, 8);

  const act = async (f: Finding, a: (typeof ACTIONS)[number]) => {
    setBusy(f.id);
    try {
      await api.post(`/insights/flags/${f.id}/actions`, { type: a.type });
      setGone((g) => new Set(g).add(f.id));
      setNote({ text: `Saved: ${f.studentName ?? 'Student'} ${a.done}. TALI will show whether attendance improves.` });
      onChanged();
    } catch (e) { setNote({ text: e instanceof Error ? e.message : 'Could not save' }); } finally { setBusy(null); }
  };
  const notNeeded = async (f: Finding) => {
    setBusy(f.id);
    try {
      await api.patch(`/insights/flags/${f.id}`, { status: 'dismissed' });
      setGone((g) => new Set(g).add(f.id));
      setNote({ text: `${f.studentName ?? 'Student'} taken off the list.`, undoId: f.id });
      onChanged();
    } catch (e) { setNote({ text: e instanceof Error ? e.message : 'Could not save' }); } finally { setBusy(null); }
  };
  const undo = async (id: string) => {
    try { await api.patch(`/insights/flags/${id}`, { status: 'open' }); setGone((g) => { const n = new Set(g); n.delete(id); return n; }); setNote(null); onChanged(); } catch { setNote({ text: 'Could not undo.' }); }
  };

  if (loading) return <Loading />;
  if (error) return <Problem error={error} />;
  return (
    <GlassCard>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={clsx('text-lg font-semibold', strong)}>Students to check on</h2>
        <span className={clsx('text-xs', muted)}>{waiting.length ? `${waiting.length}${(data?.items.length ?? 0) >= 100 ? '+' : ''} waiting for someone to reach out` : ''}</span>
      </div>
      <p className={clsx('text-sm mt-0.5 max-w-3xl', muted)}>
        These students' attendance has dropped. What happens next is your call: reach out, then tap what you did. TALI never contacts a student or changes anything by itself.
      </p>
      {note && (
        <p role="status" className="mt-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-200 text-sm px-3 py-2 flex flex-wrap items-center gap-3">
          <CheckCircle2 size={16} className="shrink-0" /> <span className="flex-1">{note.text}</span>
          {note.undoId && <button type="button" className="font-semibold underline cursor-pointer" onClick={() => void undo(note.undoId!)}>Undo</button>}
        </p>
      )}
      {shown.length ? (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-white/5">
          {shown.map((f) => {
            const u = URGENCY[f.category] ?? { label: f.category, color: 'gray' as const };
            return (
              <li key={f.id} className="py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <button type="button" onClick={() => onOpen(f.id)} className="flex-1 min-w-0 text-left cursor-pointer group">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={clsx('font-semibold group-hover:underline', strong)}>{f.studentName ?? 'Student'}</span>
                    {f.studentNumber && <span className={clsx('text-xs', muted)}>{f.studentNumber}</span>}
                    <Badge color={u.color}>{u.label}</Badge>
                  </span>
                  <span className={clsx('block text-sm mt-1', strong)}>{whyLine(f)}</span>
                  <span className={clsx('block text-xs mt-0.5', muted)}>{nextStep(f)}</span>
                </button>
                {canAct && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {ACTIONS.map((a) => (
                      <Button key={a.type} size="sm" variant={a.type === 'contacted_student' ? 'primary' : 'secondary'} disabled={busy === f.id} onClick={() => void act(f, a)}>
                        <a.icon size={14} className="mr-1.5 inline" />{a.label}
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" disabled={busy === f.id} onClick={() => void notNeeded(f)}>Not needed</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState size="sm" icon={CheckCircle2} title="Nobody is waiting on you" description="Every student on the list has been reached, or attendance is holding up. Check back after tonight's count." />
      )}
      {waiting.length > 8 && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show fewer' : `Show ${waiting.length - 8} more`}</Button>
      )}
    </GlassCard>
  );
}

// ── Everyone on the list (search, filter, load more) ────────────────────────────────────────
function EveryoneList({ onOpen, departments, refreshKey }: { onOpen: (id: string) => void; departments: { id: string; name: string }[]; refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Finding[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [dept, setDept] = useState('');

  const load = async (reset: boolean) => {
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams({ status: 'active', limit: '100' });
      if (level) p.set('category', level);
      if (dept) p.set('orgUnitId', dept);
      if (!reset && cursor) p.set('cursor', cursor);
      const r = await api.get<{ items: Finding[]; nextCursor: string | null }>(`/insights/flags?${p.toString()}`);
      setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
      setCursor(r.nextCursor);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load'); } finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) void load(true); }, [open, level, dept, refreshKey]);
  const shown = useMemo(() => items.filter((f) => !q.trim() || `${f.studentName ?? ''} ${f.studentNumber ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);

  return (
    <GlassCard>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 text-left cursor-pointer">
        <span><span className={clsx('font-semibold', strong)}>Everyone on the list</span>
          <span className={clsx('block text-xs', muted)}>Search by name, or narrow by department. Includes students someone has already reached.</span></span>
        <ChevronRight size={18} className={clsx('shrink-0 transition-transform', muted, open && 'rotate-90')} />
      </button>
      {open && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <div className="w-64"><SearchInput aria-label="Search students" placeholder="Search name or number" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select aria-label="How soon" value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
              <option value="">Everyone</option><option value="high">Urgent</option><option value="medium">This week</option>
            </select>
            {departments.length > 1 && (
              <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className={selectCls}>
                <option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          {shown.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className={clsx('text-left text-xs uppercase tracking-wider', muted)}><th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Why</th><th className="py-2 pr-3">Classes attended, 4 weeks</th><th className="py-2">Reached?</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {shown.map((f) => (
                    <tr key={f.id} onClick={() => onOpen(f.id)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="py-2.5 pr-3"><span className={clsx('font-medium', strong)}>{f.studentName ?? 'Student'}</span>
                        <span className={clsx('block text-xs', muted)}>{f.studentNumber} {f.category === 'high' && <span className="text-red-600 dark:text-red-400 font-medium">· Urgent</span>}</span></td>
                      <td className={clsx('py-2.5 pr-3 text-xs', muted)}>{reasonText(f.reasons[0] ?? '')}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{f.metrics.attended ?? 0} of {f.metrics.held ?? 0} <span className={clsx('text-xs', muted)}>({pct(f.metrics.rate)})</span></td>
                      <td className={clsx('py-2.5 text-xs', f.lastActionAt ? 'text-green-700 dark:text-green-400' : muted)}>{f.lastActionAt ? `Yes, ${f.lastActionAt.slice(0, 10)}` : 'Not yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : loading ? <Loading /> : <p className={clsx('text-sm', muted)}>{items.length ? 'No one matches that search among the students loaded so far.' : 'Nobody is on the list.'}</p>}
          {cursor && <Button variant="secondary" size="sm" className="mt-3" disabled={loading} onClick={() => void load(false)}>{loading ? 'Loading…' : 'Load more'}</Button>}
        </div>
      )}
    </GlassCard>
  );
}

// ── One student: a panel from the side ──────────────────────────────────────────────────────
interface StudentInsights { weeks: { weekStart: string; held: number; attended: number; rate: number | string }[] }

function StudentPanel({ id, onClose, canAct, onChanged }: { id: string | null; onClose: () => void; canAct: boolean; onChanged: () => void }) {
  const { data: f, loading, error, refetch } = useApi<Finding>(id ? `/insights/flags/${encodeURIComponent(id)}` : null);
  const { data: s } = useApi<StudentInsights>(f?.studentRef ? `/insights/students/${encodeURIComponent(f.studentRef)}` : null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMsg(''); }, [id]);
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);
  if (!id) return null;
  const run = async (fn: () => Promise<unknown>, done: string, close = false) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(done); onChanged(); if (close) onClose(); else await refetch({ silent: true }); } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const weeks = [...(s?.weeks ?? [])].reverse().map((w) => ({ week: w.weekStart.slice(5), value: Math.round(Number(w.rate) * 100), attended: w.attended, held: w.held }));
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={f?.studentName ?? 'Student'}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full overflow-y-auto glass-light dark:glass shadow-2xl p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className={clsx('text-xl font-bold', strong)}>{f?.studentName ?? 'Student'}</h2>
            {f && <p className={clsx('text-sm', muted)}>{f.studentNumber} · on the list since {f.firstSeen}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={clsx('p-1 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10', muted)}><X size={18} /></button>
        </div>
        {loading || !f ? (error ? <p className="text-sm text-red-600">{error}</p> : <Loading />) : (
          <>
            <div>
              <p className={clsx('text-sm font-medium', strong)}>{whyLine(f)}</p>
              <p className={clsx('text-sm mt-1', muted)}>{nextStep(f)}</p>
            </div>
            {weeks.length > 1 && (
              <div>
                <h3 className={clsx('text-sm font-semibold mb-1', strong)}>Attendance, week by week</h3>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeks} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [`${v}% (${(p.payload as { attended: number }).attended} of ${(p.payload as { held: number }).held} classes)`, 'Attended']} />
                      <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            <div>
              <h3 className={clsx('text-sm font-semibold mb-1', strong)}>Why they are on the list</h3>
              <ul className="list-disc pl-5 space-y-0.5 text-sm">{f.reasons.map((r) => <li key={r}>{reasonText(r)}</li>)}</ul>
            </div>
            <div>
              <h3 className={clsx('text-sm font-semibold mb-1', strong)}>What has been done</h3>
              {f.actions?.length ? (
                <ul className="space-y-1 text-sm">{f.actions.map((a, i) => <li key={i}>{ACTION_WORDS[a.type] ?? a.type}{a.note ? `: ${a.note}` : ''} <span className={clsx('text-xs', muted)}>{a.actorName ? `${a.actorName}, ` : ''}{(a.createdAt ?? '').slice(0, 10)}</span></li>)}</ul>
              ) : <p className={clsx('text-sm', muted)}>Nobody has reached out yet.</p>}
              {f.result && f.actions?.some((a) => a.type !== 'assigned') && (
                <p className={clsx('text-sm mt-2 rounded-xl px-3 py-2', f.result.result === 'improved' ? 'bg-green-50 text-green-900 dark:bg-green-500/10 dark:text-green-200' : 'bg-gray-50 dark:bg-white/5')}>
                  {RESULT_WORDS[f.result.result]}
                  {(f.result.result === 'improved' || f.result.result === 'same' || f.result.result === 'worse') && (
                    <span className={clsx('block text-xs mt-0.5', muted)}>Before: {f.result.before.attended} of {f.result.before.held} classes. After: {f.result.after.attended} of {f.result.after.held}.</span>
                  )}
                </p>
              )}
            </div>
            {canAct ? (
              <div className="space-y-2">
                <h3 className={clsx('text-sm font-semibold', strong)}>What did you do?</h3>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map((a) => <Button key={a.type} size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => api.post(`/insights/flags/${f.id}/actions`, { type: a.type }), `Saved: ${a.done}.`)}><a.icon size={14} className="mr-1.5 inline" />{a.label}</Button>)}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.patch(`/insights/flags/${f.id}`, { status: 'resolved' }), 'Marked as sorted.', true)}>All sorted now</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.patch(`/insights/flags/${f.id}`, { status: 'dismissed' }), 'Taken off the list.', true)}>Not needed</Button>
                </div>
              </div>
            ) : <p className={clsx('text-xs', muted)}>You can see this student but not record actions.</p>}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-white/5 pt-3">
              <span className={clsx('text-xs', muted)}>Was TALI right to list this student?</span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.post(`/insights/flags/${f.id}/feedback`, { helpful: true }), 'Thanks.')}><ThumbsUp size={14} className="mr-1 inline" />Yes</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.post(`/insights/flags/${f.id}/feedback`, { helpful: false }), 'Thanks, noted.')}><ThumbsDown size={14} className="mr-1 inline" />No</Button>
            </div>
            <Link to={`/admin/users/${f.studentRef}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400">Open full profile <ArrowRight size={14} /></Link>
            {msg && <p role="status" className={clsx('text-sm', muted)}>{msg}</p>}
          </>
        )}
      </aside>
    </div>
  );
}

// ── This week ───────────────────────────────────────────────────────────────────────────────
interface Briefing {
  weekStart: string; orgUnitName?: string | null; factsAsOf?: string;
  attendance: { lastWeek?: string | null; deltaPoints?: number | null };
  counts: { open: number; openHigh: number; new: number; needsDecision: number };
}
interface QueryResult {
  label: string; unit: string; groupBy: string[]; period: { label: string }; overall: { value: number | null; n: number } | null;
  rows: { label: string; value: number | null; n: number; group?: Record<string, string | null> }[]; suppressed?: number; definition: string; formula: string; notes: string[];
}
interface Tally { flags: number; improved: number; same: number; worse: number; tooEarly: number; notEnoughClasses: number }
interface FlagResults { withAction: Tally; withoutAction: Tally }

/** A guided question run for a chart on the page. Fails quietly: a chart is a help, not the point. */
function useQuery(spec: object | null) {
  const [data, setData] = useState<QueryResult | null>(null);
  const key = spec ? JSON.stringify(spec) : '';
  useEffect(() => {
    if (!key) return;
    let live = true;
    api.post<QueryResult>('/insights/query', JSON.parse(key)).then((r) => { if (live) setData(r); }).catch(() => undefined);
    return () => { live = false; };
  }, [key]);
  return data;
}

function Tile({ icon, label, value, sub, tone = 'blue' }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: 'blue' | 'red' | 'green' | 'amber' }) {
  const tones = { blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300', green: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' };
  return (
    <GlassCard className="!p-4">
      <div className="flex items-start gap-3">
        <span className={clsx('rounded-xl p-2 shrink-0', tones[tone])}>{icon}</span>
        <div className="min-w-0"><p className={clsx('text-xs', muted)}>{label}</p><p className={clsx('text-2xl font-bold tabular-nums leading-tight', strong)}>{value}</p>{sub && <p className={clsx('text-xs mt-0.5', muted)}>{sub}</p>}</div>
      </div>
    </GlassCard>
  );
}

function WeekTab({ can, onOpen, panelChanges, onChanged }: { can: Set<string>; onOpen: (id: string) => void; panelChanges: number; onChanged: () => void }) {
  const { data: b, loading } = useApi<Briefing>('/insights/briefings/latest');
  const named = can.has('VIEW_STUDENT_FLAGS');
  const ask = can.has('USE_TALI');
  const trend = useQuery(ask ? { metric: 'attendance_rate', groupBy: ['week'], period: { preset: 'this_term' } } : null);
  const byDept = useQuery(ask ? { metric: 'open_flags', groupBy: ['org_unit'] } : null);
  const results = useApi<FlagResults>(named ? '/insights/flag-results' : null);

  if (loading) return <Loading />;
  const d = b?.attendance.deltaPoints;
  const where = b?.orgUnitName ?? 'your institution';
  const headline = !b
    ? 'TALI writes its first summary after one full week of attendance.'
    : `${b.counts.open ? `${b.counts.open} student${b.counts.open === 1 ? '' : 's'} in ${where} ${b.counts.open === 1 ? 'needs' : 'need'} a check-in` : `Nobody in ${where} needs a check-in`}${b.counts.openHigh ? `, ${b.counts.openHigh} of them urgently` : ''}. ${b.attendance.lastWeek ? `Attendance last week was ${b.attendance.lastWeek}${String(b.attendance.lastWeek).includes('%') ? '' : '%'}${d == null ? '' : d < 0 ? `, down ${Math.abs(d)} points on the month before` : d > 0 ? `, up ${d} points on the month before` : ', the same as the month before'}.` : ''}`;
  const trendData = (trend?.rows ?? []).map((r) => ({ week: r.label.replace(/^Week of /, '').replace(/ \d{4}$/, ''), value: r.value ?? 0 }));
  // A student is counted in every department they take a unit in, so a department that teaches
  // everyone (common units) would just repeat the total: it is left out when others are shown.
  const deptRows = (byDept?.rows ?? []).filter((r) => (r.value ?? 0) > 0);
  const deptData = deptRows.filter((r) => deptRows.length < 3 || r.value !== b?.counts.open).sort((x, y) => (y.value ?? 0) - (x.value ?? 0)).slice(0, 8)
    .map((r) => ({ name: r.label.replace(/^Department of /, ''), value: r.value ?? 0 }));
  const departments = (byDept?.rows ?? []).filter((r) => r.group?.org_unit).map((r) => ({ id: r.group!.org_unit!, name: r.label })).sort((x, y) => x.name.localeCompare(y.name));
  const acted = results.data?.withAction;
  const left = results.data?.withoutAction;
  const judged = (t?: Tally) => (t ? t.improved + t.same + t.worse : 0);

  return (
    <div className="space-y-6">
      <GlassCard>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">This week{b ? ` · counted up to ${(b.factsAsOf ?? '').slice(0, 10)}` : ''}</p>
        <p className={clsx('text-xl font-semibold mt-1 leading-snug', strong)}>{headline}</p>
      </GlassCard>

      {b && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile icon={d != null && d < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />} label="Attendance last week" value={`${b.attendance.lastWeek ?? '–'}${b.attendance.lastWeek && !String(b.attendance.lastWeek).includes('%') ? '%' : ''}`}
            sub={d == null ? undefined : d === 0 ? 'Same as the month before' : `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} points on the month before`} tone={d != null && d < 0 ? 'amber' : 'green'} />
          <Tile icon={<Users size={18} />} label="Students to check on" value={b.counts.open} sub={`${b.counts.openHigh} urgent`} tone="red" />
          <Tile icon={<Sparkles size={18} />} label="New this week" value={b.counts.new} sub="Added since last Monday" tone="blue" />
          <Tile icon={<Clock size={18} />} label="Waiting over a week" value={b.counts.needsDecision} sub="Listed 7+ days, nobody has reached out" tone={b.counts.needsDecision ? 'amber' : 'green'} />
        </div>
      )}

      {named ? <ToDoList canAct={can.has('ACT_ON_INSIGHTS')} onOpen={onOpen} refreshKey={panelChanges} onChanged={onChanged} />
        : <GlassCard><p className={clsx('text-sm', muted)}>Your role sees the numbers for the institution, not individual students. Deans, Heads of Department and the Registrar follow up with the students themselves.</p></GlassCard>}

      {(trendData.length > 1 || deptData.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {trendData.length > 1 && (
            <GlassCard>
              <h2 className={clsx('font-semibold', strong)}>Attendance this term</h2>
              <p className={clsx('text-xs mb-3', muted)}>Share of classes attended, week by week. The dashed line is the 80% most schools ask for.</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} />
                    <YAxis domain={[50, 100]} tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Attended']} />
                    <ReferenceLine y={80} stroke="#94A3B8" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={3} dot={{ r: 3.5, fill: BLUE }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}
          {deptData.length > 0 && (
            <GlassCard>
              <h2 className={clsx('font-semibold', strong)}>Where they are</h2>
              <p className={clsx('text-xs mb-3', muted)}>Students to check on, by the department that teaches them. Groups under 5 are not shown.</p>
              <div style={{ height: Math.max(140, deptData.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} stroke="#888" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(128,128,128,0.06)' }} contentStyle={tooltipStyle} formatter={(v) => [v, 'Students']} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11, fill: '#888' }}>
                      {deptData.map((_x, i) => <Cell key={i} fill={BLUE} fillOpacity={1 - i * 0.07} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {named && results.data && (
        <GlassCard>
          <h2 className={clsx('font-semibold flex items-center gap-2', strong)}><HeartHandshake size={18} className="text-blue-500" /> Does reaching out help?</h2>
          {judged(acted) + judged(left) === 0 ? (
            <p className={clsx('text-sm mt-1', muted)}>Too early to say. Three weeks after someone reaches out, TALI compares the student's attendance with the three weeks before, and shows the result here.</p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {[{ t: acted!, title: 'Someone reached out' }, { t: left!, title: 'Nobody reached out' }].map(({ t, title }) => {
                const n = judged(t);
                return (
                  <div key={title} className="rounded-xl bg-gray-50 dark:bg-white/5 p-4">
                    <p className={clsx('text-xs', muted)}>{title}</p>
                    <p className={clsx('text-2xl font-bold tabular-nums', strong)}>{n ? `${t.improved} of ${n}` : '–'}</p>
                    <p className={clsx('text-xs', muted)}>{n ? 'students improved over the next 3 weeks' : 'none old enough to compare yet'}</p>
                  </div>
                );
              })}
            </div>
          )}
          <p className={clsx('text-xs mt-3', muted)}>A comparison, not proof: some students recover without anyone stepping in.</p>
        </GlassCard>
      )}

      {named && <EveryoneList onOpen={onOpen} departments={departments} refreshKey={panelChanges} />}
    </div>
  );
}

// ── Ask ─────────────────────────────────────────────────────────────────────────────────────
interface Menu {
  metrics: { key: string; label: string; dimensions: { key: string; label: string }[] }[];
  periods: { key: string; label: string }[];
  suggestions: { title: string; spec: unknown }[];
  cannotAnswer: string[];
}
type PlainAnswer = { understood: true; title: string; result: QueryResult } | { understood: false; reason: string; reply: string };

/** Rows worth showing: with a value, and for a real group (not the "(not recorded)" bucket of leftovers). */
const real = (x: { label: string; value: number | null }) => x.value != null && !/^\(not recorded\)$/i.test(x.label);

/** One sentence that says what the chart shows, so nobody has to read the chart to get the point. */
function takeaway(r: QueryResult): string {
  const unit = r.unit === 'percent' ? '%' : r.unit === 'minutes' ? ' min' : '';
  const rows = r.rows.filter(real);
  if (!rows.length) return r.overall?.value != null ? `Overall: ${r.overall.value}${unit}.` : 'There is nothing to show for that yet.';
  if (r.groupBy[0] === 'week' && rows.length > 1) {
    const first = rows[0]!; const last = rows[rows.length - 1]!;
    const diff = Math.round(((last.value ?? 0) - (first.value ?? 0)) * 10) / 10;
    return `${last.label}: ${last.value}${unit}, ${diff === 0 ? 'the same as' : diff > 0 ? `up ${diff} on` : `down ${Math.abs(diff)} on`} the first week shown.`;
  }
  const sorted = [...rows].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  const low = sorted[0]!; const high = sorted[sorted.length - 1]!;
  return rows.length === 1 ? `${low.label}: ${low.value}${unit}.` : `Lowest: ${low.label} at ${low.value}${unit}. Highest: ${high.label} at ${high.value}${unit}.`;
}

function downloadCsv(title: string, r: QueryResult) {
  const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  const lines = [[r.groupBy.join(' / ') || 'Group', r.label, 'Students'], ...r.rows.map((x) => [x.label, x.value ?? '', x.n])].map((row) => row.map(cell).join(','));
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^\w]+/g, '-').toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(url);
}

function AskTab() {
  const { data: menu, loading, error } = useApi<Menu>('/insights/metrics');
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState<{ title: string; result: QueryResult } | null>(null);
  const [note, setNote] = useState('');
  const [running, setRunning] = useState(false);
  const [metric, setMetric] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [period, setPeriod] = useState('');
  useEffect(() => { if (menu) { setMetric(menu.metrics[0]?.key ?? ''); setPeriod(menu.periods.find((p) => p.key !== 'custom')?.key ?? ''); } }, [menu]);
  if (loading) return <Loading />;
  if (error || !menu) return <Problem error={error ?? 'Ask is not available'} />;

  const runSpec = async (title: string, spec: unknown) => {
    setRunning(true); setNote('');
    try { setAnswer({ title, result: await api.post<QueryResult>('/insights/query', spec) }); } catch (e) { setNote(e instanceof Error ? e.message : 'Could not answer that'); } finally { setRunning(false); }
  };
  const runText = async () => {
    const q = text.trim();
    if (q.length < 3) return;
    setRunning(true); setNote('');
    try {
      const r = await api.post<PlainAnswer>('/insights/ask', { text: q });
      if (r.understood) setAnswer({ title: r.title, result: r.result });
      else { setAnswer(null); setNote(r.reason === 'no_model' ? 'Typing a question is not switched on for your institution yet. Tap one of the questions below instead.' : r.reply); }
    } catch (e) { setNote(e instanceof Error ? e.message : 'Could not answer that'); } finally { setRunning(false); }
  };
  const dims = menu.metrics.find((m) => m.key === metric)?.dimensions ?? [];
  const r = answer?.result;
  const isPct = r?.unit === 'percent';
  const byWeek = r?.groupBy[0] === 'week';
  // Weeks stay in date order; everything else is ranked lowest first, since the lowest is usually the question.
  const chart = (r?.rows ?? []).filter(real).map((x) => ({ name: x.label.replace(/^Week of /, '').replace(/ \d{4}$/, '').replace(/^Department of /, ''), value: x.value ?? 0, n: x.n }))
    .sort((x, y) => (byWeek ? 0 : x.value - y.value));
  // Percentages rarely differ by much: start the bars a little below the lowest so the difference shows.
  const floor = isPct && chart.length ? Math.max(0, Math.floor((Math.min(...chart.map((c) => c.value)) - 10) / 10) * 10) : 0;

  return (
    <div className="space-y-6">
      <GlassCard>
        <h2 className={clsx('text-lg font-semibold', strong)}>Ask a question</h2>
        <p className={clsx('text-sm mb-3', muted)}>About attendance, punctuality, check-ins or feedback, for groups of students. Please don't type a student's name: open their profile instead.</p>
        <form onSubmit={(e) => { e.preventDefault(); void runText(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className={clsx('absolute left-3.5 top-1/2 -translate-y-1/2', muted)} />
            <input aria-label="Your question" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="For example: which departments had the lowest attendance this term?"
              className="w-full rounded-2xl pl-11 pr-4 py-3.5 text-base bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <Button type="submit" disabled={running || text.trim().length < 3}>{running ? 'Working…' : 'Ask'}</Button>
        </form>
        <p className={clsx('text-xs mt-4 mb-2', muted)}>Or tap one:</p>
        <div className="flex flex-wrap gap-2">
          {menu.suggestions.map((s) => (
            <button key={s.title} type="button" disabled={running} onClick={() => void runSpec(s.title, s.spec)} className="px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20">{s.title}</button>
          ))}
        </div>
        {note && <p role="status" className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 text-sm px-3 py-2">{note}</p>}
        <details className="mt-4">
          <summary className={clsx('text-xs cursor-pointer', muted)}>Build a question yourself</summary>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select aria-label="What" value={metric} onChange={(e) => { setMetric(e.target.value); setGroupBy(''); }} className={selectCls}>{menu.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
            <span className={clsx('text-xs', muted)}>by</span>
            <select aria-label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={selectCls}><option value="">overall</option>{dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
            <span className={clsx('text-xs', muted)}>for</span>
            <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls}>{menu.periods.filter((p) => p.key !== 'custom').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
            <Button size="sm" variant="secondary" disabled={running || !metric} onClick={() => void runSpec(menu.metrics.find((m) => m.key === metric)?.label ?? 'Answer', { metric, groupBy: groupBy ? [groupBy] : [], period: { preset: period } })}>Show me</Button>
          </div>
          {!!menu.cannotAnswer.length && <p className={clsx('text-xs mt-3', muted)}>TALI can't answer: {menu.cannotAnswer.join(' · ')}.</p>}
        </details>
      </GlassCard>

      {answer && r && (
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={clsx('font-semibold', strong)}>{answer.title}</h2>
              <p className={clsx('text-xs', muted)}>{r.period.label}{r.overall?.value != null ? ` · overall ${r.overall.value}${isPct ? '%' : ''} across ${r.overall.n} students` : ''}</p>
            </div>
            {!!r.rows.length && <Button size="sm" variant="secondary" onClick={() => downloadCsv(answer.title, r)}><Download size={14} className="mr-1.5 inline" />Download</Button>}
          </div>
          <p className={clsx('text-lg font-semibold mt-3', strong)}>{takeaway(r)}</p>
          {chart.length > 1 && (
            <div className="mt-4" style={{ height: byWeek ? 240 : Math.max(160, Math.min(chart.length, 15) * 32) }}>
              <ResponsiveContainer width="100%" height="100%">
                {byWeek ? (
                  <LineChart data={chart} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} domain={isPct ? [0, 100] : ['auto', 'auto']} tickFormatter={(v) => `${v}${isPct ? '%' : ''}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}${isPct ? '%' : ''}`, r.label]} />
                    <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={3} dot={{ r: 3.5, fill: BLUE }} />
                  </LineChart>
                ) : (
                  <BarChart data={chart.slice(0, 15)} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide domain={isPct ? [floor, 100] : [0, 'auto']} />
                    <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 11 }} stroke="#888" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(128,128,128,0.06)' }} contentStyle={tooltipStyle} formatter={(v) => [`${v}${isPct ? '%' : ''}`, r.label]} />
                    <Bar dataKey="value" fill={BLUE} radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11, fill: '#888', formatter: (v: unknown) => `${String(v)}${isPct ? '%' : ''}` }} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
          {chart.length > 15 && !byWeek && <p className={clsx('text-xs mt-2', muted)}>Showing the lowest 15 of {chart.length}. Download for the full list.</p>}
          {floor > 0 && !byWeek && chart.length > 1 && <p className={clsx('text-xs mt-2', muted)}>Bars start at {floor}% so small differences are easier to see.</p>}
          {!!r.suppressed && <p className={clsx('text-xs mt-2', muted)}>{r.suppressed} small group(s) are hidden to protect students' privacy.</p>}
          <details className="mt-3"><summary className={clsx('text-xs cursor-pointer', muted)}>How this is worked out</summary>
            <p className="text-xs mt-2">{r.definition}</p><p className={clsx('text-xs', muted)}>{r.formula}</p>
            {!!r.notes.length && <ul className={clsx('text-xs list-disc pl-5 mt-1', muted)}>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          </details>
        </GlassCard>
      )}
    </div>
  );
}

// ── What students ask ───────────────────────────────────────────────────────────────────────
interface StudentQuestions {
  period: { days: number }; withheld: boolean; note?: string; students: number | null; asks: number | null; unansweredPercent: number | null; hidden: number; minGroupSize: number;
  rows: { intent: string; label: string; asks: number; students: number; helpful: number; notHelpful: number }[];
}

function StudentsAskTab({ canSetUp }: { canSetUp: boolean }) {
  const { data: q, loading, error } = useApi<StudentQuestions>('/insights/student-questions?days=30');
  if (loading) return <Loading />;
  if (error || !q) return <GlassCard><EmptyState icon={MessageCircleQuestion} title="Not available for your role" description="This summary is for people who look after the whole institution." /></GlassCard>;
  if (q.withheld) return <GlassCard><EmptyState icon={MessageCircleQuestion} title="Not enough students have used TALI yet" description={`Once at least ${q.minGroupSize} students have asked something, you'll see what they ask about here. Never their words or names: only how many asked each kind of question.`} /></GlassCard>;
  const max = Math.max(1, ...q.rows.map((r) => r.asks));
  const missed = q.rows.find((r) => r.intent === 'unknown');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile icon={<Users size={18} />} label="Students who asked TALI" value={q.students ?? 0} sub={`In the last ${q.period.days} days`} />
        <Tile icon={<MessageCircleQuestion size={18} />} label="Questions asked" value={q.asks ?? 0} tone="green" />
        <Tile icon={<AlertTriangle size={18} />} label="TALI could not answer" value={`${q.unansweredPercent ?? 0}%`} sub="Usually something missing from your documents" tone={(q.unansweredPercent ?? 0) > 15 ? 'amber' : 'green'} />
      </div>
      {missed && (
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={clsx('text-sm max-w-2xl', strong)}><strong>{missed.students} students</strong> asked {missed.asks} questions TALI had no answer for. Adding your handbook, fees guide or campus guide is the quickest way to fix that.</p>
            {canSetUp && <Link to="/admin/setup"><Button size="sm"><BookOpen size={14} className="mr-1.5 inline" />Add to your documents</Button></Link>}
          </div>
        </GlassCard>
      )}
      <GlassCard>
        <h2 className={clsx('font-semibold', strong)}>What students ask about</h2>
        <p className={clsx('text-xs mb-4', muted)}>How many times each kind of question was asked. TALI never keeps the words a student typed, and never shows who asked.</p>
        <ul className="space-y-3">
          {q.rows.map((r) => (
            <li key={r.intent}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={clsx('font-medium', strong)}>{r.label}</span>
                <span className={clsx('text-xs tabular-nums', muted)}>{r.asks} times · {r.students} students{r.helpful + r.notHelpful > 0 ? ` · ${r.helpful} found it helpful, ${r.notHelpful} did not` : ''}</span>
              </div>
              <div className="h-2 mt-1 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" aria-hidden="true">
                <div className={clsx('h-full rounded-full', r.intent === 'unknown' ? 'bg-amber-500' : 'bg-blue-500')} style={{ width: `${(r.asks / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {q.hidden > 0 && <p className={clsx('text-xs mt-4', muted)}>{q.hidden} kind(s) of question asked by fewer than {q.minGroupSize} students are not shown.</p>}
      </GlassCard>
    </div>
  );
}

// ── The page ────────────────────────────────────────────────────────────────────────────────
export function TaliPage() {
  const { user } = useAuth();
  const { data: access, loading } = useApi<TaliAccess>('/insights/access');
  const p = useMemo(() => new Set(access?.permissions ?? []), [access]);
  const isSchoolAdmin = user?.role === 'SCHOOL_ADMIN';
  const tabs = useMemo(() => {
    const t: { key: Tab; label: string; icon: typeof Users }[] = [];
    if (access?.enabled) {
      if (p.has('VIEW_WEEKLY_INSIGHTS')) t.push({ key: 'week', label: 'This week', icon: Sparkles });
      if (p.has('USE_TALI')) t.push({ key: 'ask', label: 'Ask', icon: Search });
      if (p.has('VIEW_WEEKLY_INSIGHTS')) t.push({ key: 'students', label: 'What students ask', icon: MessageCircleQuestion });
    }
    return t;
  }, [access, p]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const [changes, setChanges] = useState(0);
  const current = tab && tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={clsx('text-2xl font-bold flex items-center gap-2', strong)}><Sparkles size={22} className="text-blue-500" /> TALI</h1>
          <p className={clsx('text-sm mt-1', muted)}>Who needs a check-in this week, and answers to your questions, worked out from Tcheck's own attendance records.</p>
        </div>
        {tabs.length > 1 && (
          <div role="tablist" aria-label="TALI" className="flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={current === t.key} type="button" onClick={() => setTab(t.key)}
                className={clsx('px-4 py-2 rounded-lg text-sm font-medium cursor-pointer inline-flex items-center gap-1.5', current === t.key ? 'bg-white dark:bg-white/15 text-slate-950 dark:text-white shadow-sm' : muted)}>
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading ? <Loading /> : !tabs.length ? (
        <GlassCard>
          <EmptyState icon={Power} title={isSchoolAdmin && access?.switches ? 'TALI is switched off for staff' : "TALI isn't on for you"}
            description={isSchoolAdmin && access?.switches ? 'Nobody sees this page while it is off. You can switch it back on in Settings.' : 'TALI is switched on per institution by Tcheck, then by your School Admin for staff. Ask your School Admin if you think you should have it.'}
            action={isSchoolAdmin && access?.switches ? <Link to="/admin/settings"><Button size="sm">Open Settings</Button></Link> : undefined} />
        </GlassCard>
      ) : (
        <>
          {current === 'week' && <WeekTab can={p} onOpen={setOpenFlag} panelChanges={changes} onChanged={() => setChanges((c) => c + 1)} />}
          {current === 'ask' && <AskTab />}
          {current === 'students' && <StudentsAskTab canSetUp={p.has('MANAGE_INSIGHT_SETTINGS')} />}
          {p.has('MANAGE_INSIGHT_SETTINGS') && (
            <p className={clsx('text-xs', muted)}>
              Setting up: add the documents students' questions are answered from in <Link to="/admin/setup" className="text-blue-600 dark:text-blue-400 font-medium">Institution Setup</Link>
              {isSchoolAdmin && <>, and switch TALI on or off for staff and students in <Link to="/admin/settings" className="text-blue-600 dark:text-blue-400 font-medium">Settings</Link></>}.
            </p>
          )}
        </>
      )}
      <StudentPanel id={openFlag} onClose={() => setOpenFlag(null)} canAct={p.has('ACT_ON_INSIGHTS')} onChanged={() => setChanges((c) => c + 1)} />
    </div>
  );
}
