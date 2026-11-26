import { useState } from 'react';
import { clsx } from 'clsx';
import { Lock, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

/**
 * Retention impact (2026-11-26) — on Follow-ups. The term against the baseline the school agreed:
 * retention (the registrar's numbers), attendance (Tcheck's), and what the follow-ups did. Below it,
 * the figures themselves: a School Admin or the Academic Registrar records the baseline (rollout
 * weeks 1–2) and each term's retention, then locks them once the school agrees; locked figures never
 * change. Counts only; under 5 shows as "fewer than 5". Server: /follow-ups/retention*.
 */

interface Line { id?: string; majorId: string | null; label: string; enrolled: number | null; retained: number | null; attendanceRate: number | null; retentionPercent?: number | null }
interface Figure {
  id: string; kind: 'BASELINE' | 'TERM'; label: string; periodFrom: string; periodTo: string; source: string;
  agreedByName: string | null; agreedByTitle: string | null; notes: string | null; recordedBy: string | null; lockedAt: string | null; lockedBy: string | null; locked: boolean; lines: Line[];
}
interface Figures { canEdit: boolean; figures: Figure[]; programmes: { id: string; name: string; code: string }[] }
interface Guarded { value: number | null; small: boolean }
interface Impact {
  period: { from: string; to: string; termName: string | null };
  baseline: Figure | null; termFigure: Figure | null;
  attendance: { rate: number | null; sessions: number };
  rows: { majorId: string | null; label: string; baselineRetention: number | null; termRetention: number | null; retentionChange: number | null; baselineAttendance: number | null; termAttendance: number | null }[];
  followUps: { flagged: Guarded; nudged: Guarded; contacted: Guarded; recovered: Guarded; withdrew: Guarded; transferred: Guarded; stillOpen: Guarded; recoveredPercent: number | null; reasons: ({ code: string; label: string } & Guarded)[] };
  notes: string[];
}

const muted = 'text-slate-600 dark:text-slate-400';
const inputCls = 'w-full rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';
const labelCls = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1';
const pctOf = (v: number | null) => (v === null ? '—' : `${v}%`);
const countOf = (g: Guarded) => (g.small ? 'fewer than 5' : String(g.value ?? 0));
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function Change({ a, b }: { a: number | null; b: number | null }) {
  if (a === null || b === null) return null;
  const d = Math.round((b - a) * 10) / 10;
  return <span className={clsx('ml-1.5 text-xs font-medium', d > 0 ? 'text-green-600 dark:text-green-400' : d < 0 ? 'text-red-600 dark:text-red-400' : muted)}>{d > 0 ? '+' : ''}{d} pts</span>;
}

export function RetentionImpactCard() {
  const { data: impact, refetch: refetchImpact } = useApi<Impact>('/follow-ups/retention/impact');
  const { data: figs, refetch: refetchFigs } = useApi<Figures>('/follow-ups/retention');
  const [editing, setEditing] = useState<Figure | 'BASELINE' | 'TERM' | null>(null);
  const [showFigures, setShowFigures] = useState(false);
  const [confirmLock, setConfirmLock] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  if (!impact || !figs) return null;
  const refresh = () => { void refetchImpact(); void refetchFigs(); };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg('');
    try { await fn(); setMsg(ok); refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); }
  };
  const f = impact.followUps;
  const box = (title: string, main: string, sub?: string) => (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3"><p className={clsx('text-xs font-medium', muted)}>{title}</p><p className="text-lg font-semibold text-slate-950 dark:text-white mt-0.5">{main}</p>{sub && <p className={clsx('text-xs mt-0.5', muted)}>{sub}</p>}</div>
  );

  return (
    <>
    <GlassCard>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400"><Target size={18} /></div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Retention impact</h2>
            <p className={clsx('text-xs', muted)}>
              {impact.period.termName ? `${impact.period.termName}, ` : ''}{day(impact.period.from)} – {day(impact.period.to)}, against {impact.baseline ? <>the baseline agreed by {[impact.baseline.agreedByName, impact.baseline.agreedByTitle].filter(Boolean).join(', ')} ({impact.baseline.label})</> : 'a baseline not yet agreed'}. Counts only; safe to share.
            </p>
          </div>
        </div>
        {figs.canEdit && !impact.baseline && <Button size="sm" onClick={() => setEditing('BASELINE')}><Plus size={14} className="mr-1.5" />Record the baseline</Button>}
      </div>

      {impact.rows.length > 0 && (impact.baseline || impact.termFigure) && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead><tr className={clsx('text-left text-xs uppercase tracking-wide', muted)}><th className="py-2 pr-3 font-medium">Institution / programme</th><th className="pr-3 font-medium">Retention: baseline → this term</th><th className="font-medium">Attendance: baseline → this term</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-slate-950 dark:text-white">
              {impact.rows.map((r) => (
                <tr key={r.majorId ?? 'all'}>
                  <td className="py-2 pr-3 font-medium">{r.label}</td>
                  <td className="pr-3 tabular-nums">{pctOf(r.baselineRetention)} → {r.termRetention === null ? <span className={muted}>not recorded yet</span> : pctOf(r.termRetention)}<Change a={r.baselineRetention} b={r.termRetention} /></td>
                  <td className="tabular-nums">{pctOf(r.baselineAttendance)} → {pctOf(r.termAttendance)}<Change a={r.baselineAttendance} b={r.termAttendance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {box('Students flagged', countOf(f.flagged), `${countOf(f.nudged)} nudged first`)}
        {box('Contacted by an adviser', countOf(f.contacted), `${countOf(f.stillOpen)} still open`)}
        {box('Recovered', countOf(f.recovered), f.recoveredPercent === null ? 'shown by attendance' : `${f.recoveredPercent}% of those flagged, shown by attendance`)}
        {box('Withdrew', countOf(f.withdrew), `${countOf(f.transferred)} transferred`)}
      </div>
      {f.reasons.length > 0 && <p className={clsx('text-xs mt-3', muted)}>Why students who did not come back were struggling, from advisers' case notes: {f.reasons.map((x) => `${x.label} (${countOf(x)})`).join(', ')}.</p>}
      <ul className={clsx('text-[11px] mt-3 space-y-0.5 list-disc pl-4', muted)}>{impact.notes.map((n) => <li key={n}>{n}</li>)}</ul>

      <div className="mt-4 border-t border-gray-100 dark:border-white/5 pt-3">
        <button type="button" onClick={() => setShowFigures(!showFigures)} aria-expanded={showFigures} className="text-xs font-medium text-blue-600 dark:text-blue-300 cursor-pointer hover:underline">
          {showFigures ? 'Hide figures' : `Baseline and term figures (${figs.figures.length})`}
        </button>
        {showFigures && (
          <div className="mt-3 space-y-2">
            {figs.canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing('BASELINE')}><Plus size={14} className="mr-1.5" />Baseline</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing('TERM')}><Plus size={14} className="mr-1.5" />Term retention (registrar)</Button>
              </div>
            )}
            {!figs.figures.length && <p className={clsx('text-sm', muted)}>Nothing recorded yet.</p>}
            {figs.figures.map((x) => (
              <div key={x.id} className="rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300">{x.kind === 'BASELINE' ? 'Baseline' : 'Term'}</span>
                  <span className="font-medium text-slate-950 dark:text-white">{x.label}</span>
                  <span className={clsx('text-xs', muted)}>{day(x.periodFrom)} – {day(x.periodTo)}</span>
                  {x.locked ? <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><Lock size={12} />Locked</span> : <span className="text-xs text-amber-700 dark:text-amber-400">Draft</span>}
                  {figs.canEdit && !x.locked && (
                    <span className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(x)}><Pencil size={14} className="mr-1" />Edit</Button>
                      {confirmLock === x.id
                        ? <Button size="sm" onClick={() => { setConfirmLock(null); void act(() => api.post(`/follow-ups/retention/${x.id}/lock`, {}), 'Locked.'); }}>Lock for good</Button>
                        : <Button size="sm" variant="ghost" onClick={() => setConfirmLock(x.id)}><Lock size={14} className="mr-1" />Lock</Button>}
                      <Button size="sm" variant="ghost" aria-label="Delete draft" onClick={() => void act(() => api.delete(`/follow-ups/retention/${x.id}`), 'Draft deleted.')}><Trash2 size={14} /></Button>
                    </span>
                  )}
                </div>
                {confirmLock === x.id && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Locking records that {x.agreedByName ?? 'someone at the school'} agreed these numbers. They can't be changed afterwards; a correction is a new figure.</p>}
                <p className={clsx('text-xs mt-1', muted)}>
                  {x.lines.map((l) => `${l.label}: ${l.enrolled ?? '—'} enrolled${l.retained !== null ? `, ${l.retained} retained (${pctOf(l.retentionPercent ?? null)})` : ''}${l.attendanceRate !== null ? `, attendance ${l.attendanceRate}%` : ''}`).join(' · ')}
                </p>
                <p className={clsx('text-xs mt-0.5', muted)}>Source: {x.source}.{x.agreedByName ? ` Agreed by ${[x.agreedByName, x.agreedByTitle].filter(Boolean).join(', ')}.` : ''}{x.recordedBy ? ` Recorded by ${x.recordedBy}.` : ''}{x.lockedAt ? ` Locked ${new Date(x.lockedAt).toLocaleDateString()}${x.lockedBy ? ` by ${x.lockedBy}` : ''}.` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {msg && <p role="status" className={clsx('text-xs mt-2', muted)}>{msg}</p>}
    </GlassCard>
    {/* Outside the card: its blur would otherwise hold the fixed-position dialog inside it. */}
    {editing && <FigureForm start={editing} programmes={figs.programmes} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setShowFigures(true); setMsg('Saved as a draft. Lock it once the school agrees the numbers.'); refresh(); }} />}
    </>
  );
}

const num = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s))));
const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
type Row = { majorId: string | null; label: string; enrolled: string; retained: string; attendanceRate: string };

function FigureForm({ start, programmes, onClose, onSaved }: { start: Figure | 'BASELINE' | 'TERM'; programmes: Figures['programmes']; onClose: () => void; onSaved: () => void }) {
  const existing = typeof start === 'object' ? start : null;
  const kind = existing?.kind ?? (start as 'BASELINE' | 'TERM');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [from, setFrom] = useState(existing?.periodFrom ?? '');
  const [to, setTo] = useState(existing?.periodTo ?? '');
  const [source, setSource] = useState(existing?.source ?? '');
  const [agreedByName, setAgreedByName] = useState(existing?.agreedByName ?? '');
  const [agreedByTitle, setAgreedByTitle] = useState(existing?.agreedByTitle ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const toRow = (l: Line): Row => ({ majorId: l.majorId, label: l.label, enrolled: str(l.enrolled), retained: str(l.retained), attendanceRate: str(l.attendanceRate) });
  const [rows, setRows] = useState<Row[]>(existing?.lines.length ? existing.lines.map(toRow) : [{ majorId: null, label: 'Whole institution', enrolled: '', retained: '', attendanceRate: '' }]);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const unused = programmes.filter((p) => !rows.some((r) => r.majorId === p.id));

  const save = async () => {
    setBusy(true); setErr('');
    const body = {
      kind, label: label.trim(), periodFrom: from, periodTo: to, source: source.trim(),
      agreedByName: agreedByName.trim() || null, agreedByTitle: agreedByTitle.trim() || null, notes: notes.trim() || null,
      lines: rows.map((r) => ({ majorId: r.majorId, ...(r.majorId ? {} : { label: r.label }), enrolled: num(r.enrolled), retained: num(r.retained), attendanceRate: kind === 'BASELINE' ? num(r.attendanceRate) : null })),
    };
    try {
      if (existing) await api.put(`/follow-ups/retention/${existing.id}`, body); else await api.post('/follow-ups/retention', body);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={kind === 'BASELINE' ? 'Retention baseline' : "Term retention (registrar's figures)"}>
      <div className="space-y-3 text-sm">
        <p className={muted}>{kind === 'BASELINE'
          ? 'The starting point every term is compared with, usually last year from the registrar\'s records. Leave out anything you don\'t have.'
          : "The registrar's confirmed numbers for a term since Tcheck went live: how many were enrolled at the start and how many are still registered."}</p>
        <div><label className={labelCls} htmlFor="rf-label">Name</label><input id="rf-label" className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'BASELINE' ? '2025/26 academic year' : 'Jan–Apr 2027 trimester'} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} htmlFor="rf-from">From</label><input id="rf-from" type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className={labelCls} htmlFor="rf-to">To</label><input id="rf-to" type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div><label className={labelCls} htmlFor="rf-source">Where the numbers come from</label><input id="rf-source" className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Registrar's office, enrolment returns" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} htmlFor="rf-who">Agreed by</label><input id="rf-who" className={inputCls} value={agreedByName} onChange={(e) => setAgreedByName(e.target.value)} placeholder="Name" /></div>
          <div><label className={labelCls} htmlFor="rf-title">Their title</label><input id="rf-title" className={inputCls} value={agreedByTitle} onChange={(e) => setAgreedByTitle(e.target.value)} placeholder="DVC Academic" /></div>
        </div>

        <div className="space-y-2">
          <div className={clsx('grid gap-2 text-xs font-medium', kind === 'BASELINE' ? 'grid-cols-[1fr_4.5rem_4.5rem_4.5rem_1.5rem]' : 'grid-cols-[1fr_5rem_5rem_1.5rem]', muted)}>
            <span /><span>Enrolled</span><span>Retained</span>{kind === 'BASELINE' && <span>Attend. %</span>}<span />
          </div>
          {rows.map((r, i) => (
            <div key={r.majorId ?? 'all'} className={clsx('grid gap-2 items-center', kind === 'BASELINE' ? 'grid-cols-[1fr_4.5rem_4.5rem_4.5rem_1.5rem]' : 'grid-cols-[1fr_5rem_5rem_1.5rem]')}>
              <span className="truncate text-slate-950 dark:text-white">{r.label}</span>
              <input aria-label={`${r.label} enrolled`} inputMode="numeric" className={inputCls} value={r.enrolled} onChange={(e) => set(i, 'enrolled', e.target.value)} />
              <input aria-label={`${r.label} retained`} inputMode="numeric" className={inputCls} value={r.retained} onChange={(e) => set(i, 'retained', e.target.value)} />
              {kind === 'BASELINE' && <input aria-label={`${r.label} attendance %`} inputMode="numeric" className={inputCls} value={r.attendanceRate} onChange={(e) => set(i, 'attendanceRate', e.target.value)} />}
              {r.majorId ? <button type="button" aria-label={`Remove ${r.label}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className={clsx('cursor-pointer', muted)}><Trash2 size={14} /></button> : <span />}
            </div>
          ))}
          {unused.length > 0 && (
            <div className="flex gap-2">
              <select aria-label="Add a programme" className={inputCls} value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">Add a programme…</option>
                {unused.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Button size="sm" variant="secondary" disabled={!adding} onClick={() => { const p = programmes.find((x) => x.id === adding)!; setRows([...rows, { majorId: p.id, label: p.name, enrolled: '', retained: '', attendanceRate: '' }]); setAdding(''); }}>Add</Button>
            </div>
          )}
          <p className={clsx('text-[11px]', muted)}>Retained = still registered at the end of the period. Programmes with fewer than 5 students are left out of the report.</p>
        </div>
        <div><label className={labelCls} htmlFor="rf-notes">Notes (optional)</label><textarea id="rf-notes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {err && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !label.trim() || !from || !to || !source.trim()} onClick={() => void save()}>Save draft</Button>
        </div>
      </div>
    </Modal>
  );
}
