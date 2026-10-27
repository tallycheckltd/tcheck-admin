import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { AlertTriangle, ArrowRight, BookOpen, DoorOpen, Download, MessageCircleQuestion, Power, Search, Sparkles, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import type { TaliAccess } from './TaliSetup';
import { AskConversation } from './AskConversation';
import { RoomBookingsTab } from './RoomBookingsTab';

/**
 * TALI for staff (doc B3, B6). Two sections (10-21: "This week" moved into Follow-ups, the one place
 * to work students):
 *   Ask                  a conversation: questions in plain words, answered from the report library
 *   What students ask    what students are asking TALI and where it could not answer
 * Setting up (the school's documents) lives in Institution Setup; on/off lives in Settings.
 *
 * Every call goes to /insights/* on our own backend, which checks the role, the TALI permissions
 * and the switches, limits a Dean / HOD to their own faculty or department, and attaches names.
 */

type Tab = 'ask' | 'students' | 'rooms';
const muted = 'text-slate-600 dark:text-slate-400';
const strong = 'text-slate-950 dark:text-white';
const selectCls = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';
const BLUE = '#3B82F6';
const tooltipStyle = { backgroundColor: 'rgba(15,23,42,0.92)', border: 'none', borderRadius: 12, fontSize: 12, color: '#fff' } as const;

function Loading() { return <p className={clsx('text-sm', muted)}>Loading…</p>; }
function Problem({ error }: { error: string }) {
  return <GlassCard><p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><AlertTriangle size={16} /> {error}</p></GlassCard>;
}

// ── Students to check on ────────────────────────────────────────────────────────────────────
interface QueryResult {
  label: string; unit: string; groupBy: string[]; period: { label: string }; overall: { value: number | null; n: number } | null;
  rows: { label: string; value: number | null; n: number; group?: Record<string, string | null> }[]; suppressed?: number; definition: string; formula: string; notes: string[];
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

// ── Ask ─────────────────────────────────────────────────────────────────────────────────────
interface Menu {
  metrics: { key: string; label: string; dimensions: { key: string; label: string }[] }[];
  periods: { key: string; label: string }[];
  suggestions: { title: string; spec: unknown }[];
  cannotAnswer: string[];
}

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
      {/* 10-21: typed questions go to the conversational Ask (report library, one-sentence answers, 10 a day). */}
      <AskConversation />
      <GlassCard>
        <h2 className={clsx('font-semibold', strong)}>Ready-made charts</h2>
        <p className={clsx('text-xs mb-2', muted)}>Tap one. These don't use your daily questions.</p>
        <div className="flex flex-wrap gap-2">
          {/* TALI's own flag list is gone (students to check on live in Follow-ups): its charts are left out. */}
          {menu.suggestions.filter((s) => !/flag/i.test(s.title)).map((s) => (
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
      if (p.has('USE_TALI')) t.push({ key: 'ask', label: 'Ask', icon: Search });
      if (p.has('VIEW_WEEKLY_INSIGHTS')) t.push({ key: 'students', label: 'What students ask', icon: MessageCircleQuestion });
      // F11 — room bookings students make through TALI, and which rooms they may book.
      if (p.has('MANAGE_INSIGHT_SETTINGS')) t.push({ key: 'rooms', label: 'Room bookings', icon: DoorOpen });
    }
    return t;
  }, [access, p]);
  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab && tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={clsx('text-2xl font-bold flex items-center gap-2', strong)}><Sparkles size={22} className="text-blue-500" /> TALI</h1>
          <p className={clsx('text-sm mt-1', muted)}>Answers to your questions, worked out from Tcheck's own records. Students who need a check-in are in Follow-ups.</p>
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
          {/* 10-21: "This week" is gone; the students to check on, the weekly summary and where they are live in Follow-ups. */}
          <Link to="/follow-ups" className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 bg-blue-50 dark:bg-blue-500/10 text-sm text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-500/15">
            <span><strong>Students who need a check-in</strong> are in Follow-ups now, with this week's summary.</span><ArrowRight size={16} />
          </Link>
          {current === 'ask' && <AskTab />}
          {current === 'students' && <StudentsAskTab canSetUp={p.has('MANAGE_INSIGHT_SETTINGS')} />}
          {current === 'rooms' && <RoomBookingsTab />}
          {p.has('MANAGE_INSIGHT_SETTINGS') && (
            <p className={clsx('text-xs', muted)}>
              Setting up: add the documents students' questions are answered from in <Link to="/admin/setup" className="text-blue-600 dark:text-blue-400 font-medium">Institution Setup</Link>
              {isSchoolAdmin && <>, and switch TALI on or off for staff and students in <Link to="/admin/settings" className="text-blue-600 dark:text-blue-400 font-medium">Settings</Link></>}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
