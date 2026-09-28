import { useState } from 'react';
import { UploadCloud, CalendarDays, FileDown, CheckCircle2, AlertTriangle, XCircle, Play, Trash2, ListChecks } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { downloadCsv } from '../../lib/csv';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SetupChecklistCard } from '../../components/academics/SetupChecklistCard';
import type { School } from '../../types';

type Step = 'orgUnits' | 'campuses' | 'programmes' | 'rooms' | 'staff' | 'cohorts' | 'students' | 'timetable';
interface Template { step: Step; file: string; title: string; creates: string; columns: { name: string; required?: boolean; rule: string; example: string }[] }
interface Counts { create: number; update: number; unchanged: number; error: number; warnings: number; total: number }
interface RunRow { phase: 'DRY_RUN' | 'APPLY'; step: Step; rowNo: number; action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR'; key: string | null; message: string | null; warnings: string[] }
interface Run { id: string; status: 'DRAFT' | 'APPLIED' | 'DISCARDED'; steps: Step[]; planSummary?: Record<Step, Counts>; applySummary?: Record<Step, Counts> | null; rows: RunRow[]; invites?: { email: string; devLink?: string }[] }
interface TermDraft { name: string; startDate: string; endDate: string }

const PATTERNS = [
  { key: 'SEMESTERS_2', label: '2 semesters' }, { key: 'TRIMESTERS_3', label: '3 trimesters' },
  { key: 'QUARTERS_4', label: '4 quarters' }, { key: 'CUSTOM', label: 'Custom' },
] as const;
const inputCls = 'rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white';
const day = (iso: string) => iso.slice(0, 10);

/**
 * P6 (A5.1) — one ordered Institution Setup: 1 Calendar (form) → 2–9 the eight template files
 * (uploaded together, dry-run first: created / updated / unchanged / warnings / errors per row,
 * nothing written until Apply) → 10 the checklist. Re-running the same files changes nothing.
 */
export function InstitutionSetupPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const { data: own } = useApi<School>(!isSuperAdmin && user?.schoolId ? `/schools/${user.schoolId}` : null);
  const [pickedId, setPickedId] = useState('');
  const school = isSuperAdmin ? schools?.find((s) => s.id === pickedId) ?? null : own ?? null;
  const q = school && isSuperAdmin ? `?schoolId=${school.id}` : '';
  const { data: templates } = useApi<Template[]>('/setup/templates');
  const [checklistKey, setChecklistKey] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white flex items-center gap-2"><UploadCloud size={24} className="text-blue-500" /> Institution Setup</h1>
        <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">Set the institution up once: the calendar, then the eight template files. Every upload is checked first — nothing changes until you press Apply, and re-uploading the same files changes nothing.</p>
        {isSuperAdmin && (
          <select aria-label="Institution" value={pickedId} onChange={(e) => setPickedId(e.target.value)} className={`mt-3 min-w-[220px] ${inputCls}`}>
            <option value="">Select an institution…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      {school && (
        <>
          <SetupChecklistCard schoolId={school.id} refreshKey={checklistKey} />
          {school.attendanceMode !== 'STAGE_BASED' && <CalendarStep schoolId={school.id} isSuperAdmin={isSuperAdmin} onDone={() => setChecklistKey((k) => k + 1)} />}
          <LmsImportCard schoolId={school.id} />
          <FilesStep schoolId={school.id} q={q} isSuperAdmin={isSuperAdmin} templates={templates ?? []} onDone={() => setChecklistKey((k) => k + 1)} />
        </>
      )}
    </div>
  );
}

function CalendarStep({ schoolId, isSuperAdmin, onDone }: { schoolId: string; isSuperAdmin: boolean; onDone: () => void }) {
  const [pattern, setPattern] = useState<(typeof PATTERNS)[number]['key']>('SEMESTERS_2');
  const [yearStart, setYearStart] = useState(`${new Date().getFullYear()}-09-01`);
  const [terms, setTerms] = useState<TermDraft[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { mutate: post, loading } = useMutation('post');
  const body = () => ({ pattern, yearStart, ...(terms ? { terms } : {}), ...(isSuperAdmin ? { schoolId } : {}) });

  const preview = async () => {
    setMsg(null);
    try {
      const r = await api.post<{ terms: TermDraft[] }>('/terms/calendar/preview', { pattern, yearStart, ...(isSuperAdmin ? { schoolId } : {}) });
      setTerms(r.terms.map((t) => ({ name: t.name, startDate: day(t.startDate), endDate: day(t.endDate) })));
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not build the calendar' }); }
  };
  // A5.2 yearly touch: next year's calendar pre-filled from this year's pattern (one click if unchanged).
  const nextYear = async () => {
    setMsg(null);
    try {
      const r = await api.get<{ proposal: { pattern: typeof pattern; yearStart: string; terms: TermDraft[] } }>(`/terms/calendar/next-year${isSuperAdmin ? `?schoolId=${schoolId}` : ''}`);
      setPattern(r.proposal.pattern); setYearStart(r.proposal.yearStart);
      setTerms(r.proposal.terms.map((t) => ({ name: t.name, startDate: day(t.startDate), endDate: day(t.endDate) })));
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'No pattern to copy yet' }); }
  };
  const apply = async () => {
    setMsg(null);
    try {
      const r = await post('/terms/calendar', body()) as { created: number; updated: number; unchanged: number };
      setMsg({ ok: true, text: `Calendar saved — ${r.created} created, ${r.updated} updated, ${r.unchanged} unchanged. The active term now follows the dates automatically.` });
      onDone();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the calendar' }); }
  };

  return (
    <GlassCard className="p-5 space-y-3">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><CalendarDays size={18} /> 1 · Calendar</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="cal-pattern" className="block text-xs font-medium text-slate-600 mb-1">Pattern</label>
          <select id="cal-pattern" value={pattern} onChange={(e) => { setPattern(e.target.value as typeof pattern); setTerms(null); }} className={inputCls}>
            {PATTERNS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cal-start" className="block text-xs font-medium text-slate-600 mb-1">Academic year starts</label>
          <input id="cal-start" type="date" value={yearStart} onChange={(e) => { setYearStart(e.target.value); setTerms(null); }} className={inputCls} />
        </div>
        {pattern !== 'CUSTOM' && <Button variant="secondary" size="sm" onClick={() => void preview()}>Fill in the terms</Button>}
        {pattern === 'CUSTOM' && !terms && <Button variant="secondary" size="sm" onClick={() => setTerms([{ name: 'Term 1', startDate: yearStart, endDate: yearStart }])}>Add terms</Button>}
        <Button variant="ghost" size="sm" onClick={() => void nextYear()}>Next year from this year's pattern</Button>
      </div>
      {terms && (
        <div className="space-y-2">
          {terms.map((t, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <input aria-label={`Term ${i + 1} name`} value={t.name} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={`w-64 ${inputCls}`} />
              <input aria-label={`Term ${i + 1} start`} type="date" value={t.startDate} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, startDate: e.target.value } : x)))} className={inputCls} />
              <span className="text-slate-400">→</span>
              <input aria-label={`Term ${i + 1} end`} type="date" value={t.endDate} onChange={(e) => setTerms(terms.map((x, j) => (j === i ? { ...x, endDate: e.target.value } : x)))} className={inputCls} />
              {pattern === 'CUSTOM' && <button type="button" aria-label={`Remove term ${i + 1}`} onClick={() => setTerms(terms.filter((_, j) => j !== i))} className="text-red-500 p-1 cursor-pointer"><Trash2 size={14} /></button>}
            </div>
          ))}
          {pattern === 'CUSTOM' && <Button variant="ghost" size="sm" onClick={() => setTerms([...terms, { name: `Term ${terms.length + 1}`, startDate: yearStart, endDate: yearStart }])}>+ Add a term</Button>}
          <Button onClick={() => void apply()} disabled={loading}>{loading ? 'Saving…' : 'Save calendar'}</Button>
        </div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}
    </GlassCard>
  );
}

