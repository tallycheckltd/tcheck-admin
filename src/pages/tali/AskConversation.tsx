import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowRight, Loader2, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';

/**
 * TALI Ask, conversational (2026-10-21). A question in plain words gets a one-sentence answer worked
 * out by Tcheck from the report library (in the person's own scope), with the key numbers, a small
 * chart and "Open as report". Follow-ups change what's on screen ("and only second years?"). TALI
 * asks when it must and says so when Tcheck doesn't record something. 10 questions a day.
 * Server: POST /insights/converse, GET /insights/converse/usage.
 */

type Cell = string | number | null;
interface Result { title: string; subtitle: string; summary: { label: string; value: string }[]; columns: { key: string; label: string; kind?: string }[]; rows: Record<string, Cell>[]; chart?: { type: 'bar' | 'line'; x: string; y: string } }
interface Reply { answer?: string; question?: string; cannot?: boolean; message?: string; closest?: { key: string; title: string }[]; report?: { key: string; title: string; params: Record<string, string | number> }; result?: Result; remaining: number }
type Turn = { role: 'staff'; text: string } | { role: 'tali'; kind: 'answer' | 'question' | 'cannot'; text: string; reply?: Reply };

const muted = 'text-slate-600 dark:text-slate-400';
const strong = 'text-slate-950 dark:text-white';
const EXAMPLES = ['How are women doing against men this semester?', 'Which day of the week has the worst attendance?', 'Is attendance going up or down this term?', 'How many students are below 75%?', 'Who has missed their last 3 classes?'];
const reportLink = (r: NonNullable<Reply['report']>) => `/reports?report=${encodeURIComponent(r.key)}&params=${encodeURIComponent(JSON.stringify(r.params))}`;

/**
 * The chart under an answer: trends as a line; everything else as horizontal bars with the full name
 * on the left and the value at the end of each bar, lowest first (the lowest is usually the point).
 */
function MiniChart({ r }: { r: Result }) {
  if (!r.chart) return null;
  const pct = r.columns.find((c) => c.key === r.chart!.y)?.kind === 'percent';
  const rows = r.rows.filter((x) => typeof x[r.chart!.y] === 'number' && !/^(No |Not recorded)/.test(String(x[r.chart!.x] ?? '')));
  if (rows.length < 2) return null;
  const fmt = (v: unknown) => `${String(v)}${pct ? '%' : ''}`;
  if (r.chart.type === 'line') {
    const data = rows.map((x) => ({ x: String(x[r.chart!.x] ?? '').slice(5), y: x[r.chart!.y] as number }));
    return (
      <div className="h-44 mt-4" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -18, right: 12, top: 6 }}><XAxis dataKey="x" tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} stroke="#888" axisLine={false} tickLine={false} unit={pct ? '%' : ''} domain={pct ? [0, 100] : ['auto', 'auto']} /><Tooltip formatter={fmt} /><Line type="monotone" dataKey="y" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const data = rows.map((x) => ({ name: String(x[r.chart!.x] ?? ''), y: x[r.chart!.y] as number })).sort((a, b) => a.y - b.y).slice(0, 10);
  const longest = Math.max(...data.map((d) => d.name.length));
  return (
    <div className="mt-4" style={{ height: data.length * 30 + 12 }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 44, top: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={pct ? [0, 100] : [0, 'auto']} />
          <YAxis type="category" dataKey="name" width={Math.min(240, Math.max(90, longest * 6.5))} tick={{ fontSize: 11 }} stroke="#888" axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'rgba(128,128,128,0.06)' }} formatter={fmt} />
          <Bar dataKey="y" fill="#2563eb" radius={[0, 5, 5, 0]} barSize={16} label={{ position: 'right', fontSize: 11, fill: '#888', formatter: fmt }} />
        </BarChart>
      </ResponsiveContainer>
      {rows.length > 10 && <p className={clsx('text-[11px]', muted)}>The lowest 10 of {rows.length}. Open as report for all of them.</p>}
    </div>
  );
}

