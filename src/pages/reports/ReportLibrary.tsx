import { useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  ArrowDown, ArrowLeft, ArrowUp, Bookmark, CalendarCheck, CalendarClock, ChevronRight, Download, FileText, GraduationCap, LifeBuoy, Loader2, Mail, Megaphone,
  Play, Presentation, Search, Send, SlidersHorizontal, Sparkles, Trash2, Users, Wrench,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { downloadCsv } from '../../lib/csv';
import { addTcheckHeader, afterTableY } from '../../lib/adminPdfExport';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

/**
 * Report library (2026-10-21). Home: the numbers that matter for this person (each opens the report
 * behind it), "Describe a report" (a conversation with TALI that ends in the report), the reports
 * their role uses most, and every other report. A report opens on its own page with CSV, PDF, email,
 * save/schedule, and drill-down from a unit to its students. Server: /reports/library/*, /reports/ask.
 */

type Cell = string | number | null;
interface Entry { key: string; title: string; category: string; blurb: string; params: string[]; defaultPeriod: 'last30' | 'next7' | 'term' }
interface Catalogue { names: { units: string[]; cohorts: string[]; departments: string[] }; categories: { key: string; label: string }[]; reports: Entry[]; featured: string[]; canAsk: boolean; asks?: { limit: number; remaining: number } }
interface Column { key: string; label: string; kind?: 'text' | 'number' | 'percent' | 'date' }
interface Result { key: string; title: string; subtitle: string; summary: { label: string; value: string }[]; columns: Column[]; rows: Record<string, Cell>[]; notes: string[]; chart?: { type: 'bar' | 'line'; x: string; y: string } }
interface Tile { key: string; label: string; value: string; sub: string; tone: 'good' | 'bad' | 'neutral'; drill: { key: string; params: Params }; spark?: number[] }
interface Saved { id: string; name: string; key: string; params: Params; period: string; schedule: 'NONE' | 'WEEKLY' | 'MONTHLY'; weekday: number | null; hour: number; nextRunAt: string | null; lastSentAt: string | null; lastError: string | null }
type Params = Record<string, string | number>;

const CATEGORY_ICON: Record<string, { icon: ElementType; cls: string }> = {
  attendance: { icon: CalendarCheck, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-300' },
  students: { icon: Users, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' },
  teaching: { icon: Presentation, cls: 'bg-teal-500/10 text-teal-600 dark:text-teal-300' },
  engagement: { icon: Megaphone, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  operations: { icon: Wrench, cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
  followups: { icon: LifeBuoy, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' },
};
const iconOf = (category: string) => CATEGORY_ICON[category] ?? CATEGORY_ICON.attendance!;
const BY_OPTIONS = [['unit', 'Unit'], ['cohort', 'Cohort'], ['department', 'Department'], ['programme', 'Programme'], ['level', 'Level'], ['lecturer', 'Lecturer'], ['room', 'Room'], ['weekday', 'Day of the week'], ['hour', 'Start time'], ['week', 'Week'], ['gender', 'Gender']] as const;
const NUMBER_PARAMS: Record<string, { label: string; placeholder: string }> = {
  threshold: { label: 'Cut-off (%)', placeholder: "School's requirement" },
  belowPercent: { label: 'Turnout under (%)', placeholder: '50' },
  minPercent: { label: 'At least (%)', placeholder: '95' },
  sessions: { label: 'Sessions in a row', placeholder: '3' },
  minLate: { label: 'Late at least (times)', placeholder: '3' },
};
const PERIOD_WORDS: Record<string, string> = { default: 'Default period', last7: 'Last 7 days', last30: 'Last 30 days', last84: 'Last 12 weeks', thisMonth: 'This month', lastMonth: 'Last month', fixed: 'Fixed dates' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const AS_OF_NOW = ['beacon_health', 'app_setup', 'followup_weekly_summary', 'followup_cases', 'followup_track_record'];
const NO_FILTERS = ['beacon_health', 'support_tickets', 'facility_issues', 'followup_weekly_summary', 'followup_cases', 'followup_track_record'];

const card = 'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] shadow-[var(--app-shadow)] dark:bg-white/[0.04] dark:border-white/10';
const input = 'w-full rounded-xl border px-3 py-2 text-sm bg-[var(--app-elevated-solid)] border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/35 dark:bg-white/5 dark:border-white/10';
const muted = 'text-[var(--app-text-muted)]';
const strong = 'text-[var(--app-text)]';

const show = (v: Cell, kind?: Column['kind']) => (v === null || v === undefined || v === '' ? '—' : kind === 'percent' ? `${v}%` : typeof v === 'number' ? v.toLocaleString() : String(v));
/** A cell that starts like a formula opens as text in a spreadsheet. */
const safe = (v: Cell) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const fileBase = (r: Result) => r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
const needsInput = (e: Entry) => e.params.some((p) => p === 'by' || p === 'student');
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

type View = { kind: 'home' } | { kind: 'report'; entry: Entry; params: Params; asked?: string; result?: Result } | { kind: 'saved' };

/** A link straight to a report: /reports?report=<key>&params=<json>. Used by TALI Ask's "Open as report". */
function fromUrl(reports: Entry[]): { entry: Entry; params: Params } | null {
  const q = new URLSearchParams(window.location.search);
  const e = reports.find((r) => r.key === q.get('report'));
  if (!e) return null;
  let params: Params = {};
  try { params = JSON.parse(q.get('params') ?? '{}') as Params; } catch { /* ignore */ }
  return { entry: e, params };
}

export function ReportLibrary({ classic, classicLabel, classicOpen }: { classic?: ReactNode; classicLabel?: string; classicOpen?: boolean }) {
  const { data: cat, error } = useApi<Catalogue>('/reports/library');
  const [view, setView] = useState<View>({ kind: 'home' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const run = async (entry: Entry, params: Params, asked?: string) => {
    setView({ kind: 'report', entry, params, asked }); setBusy(true); setMsg(''); top();
    try {
      const r = await api.post<{ result?: Result; question?: string }>('/reports/library/run', { key: entry.key, params });
      if (r.question) setMsg(r.question); else setView({ kind: 'report', entry, params, asked, result: r.result });
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Could not run the report'); } finally { setBusy(false); }
  };
  const open = (entry: Entry, params: Params = {}) => {
    if (needsInput(entry) && !params.by && !params.student) { setView({ kind: 'report', entry, params }); setMsg(''); top(); return; }
    void run(entry, params);
  };
  const byKey = (k: string) => cat?.reports.find((r) => r.key === k);

  useEffect(() => {
    if (!cat) return;
    const v = fromUrl(cat.reports);
    if (v) { open(v.entry, v.params); window.history.replaceState(null, '', window.location.pathname); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  if (error) return <>{classic}</>; // not a Reports role: the older page only
  if (!cat) return <div className={clsx('flex items-center gap-2 text-sm py-16 justify-center', muted)}><Loader2 size={16} className="animate-spin" /> Loading reports…</div>;

  if (view.kind === 'saved') return <SavedPanel reports={cat.reports} onBack={() => setView({ kind: 'home' })} onOpen={(s) => { const e = byKey(s.key); if (e) void run(e, { ...s.params, ...(s.period !== 'default' && s.period !== 'fixed' ? { period: s.period } : {}) }); }} />;

  if (view.kind === 'report') {
    const { entry, params, result, asked } = view;
    const ic = iconOf(entry.category); const Icon = ic.icon;
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => { setView({ kind: 'home' }); setMsg(''); top(); }} className={clsx('inline-flex items-center gap-1.5 text-sm cursor-pointer hover:text-[var(--app-text)]', muted)}><ArrowLeft size={15} /> All reports</button>
        <div className="flex items-start gap-3">
          <span className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', ic.cls)}><Icon size={20} /></span>
          <div className="min-w-0">
            <h2 className={clsx('text-xl font-semibold', strong)}>{result?.title ?? entry.title}</h2>
            <p className={clsx('text-sm', muted)}>{asked ? <>You asked: “{asked}”</> : entry.blurb}</p>
          </div>
        </div>
        <ReportForm key={`${entry.key}:${JSON.stringify(params)}`} entry={entry} names={cat.names} params={params} busy={busy}
          startOpen={!result && !busy && needsInput(entry)} onRun={(p) => void run(entry, p)} />
        {msg && <p role="status" className="text-sm rounded-xl px-3 py-2 bg-amber-500/10 text-amber-800 dark:text-amber-200">{msg}</p>}
        {busy && <ResultSkeleton />}
        {result && !busy && (
          <ReportView result={result} entryKey={entry.key} params={params}
            drill={byKey('student_roster') && entry.key !== 'student_roster' ? (unit) => void run(byKey('student_roster')!, { unit, ...(params.period ? { period: params.period } : {}), ...(params.from ? { from: params.from, to: params.to ?? '' } : {}) }) : undefined} />
        )}
      </div>
    );
  }

  const featured = cat.featured.map(byKey).filter(Boolean) as Entry[];
  return (
    <div className="space-y-8">
      <div className="space-y-3">
      {/* Its own row above the numbers, so nothing overlaps at any width. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className={clsx('font-semibold', strong)}>At a glance</h2>
        <Button size="sm" variant="secondary" onClick={() => { setView({ kind: 'saved' }); top(); }}><Bookmark size={14} className="mr-1.5" />Saved &amp; scheduled</Button>
      </div>
      <KeyNumbers reports={cat.reports} onOpen={(k, p) => { const e = byKey(k); if (e) void run(e, p); }} />
      </div>
      {cat.canAsk && <AskBox reports={cat.reports} asks={cat.asks} onReport={(e, p, r, words) => { setView({ kind: 'report', entry: e, params: p, result: r, asked: words }); setMsg(''); top(); }} onOpen={(e) => open(e)} />}
      {featured.length > 0 && (
        <section className="space-y-3">
          <h2 className={clsx('font-semibold', strong)}>Most used</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featured.map((r) => {
              const ic = iconOf(r.category); const Icon = ic.icon;
              return (
                <button key={r.key} type="button" onClick={() => open(r)} className={clsx(card, 'p-4 text-left flex gap-3 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-400/50')}>
                  <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', ic.cls)}><Icon size={17} /></span>
                  <span className="min-w-0"><span className={clsx('block text-sm font-semibold', strong)}>{r.title}</span><span className={clsx('block text-xs mt-0.5 line-clamp-2', muted)}>{r.blurb}</span></span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <AllReports cat={cat} onOpen={open} />
      {classic && (
        <details className={clsx(card, 'group')} open={classicOpen}>
          <summary className={clsx('px-4 py-3 cursor-pointer text-sm font-medium flex items-center gap-2 list-none', strong)}>
            <ChevronRight size={16} className="transition-transform group-open:rotate-90" /> {classicLabel ?? 'More'}
          </summary>
          <div className="px-4 pb-4 pt-1">{classic}</div>
        </details>
      )}
    </div>
  );
}

// ── key numbers ─────────────────────────────────────────────────────────────────────────────

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const lo = Math.min(...points) - 2; const hi = Math.max(...points) + 2; const w = 64; const h = 26;
  const xy = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - lo) / Math.max(1, hi - lo)) * h}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible"><polyline points={xy} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function KeyNumbers({ reports, onOpen }: { reports: Entry[]; onOpen: (key: string, params: Params) => void }) {
  const { data, loading } = useApi<{ tiles: Tile[] }>('/reports/library/home');
  if (loading && !data) return <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={clsx(card, 'h-28 animate-pulse')} />)}</div>;
  const tiles = (data?.tiles ?? []).filter((t) => reports.some((r) => r.key === t.drill.key));
  if (!tiles.length) return null;
  return (
    <section aria-label="Key numbers" className={clsx('grid grid-cols-2 gap-3', tiles.length >= 5 ? 'lg:grid-cols-5' : tiles.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
      {tiles.map((t, i) => (
        <motion.button key={t.key} type="button" onClick={() => onOpen(t.drill.key, t.drill.params)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
          className={clsx(card, 'p-4 text-left cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg group', i === 0 && tiles.length >= 5 && 'col-span-2 lg:col-span-1')}>
          <p className={clsx('text-xs font-medium', muted)}>{t.label}</p>
          <div className="flex items-end justify-between gap-2 mt-1">
            <p className={clsx('text-3xl font-bold tabular-nums tracking-tight', strong)}>{t.value}</p>
            {t.spark && <span className="text-blue-500 mb-1"><Spark points={t.spark} /></span>}
          </div>
          <p className={clsx('text-xs mt-1', t.tone === 'bad' ? 'text-red-600 dark:text-red-400' : t.tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : muted)}>{t.sub}</p>
          <p className="text-[11px] mt-2 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">See who and why →</p>
        </motion.button>
      ))}
    </section>
  );
}

// ── all reports ─────────────────────────────────────────────────────────────────────────────

function AllReports({ cat, onOpen }: { cat: Catalogue; onOpen: (e: Entry) => void }) {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const shown = useMemo(() => cat.reports.filter((r) => (category === 'all' || r.category === category) && (!search.trim() || `${r.title} ${r.blurb}`.toLowerCase().includes(search.trim().toLowerCase()))), [cat, category, search]);
  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className={clsx('font-semibold', strong)}>All reports <span className={clsx('text-sm font-normal', muted)}>({cat.reports.length})</span></h2>
        <div className="relative sm:ml-auto sm:w-64">
          <Search size={15} className={clsx('absolute left-3 top-1/2 -translate-y-1/2', muted)} />
          <input aria-label="Search reports" placeholder="Search" className={clsx(input, 'pl-9 py-1.5')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Report categories">
        {[{ key: 'all', label: 'All' }, ...cat.categories].map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={category === c.key} onClick={() => setCategory(c.key)}
            className={clsx('px-3 py-1 rounded-lg text-sm whitespace-nowrap cursor-pointer transition-colors', category === c.key ? 'bg-blue-600 text-white' : clsx(muted, 'hover:text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/5'))}>
            {c.label}
          </button>
        ))}
      </div>
      <ul className={clsx(card, 'divide-y divide-[var(--app-border-soft)] dark:divide-white/5 overflow-hidden')}>
        {shown.map((r) => {
          const ic = iconOf(r.category); const Icon = ic.icon;
          return (
            <li key={r.key}>
              <button type="button" onClick={() => onOpen(r)} className="w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] group">
                <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', ic.cls)}><Icon size={15} /></span>
                <span className="min-w-0 flex-1"><span className={clsx('block text-sm font-medium', strong)}>{r.title}</span><span className={clsx('block text-xs truncate', muted)}>{r.blurb}</span></span>
                <ChevronRight size={16} className={clsx('shrink-0 opacity-40 group-hover:opacity-100', muted)} />
              </button>
            </li>
          );
        })}
        {!shown.length && <li className={clsx('px-4 py-6 text-sm text-center', muted)}>No reports match that search.</li>}
      </ul>
    </section>
  );
}

// ── the filter bar ──────────────────────────────────────────────────────────────────────────

function ReportForm({ entry, names, params: initial, busy, onRun, startOpen }: { entry: Entry; names: Catalogue['names']; params: Params; busy: boolean; onRun: (p: Params) => void; startOpen: boolean }) {
  const [params, setParams] = useState<Params>(initial);
  const [openForm, setOpenForm] = useState(startOpen);
  const set = (k: string, v: string | number | undefined) => { const n = { ...params }; if (v === undefined || v === '') delete n[k]; else n[k] = v; setParams(n); };
  const periodKey = params.from !== undefined ? 'fixed' : String(params.period ?? 'default');
  const pickPeriod = (k: string) => { const n = { ...params }; delete n.from; delete n.to; delete n.period; if (k !== 'default' && k !== 'fixed') n.period = k; if (k === 'fixed') n.from = ''; setParams(n); };
  const defaultWords = entry.defaultPeriod === 'next7' ? 'Next 7 days' : entry.defaultPeriod === 'term' ? 'Last 12 weeks' : 'Last 30 days';
  const noPeriod = AS_OF_NOW.includes(entry.key);
  const noFilters = NO_FILTERS.includes(entry.key);
  const chips = [
    !noPeriod && (params.from ? `${params.from} → ${params.to || 'today'}` : params.period ? PERIOD_WORDS[String(params.period)] : defaultWords),
    params.by && `by ${BY_OPTIONS.find(([v]) => v === params.by)?.[1] ?? params.by}`,
    params.unit, params.cohort, params.department, params.student,
    ...Object.keys(NUMBER_PARAMS).filter((k) => params[k] !== undefined).map((k) => `${NUMBER_PARAMS[k]!.label.replace(/ \(.*\)/, '')}: ${params[k]}`),
  ].filter(Boolean) as string[];
  if (!openForm) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {chips.map((c) => <span key={c} className={clsx('px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10', strong)}>{c}</span>)}
        {(!noPeriod || !noFilters || entry.params.length > 0) && <button type="button" onClick={() => setOpenForm(true)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-300 hover:bg-blue-500/10 cursor-pointer"><SlidersHorizontal size={14} /> Change</button>}
      </div>
    );
  }
  return (
    <form className={clsx(card, 'p-4 space-y-3')} onSubmit={(e) => { e.preventDefault(); setOpenForm(false); onRun(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''))); }}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {!noPeriod && (
          <label className="text-xs space-y-1"><span className={muted}>Period</span>
            <select className={input} value={periodKey} onChange={(e) => pickPeriod(e.target.value)}>
              <option value="default">{defaultWords}</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option><option value="last84">Last 12 weeks</option>
              <option value="thisMonth">This month</option><option value="lastMonth">Last month</option><option value="fixed">Choose dates…</option>
            </select>
          </label>
        )}
        {periodKey === 'fixed' && !noPeriod && (
          <>
            <label className="text-xs space-y-1"><span className={muted}>From</span><input type="date" className={input} required value={String(params.from ?? '')} onChange={(e) => setParams({ ...params, from: e.target.value })} /></label>
            <label className="text-xs space-y-1"><span className={muted}>To</span><input type="date" className={input} value={String(params.to ?? '')} onChange={(e) => set('to', e.target.value)} /></label>
          </>
        )}
        {entry.params.includes('by') && (
          <label className="text-xs space-y-1"><span className={muted}>Split by</span>
            <select className={input} value={String(params.by ?? '')} onChange={(e) => set('by', e.target.value)} required>
              <option value="">Choose…</option>{BY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        {entry.params.filter((p) => NUMBER_PARAMS[p]).map((p) => (
          <label key={p} className="text-xs space-y-1"><span className={muted}>{NUMBER_PARAMS[p]!.label}</span>
            <input type="number" min={1} max={100} className={input} placeholder={NUMBER_PARAMS[p]!.placeholder} value={String(params[p] ?? '')} onChange={(e) => set(p, e.target.value ? Number(e.target.value) : undefined)} />
          </label>
        ))}
        {entry.params.includes('student') && (
          <label className="text-xs space-y-1"><span className={muted}>Student number or name</span><input className={input} required={entry.key === 'student_record'} value={String(params.student ?? '')} onChange={(e) => set('student', e.target.value)} /></label>
        )}
        {!noFilters && (
          <>
            <label className="text-xs space-y-1"><span className={muted}>Unit</span><input list="rl-units" className={input} placeholder="All" value={String(params.unit ?? '')} onChange={(e) => set('unit', e.target.value)} /></label>
            <label className="text-xs space-y-1"><span className={muted}>Cohort</span><input list="rl-cohorts" className={input} placeholder="All" value={String(params.cohort ?? '')} onChange={(e) => set('cohort', e.target.value)} /></label>
            {names.departments.length > 0 && <label className="text-xs space-y-1"><span className={muted}>Department</span><input list="rl-depts" className={input} placeholder="All" value={String(params.department ?? '')} onChange={(e) => set('department', e.target.value)} /></label>}
            <datalist id="rl-units">{names.units.map((u) => <option key={u} value={u} />)}</datalist>
            <datalist id="rl-cohorts">{names.cohorts.map((u) => <option key={u} value={u} />)}</datalist>
            <datalist id="rl-depts">{names.departments.map((u) => <option key={u} value={u} />)}</datalist>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}><Play size={14} className="mr-1.5" />Run report</Button>
        {!startOpen && <Button type="button" size="sm" variant="ghost" onClick={() => { setParams(initial); setOpenForm(false); }}>Cancel</Button>}
      </div>
    </form>
  );
}

// ── "Describe a report" ─────────────────────────────────────────────────────────────────────

/** A conversation: TALI's questions and the answers stay here until the report is ready, then it opens. */
function AskBox({ reports, asks, onReport, onOpen }: { reports: Entry[]; asks?: Catalogue['asks']; onReport: (e: Entry, p: Params, r: Result, words: string) => void; onOpen: (e: Entry) => void }) {
  const [remaining, setRemaining] = useState<number | null>(asks?.remaining ?? null);
  const limit = asks?.limit ?? 10;
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<{ role: 'staff' | 'tali'; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [cannot, setCannot] = useState<{ message: string; closest: { key: string; title: string }[] } | null>(null);
  const [err, setErr] = useState('');
  const examples = ['Which students are below 75% this month?', 'Worst day of the week for attendance this term', 'Students who missed their last 3 classes', 'How busy were our rooms last month?'];

  const ask = async (words = text) => {
    const t = words.trim(); if (t.length < 2 || busy) return;
    const first = turns.find((x) => x.role === 'staff')?.text ?? t;
    setBusy(true); setErr(''); setCannot(null); setText('');
    setTurns((prev) => [...prev, { role: 'staff', text: t }]);
    try {
      const r = await api.post<{ question?: string; cannot?: boolean; message?: string; closest?: { key: string; title: string }[]; report?: { key: string; params: Params }; result?: Result; remaining?: number }>('/reports/ask', { text: t, earlier: turns.slice(-6) });
      if (typeof r.remaining === 'number') setRemaining(r.remaining);
      const e = r.report ? reports.find((x) => x.key === r.report!.key) : undefined;
      if (r.result && e) { onReport(e, r.report!.params ?? {}, r.result, first); setTurns([]); }
      else if (r.question) setTurns((prev) => [...prev, { role: 'tali', text: r.question! }]);
      else if (r.cannot) { setCannot({ message: r.message ?? "I can't build that one.", closest: r.closest ?? [] }); setTurns([]); }
    } catch (e) { if ((e as { code?: string }).code === 'DAILY_LIMIT') setRemaining(0); setErr(e instanceof Error ? e.message : 'TALI could not read that'); setTurns((prev) => prev.slice(0, -1)); setText(t); } finally { setBusy(false); }
  };
  const inConversation = turns.length > 0;
  const out = remaining === 0 && !inConversation;

  return (
    <section className="rounded-2xl p-5 sm:p-6 border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.08] to-transparent space-y-4">
      {remaining !== null && <span className={clsx('float-right text-xs px-2.5 py-1 rounded-full', remaining <= 2 ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'bg-blue-500/10 text-blue-700 dark:text-blue-300')}>{remaining} of {limit} questions left today</span>}
      <div>
        <h2 className={clsx('text-lg font-semibold flex items-center gap-2', strong)}><Sparkles size={18} className="text-blue-600" /> Describe the report you need</h2>
        <p className={clsx('text-sm', muted)}>In your own words. TALI asks if it needs anything, then builds it.</p>
      </div>
      {inConversation && (
        <div className="space-y-2" aria-live="polite">
          {turns.map((t, i) => (
            <p key={i} className={clsx('text-sm px-3.5 py-2 rounded-2xl w-fit max-w-[85%]', t.role === 'staff' ? 'ml-auto bg-blue-600 text-white rounded-br-md' : 'bg-[var(--app-elevated-solid)] border border-[var(--app-border-soft)] text-[var(--app-text)] rounded-bl-md dark:bg-white/10 dark:border-white/10')}>{t.text}</p>
          ))}
          {busy && <p className={clsx('text-sm px-3.5 py-2 rounded-2xl w-fit bg-[var(--app-elevated-solid)] border border-[var(--app-border-soft)] dark:bg-white/10 dark:border-white/10 inline-flex items-center gap-2', muted)}><Loader2 size={14} className="animate-spin" /> Working on it…</p>}
        </div>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <input aria-label="Describe a report" autoFocus={inConversation} disabled={out} className={clsx(input, 'flex-1 py-3 text-base')} placeholder={out ? "You've used today's questions. They reset at midnight; the reports below still work." : inConversation ? 'Type your answer' : 'e.g. Which units had the worst attendance last month?'} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={busy || text.trim().length < 2} aria-label="Send">{busy && !inConversation ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</Button>
      </form>
      {inConversation && <button type="button" onClick={() => { setTurns([]); setText(''); }} className={clsx('text-xs cursor-pointer hover:underline', muted)}>Start over</button>}
      {!inConversation && !cannot && (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((x) => <button key={x} type="button" disabled={busy} onClick={() => void ask(x)} className={clsx('text-xs px-2.5 py-1 rounded-full border border-[var(--app-border-soft)] dark:border-white/10 hover:border-blue-400 hover:text-[var(--app-text)] cursor-pointer', muted)}>{x}</button>)}
        </div>
      )}
      {busy && !inConversation && <p className={clsx('text-sm inline-flex items-center gap-2', muted)}><Loader2 size={14} className="animate-spin" /> Working on it…</p>}
      {cannot && (
        <div className="text-sm space-y-2">
          <p className={strong}>{cannot.message}{cannot.closest.length ? ' These come closest:' : ' Try one from the list below.'}</p>
          <div className="flex flex-wrap gap-1.5">{cannot.closest.map((c) => { const e = reports.find((x) => x.key === c.key); return e ? <Button key={c.key} size="sm" variant="secondary" onClick={() => { setCannot(null); onOpen(e); }}>{c.title}</Button> : null; })}</div>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{err}</p>}
    </section>
  );
}

// ── saved & scheduled ───────────────────────────────────────────────────────────────────────

function scheduleWords(s: Pick<Saved, 'schedule' | 'weekday' | 'hour'>) {
  const at = `${String(s.hour).padStart(2, '0')}:00`;
  return s.schedule === 'WEEKLY' ? `Every ${DAYS[(s.weekday ?? 1) - 1]} at ${at}` : s.schedule === 'MONTHLY' ? `The 1st of every month at ${at}` : 'Not scheduled';
}

function SaveDialog({ entryKey, title, params, onClose }: { entryKey: string; title: string; params: Params; onClose: (saved: boolean) => void }) {
  const [name, setName] = useState(title);
  const [period, setPeriod] = useState(params.from ? 'fixed' : String(params.period ?? 'default'));
  const [schedule, setSchedule] = useState<'NONE' | 'WEEKLY' | 'MONTHLY'>('NONE');
  const [weekday, setWeekday] = useState(1);
  const [hour, setHour] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const save = async () => {
    setBusy(true); setErr('');
    const rest = Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'period'));
    try { await api.post('/reports/library/saved', { name: name.trim(), key: entryKey, params: rest, period, schedule, weekday: schedule === 'WEEKLY' ? weekday : null, hour }); setDone(true); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={() => onClose(done)} title="Save this report">
      {done ? (
        <div className="space-y-3 text-sm">
          <p className={strong}>Saved. {schedule === 'NONE' ? 'Find it under "Saved & scheduled".' : `${scheduleWords({ schedule, weekday, hour })} it will arrive in your email.`}</p>
          <div className="flex justify-end"><Button onClick={() => onClose(true)}>Done</Button></div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block space-y-1"><span className={clsx('text-xs', muted)}>Name</span><input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block space-y-1"><span className={clsx('text-xs', muted)}>Period each time it runs</span>
            <select className={input} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {Object.entries(PERIOD_WORDS).filter(([k]) => k !== 'fixed' || params.from).map(([k, l]) => <option key={k} value={k}>{k === 'default' ? "The report's default" : l}</option>)}
            </select>
          </label>
          <label className="block space-y-1"><span className={clsx('text-xs', muted)}>Email it to me</span>
            <select className={input} value={schedule} onChange={(e) => setSchedule(e.target.value as typeof schedule)}>
              <option value="NONE">No, just save it</option><option value="WEEKLY">Every week</option><option value="MONTHLY">Every month (on the 1st)</option>
            </select>
          </label>
          {schedule !== 'NONE' && (
            <div className="grid grid-cols-2 gap-3">
              {schedule === 'WEEKLY' && <label className="block space-y-1"><span className={clsx('text-xs', muted)}>Day</span><select className={input} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>}
              <label className="block space-y-1"><span className={clsx('text-xs', muted)}>Time</span><select className={input} value={hour} onChange={(e) => setHour(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>)}</select></label>
            </div>
          )}
          {schedule !== 'NONE' && <p className={clsx('text-xs', muted)}>It goes to your own email with the full table attached, always covers the latest period, and only shows what you can see at the time.</p>}
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button disabled={busy || name.trim().length < 2} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button></div>
        </div>
      )}
    </Modal>
  );
}

function SavedPanel({ reports, onBack, onOpen }: { reports: Entry[]; onBack: () => void; onOpen: (s: Saved) => void }) {
  const { data, loading, refetch } = useApi<{ saved: Saved[] }>('/reports/library/saved');
  const [editing, setEditing] = useState<Saved | null>(null);
  const remove = async (s: Saved) => { await api.delete(`/reports/library/saved/${s.id}`); await refetch(); };
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className={clsx('inline-flex items-center gap-1.5 text-sm cursor-pointer hover:text-[var(--app-text)]', muted)}><ArrowLeft size={15} /> All reports</button>
      <div><h2 className={clsx('text-xl font-semibold', strong)}>Saved &amp; scheduled</h2><p className={clsx('text-sm', muted)}>Reports you saved. Scheduled ones arrive in your email with the full table attached.</p></div>
      {loading && !data ? <ResultSkeleton /> : !data?.saved.length ? (
        <div className={clsx(card, 'p-10 text-center')}><Bookmark size={28} className={clsx('mx-auto mb-2 opacity-40', muted)} /><p className={clsx('text-sm', strong)}>Nothing saved yet</p><p className={clsx('text-xs mt-1', muted)}>Open any report and press Save to keep it here or have it emailed to you every week.</p></div>
      ) : (
        <ul className={clsx(card, 'divide-y divide-[var(--app-border-soft)] dark:divide-white/5')}>
          {data.saved.map((s) => {
            const e = reports.find((r) => r.key === s.key); const ic = iconOf(e?.category ?? 'attendance'); const Icon = ic.icon;
            return (
              <li key={s.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', ic.cls)}><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm font-medium', strong)}>{s.name}</p>
                  <p className={clsx('text-xs', muted)}>{e?.title ?? s.key} · {PERIOD_WORDS[s.period] ?? s.period}</p>
                  <p className={clsx('text-xs mt-0.5 inline-flex items-center gap-1', s.schedule === 'NONE' ? muted : 'text-blue-600 dark:text-blue-300')}><CalendarClock size={12} />{scheduleWords(s)}{s.nextRunAt ? ` · next ${when(s.nextRunAt)}` : ''}</p>
                  {s.lastError && <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{s.lastError}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => onOpen(s)} disabled={!e}><Play size={13} className="mr-1" />Open</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(s)}><CalendarClock size={13} className="mr-1" />Schedule</Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => void remove(s)}><Trash2 size={14} /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <ScheduleDialog saved={editing} onClose={async (changed) => { setEditing(null); if (changed) await refetch(); }} />}
    </div>
  );
}

function ScheduleDialog({ saved, onClose }: { saved: Saved; onClose: (changed: boolean) => void }) {
  const [schedule, setSchedule] = useState(saved.schedule);
  const [weekday, setWeekday] = useState(saved.weekday ?? 1);
  const [hour, setHour] = useState(saved.hour);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api.patch(`/reports/library/saved/${saved.id}`, { schedule, weekday: schedule === 'WEEKLY' ? weekday : null, hour }); onClose(true); } finally { setBusy(false); } };
  return (
    <Modal open onClose={() => onClose(false)} title={`Schedule “${saved.name}”`}>
      <div className="space-y-3 text-sm">
        <select className={input} value={schedule} onChange={(e) => setSchedule(e.target.value as Saved['schedule'])} aria-label="How often">
          <option value="NONE">Don't email it</option><option value="WEEKLY">Every week</option><option value="MONTHLY">Every month (on the 1st)</option>
        </select>
        {schedule !== 'NONE' && (
          <div className="grid grid-cols-2 gap-3">
            {schedule === 'WEEKLY' && <select className={input} aria-label="Day" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>}
            <select className={input} aria-label="Time" value={hour} onChange={(e) => setHour(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>)}</select>
          </div>
        )}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>Save</Button></div>
      </div>
    </Modal>
  );
}

// ── the result ──────────────────────────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className={clsx(card, 'p-5 space-y-4')} aria-label="Loading">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />)}</div>
      <div className="h-48 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
      {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse" />)}
    </div>
  );
}

/** One page per unit for the exam office: the list, the counts, and lines to sign. */
async function examPack(r: Result) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const units = [...new Set(r.rows.map((x) => String(x.unit ?? '')))];
  const requirement = r.summary.find((s) => /Requirement/.test(s.label))?.value ?? '';
  for (const [i, unit] of units.entries()) {
    if (i) doc.addPage();
    const y = await addTcheckHeader(doc, `Exam eligibility — ${unit}`, `${r.subtitle} · requirement ${requirement} · generated ${new Date().toLocaleDateString()}`);
    const rows = r.rows.filter((x) => String(x.unit ?? '') === unit);
    const no = rows.filter((x) => x.eligible === 'No').length;
    doc.setFontSize(10); doc.text(`${rows.length} students · ${rows.length - no} eligible · ${no} not eligible`, 40, y);
    autoTable(doc, {
      startY: y + 10, head: [['Student', 'Student no.', 'Sessions expected', 'Attended', 'Attendance', 'Eligible']],
      body: rows.map((x) => [show(x.student ?? null), show(x.number ?? null), show(x.expected ?? null), show(x.attended ?? null), show(x.percent ?? null, 'percent'), show(x.eligible ?? null)]),
      styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [37, 99, 235], textColor: 255 }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 40, right: 40 },
      didParseCell: (d) => { if (d.section === 'body' && d.column.index === 5 && d.cell.raw === 'No') d.cell.styles.textColor = [185, 28, 28]; },
    });
    let sy = afterTableY(doc, y + 40) + 36;
    if (sy > 740) { doc.addPage(); sy = 80; }
    doc.setFontSize(10);
    for (const who of ['Lecturer', 'Head of Department', 'Examinations Office']) { doc.text(`${who}: ______________________   Signature: ______________   Date: ____________`, 40, sy); sy += 26; }
    doc.setFontSize(8); doc.setTextColor(100); doc.text('Attendance = sessions attended (checked in and out) ÷ sessions the student was expected at. Source: Tcheck.', 40, 810); doc.setTextColor(0);
  }
  doc.save(`exam-eligibility-${new Date().toISOString().slice(0, 10)}.pdf`);
}

const PAGE = 50;
function ReportView({ result: r, entryKey, params, drill }: { result: Result; entryKey: string; params: Params; drill?: (unit: string) => void }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => {
    if (!sort) return r.rows;
    return [...r.rows].sort((a, b) => {
      const x = a[sort.key]; const y = b[sort.key];
      if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [r.rows, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const chartData = r.chart ? r.rows.filter((x) => typeof x[r.chart!.y] === 'number').slice(0, 30).map((x) => ({ x: String(x[r.chart!.x] ?? ''), y: x[r.chart!.y] as number })) : [];
  const yCol = r.columns.find((c) => c.key === r.chart?.y);
  // Long names (units, lecturers) read better as horizontal bars, lowest first, with the value on each bar.
  const horizontal = r.chart?.type === 'bar' && chartData.some((d) => d.x.length > 10);
  // A unit's row opens that unit's students.
  const unitKey = r.columns.some((c) => c.key === 'unit') ? 'unit' : params.by === 'unit' ? 'group' : null;
  const canDrill = !!drill && !!unitKey && !['exam_eligibility', 'check_in_log', 'session_register', 'low_turnout_sessions', 'materials_engagement'].includes(entryKey);

  const csv = () => downloadCsv(`${fileBase(r)}.csv`, r.columns.map((c) => c.label), r.rows.map((x) => r.columns.map((c) => safe(x[c.key] ?? null))));
  const pdf = async () => {
    const doc = new jsPDF({ orientation: r.columns.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    let y = await addTcheckHeader(doc, r.title, r.subtitle);
    if (r.summary.length) { doc.setFontSize(10); doc.text(r.summary.map((s) => `${s.label}: ${s.value}`).join('   ·   '), 40, y); y += 16; }
    autoTable(doc, { startY: y, head: [r.columns.map((c) => c.label)], body: r.rows.map((x) => r.columns.map((c) => show(x[c.key] ?? null, c.kind))), styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [37, 99, 235], textColor: 255 }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 40, right: 40 } });
    doc.save(`${fileBase(r)}.pdf`);
  };
  const email = async () => {
    setEmailing(true); setEmailMsg('');
    try {
      const x = await api.post<{ sent?: boolean; to?: string; question?: string }>('/reports/library/email', { key: entryKey, params });
      setEmailMsg(x.sent ? `Sent to ${x.to}. It should arrive in a minute or two.` : x.question ?? 'Not sent');
    } catch (e) { setEmailMsg(e instanceof Error ? e.message : 'Could not send'); } finally { setEmailing(false); }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={clsx(card, 'p-5 space-y-5')} aria-label={r.title}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className={clsx('text-sm', muted)}>{r.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          {entryKey === 'exam_eligibility' && r.rows.length > 0 && <Button size="sm" onClick={() => void examPack(r)}><GraduationCap size={14} className="mr-1.5" />Exam office pack</Button>}
          {r.columns.length > 0 && <Button size="sm" variant="secondary" onClick={csv}><Download size={14} className="mr-1.5" />CSV</Button>}
          {r.columns.length > 0 && <Button size="sm" variant="secondary" onClick={() => void pdf()}><FileText size={14} className="mr-1.5" />PDF</Button>}
          <Button size="sm" variant="secondary" disabled={emailing} onClick={() => void email()}>{emailing ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Mail size={14} className="mr-1.5" />}Email me</Button>
          <Button size="sm" variant="secondary" onClick={() => setSaving(true)}><Bookmark size={14} className="mr-1.5" />Save</Button>
        </div>
      </div>
      {emailMsg && <p role="status" className={clsx('text-sm rounded-xl px-3 py-2 bg-blue-500/10', strong)}>{emailMsg}</p>}

      {r.summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {r.summary.map((s) => <div key={s.label} className="rounded-xl bg-black/[0.03] dark:bg-white/5 px-4 py-3"><p className={clsx('text-xs', muted)}>{s.label}</p><p className={clsx('text-xl font-bold tabular-nums', strong)}>{s.value}</p></div>)}
        </div>
      )}

      {chartData.length > 1 && (
        <div style={{ height: horizontal ? Math.min(chartData.length, 30) * 28 + 16 : 256 }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            {r.chart!.type === 'line' ? (
              <LineChart data={chartData} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} /><XAxis dataKey="x" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} unit={yCol?.kind === 'percent' ? '%' : ''} />
                <Tooltip formatter={(v) => show(v as number, yCol?.kind)} /><Line type="monotone" dataKey="y" name={yCol?.label} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            ) : horizontal ? (
              <BarChart data={[...chartData].sort((a, b) => a.y - b.y)} layout="vertical" margin={{ left: 0, right: 48, top: 0, bottom: 0 }}>
                <XAxis type="number" hide domain={yCol?.kind === 'percent' ? [0, 100] : [0, 'auto']} />
                <YAxis type="category" dataKey="x" width={Math.min(260, Math.max(100, Math.max(...chartData.map((d) => d.x.length)) * 6.5))} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => show(v as number, yCol?.kind)} /><Bar dataKey="y" name={yCol?.label} fill="#2563eb" radius={[0, 6, 6, 0]} barSize={16} label={{ position: 'right', fontSize: 11, fill: '#888', formatter: (v: unknown) => show(v as number, yCol?.kind) }} />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} /><XAxis dataKey="x" tick={{ fontSize: 11 }} interval={0} angle={chartData.length > 8 ? -30 : 0} textAnchor={chartData.length > 8 ? 'end' : 'middle'} height={chartData.length > 8 ? 70 : 30} /><YAxis tick={{ fontSize: 11 }} unit={yCol?.kind === 'percent' ? '%' : ''} />
                <Tooltip formatter={(v) => show(v as number, yCol?.kind)} /><Bar dataKey="y" name={yCol?.label} fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {r.columns.length > 0 && (rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--app-border-soft)] dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/[0.03] dark:bg-white/5">
              <tr>{r.columns.map((c) => (
                <th key={c.key} className={clsx('px-3 py-2.5 font-medium text-xs whitespace-nowrap', muted, c.kind === 'number' || c.kind === 'percent' ? 'text-right' : 'text-left')}>
                  <button type="button" className="inline-flex items-center gap-1 cursor-pointer hover:text-[var(--app-text)]" onClick={() => { setPage(0); setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.kind === 'number' || c.kind === 'percent' ? -1 : 1 }); }}>
                    {c.label}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}{canDrill && <th className="w-24" />}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border-soft)] dark:divide-white/5">
              {rows.slice(page * PAGE, page * PAGE + PAGE).map((x, i) => (
                <tr key={i} className={clsx('hover:bg-black/[0.02] dark:hover:bg-white/[0.03] group', canDrill && 'cursor-pointer')} onClick={canDrill ? () => drill!(String(x[unitKey!] ?? '')) : undefined}>
                  {r.columns.map((c) => <td key={c.key} className={clsx('px-3 py-2', strong, c.kind === 'number' || c.kind === 'percent' ? 'text-right tabular-nums whitespace-nowrap' : '', c.kind === 'percent' && typeof x[c.key] === 'number' && (x[c.key] as number) < 60 && 'text-red-600 dark:text-red-400 font-medium')}>{show(x[c.key] ?? null, c.kind)}</td>)}
                  {canDrill && <td className="px-3 py-2 text-right text-xs text-blue-600 dark:text-blue-300 whitespace-nowrap opacity-0 group-hover:opacity-100">Students →</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className={clsx('text-sm text-center py-10', muted)}>Nothing to show for this period and these filters.</p>)}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className={muted}>{rows.length.toLocaleString()} rows · page {page + 1} of {pages}</span>
          <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>
        </div>
      )}
      {r.notes.length > 0 && <ul className={clsx('text-xs space-y-0.5', muted)}>{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      {saving && <SaveDialog entryKey={entryKey} title={r.title} params={params} onClose={() => setSaving(false)} />}
    </motion.section>
  );
}