/** P7 (A6.3, A5.1): "Import from LMS" — the same Review sync staging, reached from setup. */
function LmsImportCard({ schoolId }: { schoolId: string }) {
  const { data: conns } = useApi<{ id: string; provider: string; pendingReview?: number }[]>(`/integrations/connections?schoolId=${schoolId}`);
  const lms = (conns ?? []).filter((c) => ['MOODLE', 'CANVAS', 'ONEROSTER'].includes(c.provider));
  if (!lms.length) return null;
  const label: Record<string, string> = { MOODLE: 'Moodle', CANVAS: 'Canvas', ONEROSTER: 'OneRoster' };
  return (
    <GlassCard className="p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Import from your LMS instead</h2>
      <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">Terms, the organisation tree, programmes, cohorts, courses and people can come from {lms.map((c) => label[c.provider]).join(' / ')} — pulled into Review sync first, nothing changes until you approve. Rooms and the timetable stay on the files below.</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {lms.map((c) => (
          <a key={c.id} href="/admin/integrations" className="text-sm text-blue-600 dark:text-blue-400 underline">
            Open {label[c.provider]} Review sync{c.pendingReview ? ` (${c.pendingReview} to review)` : ''}
          </a>
        ))}
      </div>
    </GlassCard>
  );
}

function FilesStep({ schoolId, q, isSuperAdmin, templates, onDone }: { schoolId: string; q: string; isSuperAdmin: boolean; templates: Template[]; onDone: () => void }) {
  const [files, setFiles] = useState<Partial<Record<Step, { name: string; content: string }>>>({});
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: history, refetch: refetchHistory } = useApi<{ id: string; status: string; steps: Step[]; createdAt: string }[]>(`/setup/runs${q}`);
  const draft = history?.find((r) => r.status === 'DRAFT');

  const pick = async (step: Step, f: File | undefined) => {
    if (!f) { setFiles(({ [step]: _gone, ...rest }) => rest); return; }
    const content = await f.text();
    setFiles((cur) => ({ ...cur, [step]: { name: f.name, content } }));
  };
  const call = async (fn: () => Promise<Run>) => {
    setBusy(true); setError('');
    try { setRun(await fn()); refetchHistory(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  const dryRun = () => call(() => api.post<Run>('/setup/runs', { files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v!.content])), ...(isSuperAdmin ? { schoolId } : {}) }));
  const apply = () => call(async () => { const r = await api.post<Run>(`/setup/runs/${run!.id}/apply${q}`, isSuperAdmin ? { schoolId } : {}); onDone(); return r; });
  const discard = () => call(async () => { await api.post(`/setup/runs/${run!.id}/discard${q}`, isSuperAdmin ? { schoolId } : {}); return { ...run!, status: 'DISCARDED' as const }; });
  const resume = (id: string) => call(() => api.get<Run>(`/setup/runs/${id}${q}`));
  const report = async () => {
    const text = await api.getText(`/setup/runs/${run!.id}/report.csv${q}`);
    const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'setup-report.csv'; link.click();
    URL.revokeObjectURL(url);
  };
  const template = (t: Template) => downloadCsv(t.file, t.columns.map((c) => c.name), [t.columns.map((c) => c.example)]);

  const summary = run ? (run.status === 'APPLIED' ? run.applySummary : run.planSummary) ?? undefined : undefined;
  const phase = run?.status === 'APPLIED' ? 'APPLY' : 'DRY_RUN';
  const problems = (run?.rows ?? []).filter((r) => r.phase === phase && (r.action === 'ERROR' || r.warnings.length));
  const totalErrors = summary ? Object.values(summary).reduce((n, c) => n + c.error, 0) : 0;

  return (
    <GlassCard className="p-5 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><ListChecks size={18} /> 2–9 · The eight files</h2>
      {draft && !run && (
        <p className="text-sm text-blue-600 dark:text-blue-400">A checked upload from {new Date(draft.createdAt).toLocaleString()} has not been applied. <button type="button" className="underline cursor-pointer" onClick={() => void resume(draft.id)}>Resume it</button></p>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {templates.map((t, i) => (
          <div key={t.step} className="rounded-xl border border-gray-100 dark:border-white/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{i + 2} · {t.title}</p>
              <button type="button" onClick={() => template(t)} className="text-xs text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 cursor-pointer" aria-label={`Download ${t.file}`}><FileDown size={12} /> {t.file}</button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{t.creates}</p>
            <input aria-label={`Upload ${t.file}`} type="file" accept=".csv,text/csv" onChange={(e) => void pick(t.step, e.target.files?.[0])} className="mt-2 text-xs" />
            {files[t.step] && <p className="text-[11px] text-emerald-600 mt-1">{files[t.step]!.name}</p>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void dryRun()} disabled={busy || !Object.keys(files).length}>{busy && !run ? 'Checking…' : 'Check files'}</Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {run && summary && (
        <div className="space-y-3" data-testid="setup-run">
          <div className="flex items-center gap-2">
            <Badge color={run.status === 'APPLIED' ? 'green' : run.status === 'DRAFT' ? 'blue' : 'gray'}>{run.status === 'DRAFT' ? 'Checked — nothing written yet' : run.status === 'APPLIED' ? 'Applied' : 'Discarded'}</Badge>
            {totalErrors > 0 && <span className="text-sm text-red-500">{totalErrors} row{totalErrors === 1 ? '' : 's'} with errors will be skipped</span>}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b border-gray-200 dark:border-white/10"><th className="py-2">File</th><th>Create</th><th>Update</th><th>Unchanged</th><th>Warnings</th><th>Errors</th></tr></thead>
            <tbody>
              {run.steps.map((s) => {
                const c = summary[s];
                if (!c) return null;
                return (
                  <tr key={s} className="border-b border-gray-100 dark:border-white/5" data-testid={`summary-${s}`}>
                    <td className="py-2">{templates.find((t) => t.step === s)?.file ?? s}</td>
                    <td>{c.create}</td><td>{c.update}</td><td>{c.unchanged}</td>
                    <td className={c.warnings ? 'text-amber-600' : ''}>{c.warnings}</td>
                    <td className={c.error ? 'text-red-500 font-semibold' : ''}>{c.error}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {problems.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-gray-100 dark:border-white/5 p-3">
              {problems.map((r) => (
                <div key={`${r.step}-${r.rowNo}`} className="text-xs">
                  {r.action === 'ERROR'
                    ? <p className="text-red-600 flex gap-1"><XCircle size={12} className="mt-0.5 shrink-0" /> {templates.find((t) => t.step === r.step)?.file} line {r.rowNo}: {r.message}</p>
                    : r.warnings.map((w) => <p key={w} className="text-amber-600 flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {templates.find((t) => t.step === r.step)?.file} line {r.rowNo}: {w}</p>)}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {run.status === 'DRAFT' && <Button onClick={() => void apply()} disabled={busy}><Play size={14} className="mr-1" /> {busy ? 'Applying…' : 'Apply'}</Button>}
            {run.status === 'DRAFT' && <Button variant="secondary" onClick={() => void discard()} disabled={busy}>Discard</Button>}
            <Button variant="ghost" onClick={() => void report()}><FileDown size={14} className="mr-1" /> Download report</Button>
          </div>
          {run.status === 'APPLIED' && (
            <p className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Done.{run.invites?.length ? ` ${run.invites.length} staff invite${run.invites.length === 1 ? '' : 's'} sent.` : ''} Pair each room's beacon on site, then check the list above.</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