export function AskConversation() {
  const { data: usage } = useApi<{ limit: number; used: number; remaining: number }>('/insights/converse/usage');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (usage && remaining === null) setRemaining(usage.remaining); }, [usage, remaining]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns, busy]);

  const last = [...turns].reverse().find((t): t is Extract<Turn, { role: 'tali' }> => t.role === 'tali');
  const previous = [...turns].reverse().find((t): t is Extract<Turn, { role: 'tali' }> => t.role === 'tali' && t.kind === 'answer')?.reply?.report;
  const answeringQuestion = last?.kind === 'question';
  const limit = usage?.limit ?? 10;
  const left = remaining ?? usage?.remaining ?? limit;
  const out = left <= 0 && !answeringQuestion;

  const ask = async (words = text) => {
    const t = words.trim(); if (t.length < 2 || busy || out) return;
    setBusy(true); setErr(''); setText('');
    const earlier = turns.slice(-8).map((x) => (x.role === 'staff' ? { role: 'staff' as const, text: x.text } : { role: 'tali' as const, text: x.text.slice(0, 500), kind: x.kind }));
    setTurns((prev) => [...prev, { role: 'staff', text: t }]);
    try {
      const r = await api.post<Reply>('/insights/converse', { text: t, earlier, ...(previous ? { previous: { key: previous.key, params: previous.params } } : {}) });
      setRemaining(r.remaining);
      const turn: Turn = r.answer ? { role: 'tali', kind: 'answer', text: r.answer, reply: r }
        : r.question ? { role: 'tali', kind: 'question', text: r.question }
          : { role: 'tali', kind: 'cannot', text: r.message ?? "I can't answer that one.", reply: r };
      setTurns((prev) => [...prev, turn]);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'DAILY_LIMIT') setRemaining(0);
      setErr(e instanceof Error ? e.message : 'TALI could not answer that'); setTurns((prev) => prev.slice(0, -1)); if (code !== 'DAILY_LIMIT') setText(t);
    } finally { setBusy(false); }
  };

  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className={clsx('text-lg font-semibold flex items-center gap-2', strong)}><Sparkles size={18} className="text-blue-600" /> Ask TALI</h2>
          <p className={clsx('text-sm', muted)}>Ask about attendance, punctuality, rooms, feedback or follow-ups, in your own words. Every number comes from Tcheck's records, never made up.</p>
        </div>
        <span className={clsx('text-xs px-2.5 py-1 rounded-full', left <= 2 ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300')}>{left} of {limit} questions left today</span>
      </div>

      {turns.length > 0 && (
        <div className="space-y-3 mb-4" aria-live="polite">
          {turns.map((t, i) => t.role === 'staff' ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] text-sm px-3.5 py-2 rounded-2xl rounded-br-md bg-blue-600 text-white">{t.text}</p>
          ) : (
            <div key={i} className="max-w-[92%] rounded-2xl rounded-bl-md border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3">
              <p className={clsx(t.kind === 'answer' ? 'text-[15px] leading-relaxed' : 'text-sm', strong)}>{t.text}</p>
              {t.kind === 'answer' && t.reply?.result && (
                <>
                  <p className={clsx('text-xs mt-1', muted)}>{t.reply.result.title} · {t.reply.result.subtitle}</p>
                  {t.reply.result.summary.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {t.reply.result.summary.slice(0, 4).map((s) => <div key={s.label} className="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2"><p className={clsx('text-[11px]', muted)}>{s.label}</p><p className={clsx('text-sm font-bold tabular-nums', strong)}>{s.value}</p></div>)}
                    </div>
                  )}
                  <MiniChart r={t.reply.result} />
                  {t.reply.report && <Link to={reportLink(t.reply.report)} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-300 mt-3 hover:underline">Open as report <ArrowRight size={14} /></Link>}
                </>
              )}
              {t.kind === 'cannot' && !!t.reply?.closest?.length && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={clsx('text-xs', muted)}>Closest:</span>
                  {t.reply.closest.map((c) => <Link key={c.key} to={`/reports?report=${c.key}`} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 hover:underline">{c.title}</Link>)}
                </div>
              )}
            </div>
          ))}
          {busy && <p className={clsx('w-fit text-sm px-3.5 py-2 rounded-2xl border border-gray-200 dark:border-white/10 inline-flex items-center gap-2', muted)}><Loader2 size={14} className="animate-spin" /> Working it out…</p>}
          <div ref={end} />
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="flex gap-2">
        <input aria-label="Your question" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} disabled={out}
          placeholder={out ? "You've used today's questions. They reset at midnight." : answeringQuestion ? 'Your answer' : previous ? 'Ask a follow-up, e.g. "and only second years?"' : 'For example: how are women doing against men this semester?'}
          className="flex-1 rounded-2xl px-4 py-3.5 text-base bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60" />
        <Button type="submit" disabled={busy || out || text.trim().length < 2} aria-label="Ask"><Send size={16} /></Button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {turns.length === 0 ? EXAMPLES.map((x) => (
          <button key={x} type="button" disabled={busy || out} onClick={() => void ask(x)} className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 disabled:opacity-50">{x}</button>
        )) : (
          <button type="button" onClick={() => { setTurns([]); setErr(''); }} className={clsx('text-xs inline-flex items-center gap-1 cursor-pointer hover:underline', muted)}><RotateCcw size={12} /> New conversation</button>
        )}
      </div>
      <p className={clsx('text-xs mt-3', muted)}>Answering TALI's own question doesn't use one of your {limit}. Please don't type a student's name: open their profile instead.</p>
    </GlassCard>
  );
}
