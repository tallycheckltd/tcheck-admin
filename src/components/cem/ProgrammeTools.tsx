import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { AlertTriangle, CalendarPlus, CheckCircle2, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

/**
 * SBS (Hans, 2026-11-05) — CEMs run their own programmes: create one, add delegates, add sessions.
 * Every add is a preview first (nothing is saved), then "Add" saves it; a preview with a problem
 * can't be saved until it's fixed. Server: /cem/programmes* (cemProgrammes.service).
 */

interface Options {
  programmes: { id: string; code: string; name: string }[];
  cems: { id: string; firstName: string; lastName: string }[];
  faculty: { id: string; firstName: string; lastName: string; email: string }[];
  rooms: { id: string; name: string }[];
  canChooseCem: boolean;
}
interface PreviewRow { rowNo: number; action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR'; message?: string; warnings: string[]; key?: string; email?: string; studentId?: string }
interface StepResult { applied: boolean; rows: PreviewRow[]; summary: { added: number; updated: number; unchanged: number; errors: number } }

const muted = 'text-sm text-gray-500 dark:text-gray-400';
const select = 'w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-gray-900 dark:text-white';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
/** Tells the programme page (ProgramDetailView) to reload its numbers. */
const announceChange = (cohortId: string) => window.dispatchEvent(new CustomEvent('tcheck:programme-changed', { detail: cohortId }));

const ACTION_LABEL: Record<PreviewRow['action'], string> = { CREATE: 'New', UPDATE: 'Existing, will be added', UNCHANGED: 'Already in', ERROR: 'Problem' };
const DONE_LABEL: Record<PreviewRow['action'], string> = { CREATE: 'Added', UPDATE: 'Added', UNCHANGED: 'Already in', ERROR: 'Problem' };

function PreviewTable({ result, describe }: { result: StepResult; describe: (r: PreviewRow) => string }) {
  // A note every row shares (e.g. "no beacon in this room") is shown once, above the list.
  const shared = result.rows.length > 1 ? result.rows[0].warnings.filter((w) => result.rows.every((r) => r.warnings.includes(w))) : [];
  return (
    <div className="space-y-2">
      <p className={clsx('text-sm font-medium', result.summary.errors ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')}>
        {result.applied
          ? `Saved: ${result.summary.added + result.summary.updated} added${result.summary.unchanged ? `, ${result.summary.unchanged} already in` : ''}.`
          : result.summary.errors
            ? `${result.summary.errors} row${result.summary.errors === 1 ? ' has a problem' : 's have problems'}. Fix ${result.summary.errors === 1 ? 'it' : 'them'} to continue.`
            : `Ready: ${result.summary.added} new${result.summary.updated ? `, ${result.summary.updated} existing` : ''}${result.summary.unchanged ? `, ${result.summary.unchanged} already in` : ''}. Nothing is saved until you press Add.`}
      </p>
      {shared.map((w) => <p key={w} className="text-xs text-amber-700 dark:text-amber-400 flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</p>)}
      <ul className="divide-y divide-gray-100 dark:divide-white/5 rounded-xl border border-gray-100 dark:border-white/10 max-h-64 overflow-y-auto">
        {result.rows.map((r) => (
          <li key={r.rowNo} className="px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-900 dark:text-white truncate">{r.rowNo}. {describe(r)}</span>
              <span className={clsx('text-xs font-medium shrink-0 px-2 py-0.5 rounded-full',
                r.action === 'ERROR' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                  : r.action === 'CREATE' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300')}>{(result.applied ? DONE_LABEL : ACTION_LABEL)[r.action]}</span>
            </div>
            {r.message && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{r.message}</p>}
            {r.warnings.filter((w) => !shared.includes(w)).map((w) => <p key={w} className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</p>)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── New programme ───────────────────────────────────────────────────────────────────────────────

export function NewProgrammeButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" className={className} onClick={() => setOpen(true)}><Plus size={16} /> New programme</Button>
      {open && createPortal(<NewProgrammeModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function NewProgrammeModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: opts } = useApi<Options>('/cem/programme-options');
  const [form, setForm] = useState({ name: '', majorId: '', newCode: '', newName: '', startDate: '', endDate: '', clientOrganisation: '', cemId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isNew = form.majorId === '__new';

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.startDate || !form.endDate || !form.majorId) { setError('Fill in the name, programme type and dates.'); return; }
    if (isNew && (!form.newCode.trim() || !form.newName.trim())) { setError('Give the new programme type a short code and a name.'); return; }
    if (opts?.canChooseCem && !form.cemId) { setError('Choose the CEM who will run it.'); return; }
    setBusy(true);
    try {
      const made = await api.post<{ id: string }>('/cem/programmes', {
        name: form.name.trim(),
        majorId: isNew ? null : form.majorId,
        newProgramme: isNew ? { code: form.newCode.trim(), name: form.newName.trim() } : null,
        startDate: form.startDate,
        endDate: form.endDate,
        clientOrganisation: form.clientOrganisation.trim() || null,
        cemId: opts?.canChooseCem ? form.cemId : null,
      });
      onClose();
      // A Head of CEM works from the team board; a CEM goes straight to the new programme.
      navigate(user?.role === 'CEM_MANAGER' ? '/cem-team' : `/cem/cohorts/${made.id}`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New programme">
      <div className="space-y-4">
        <p className={muted}>One run of a programme, with its own delegates and sessions. You can add delegates and sessions straight after.</p>
        <Input label="Programme name" placeholder="e.g. AMP February 2027 or SLP Kilima Insurance" value={form.name} onChange={set('name')} maxLength={120} />
        <div>
          <label className={label} htmlFor="np-type">Programme type</label>
          <select id="np-type" className={select} value={form.majorId} onChange={set('majorId')}>
            <option value="">Choose…</option>
            {opts?.programmes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            <option value="__new">+ A new programme type</option>
          </select>
        </div>
        {isNew && (
          <div className="grid grid-cols-3 gap-3">
            <Input label="Code" placeholder="e.g. WLP" value={form.newCode} onChange={set('newCode')} maxLength={12} />
            <div className="col-span-2"><Input label="Name" placeholder="e.g. Women in Leadership Programme" value={form.newName} onChange={set('newName')} maxLength={120} /></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Starts" type="date" value={form.startDate} onChange={set('startDate')} />
          <Input label="Ends" type="date" value={form.endDate} onChange={set('endDate')} />
        </div>
        <Input label="Client company (optional)" placeholder="For a custom programme, e.g. Kilima Insurance" value={form.clientOrganisation} onChange={set('clientOrganisation')} maxLength={200} />
        {opts?.canChooseCem && (
          <div>
            <label className={label} htmlFor="np-cem">CEM running it</label>
            <select id="np-cem" className={select} value={form.cemId} onChange={set('cemId')}>
              <option value="">Choose…</option>
              {opts.cems.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create programme'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delegates ───────────────────────────────────────────────────────────────────────────────────

interface Delegate { id: string; firstName: string; lastName: string; email: string; studentId: string | null; company: string | null; jobTitle: string | null; membership: string; signedIn: boolean }
interface DelegateDraft { firstName: string; lastName: string; email: string; company: string; jobTitle: string }
const emptyDraft = (): DelegateDraft => ({ firstName: '', lastName: '', email: '', company: '', jobTitle: '' });

/** Pasted from a spreadsheet: first name, last name, email, company, job title (tab or comma). A header row is skipped. */
function parsePaste(text: string): DelegateDraft[] {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split(l.includes('\t') ? '\t' : ',').map((c) => c.trim()));
  // Only the first line can be a header, and only when it reads like one ("First name", "Email").
  const isHeader = (c: string[]) => /^first\s*name$/i.test(c[0] ?? '') || /^e-?mail$/i.test(c[2] ?? '');
  return (rows.length && isHeader(rows[0]) ? rows.slice(1) : rows)
    .map((c) => ({ firstName: c[0] ?? '', lastName: c[1] ?? '', email: c[2] ?? '', company: c[3] ?? '', jobTitle: c[4] ?? '' }));
}

export function ProgrammeDelegates({ cohortId }: { cohortId: string }) {
  const { data, loading, refetch } = useApi<{ programme: { name: string }; delegates: Delegate[] }>(`/cem/programmes/${cohortId}/delegates`);
  const [adding, setAdding] = useState(false);
  const [sessions, setSessions] = useState(false);
  const delegates = data?.delegates ?? [];
  const signedIn = delegates.filter((d) => d.signedIn).length;

  return (
    <section className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Users size={18} className="text-blue-500" /> Delegates</h2>
          <p className={muted}>{delegates.length} in this programme · {signedIn} signed in to the app</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => setSessions(true)}><CalendarPlus size={16} /> Add sessions</Button>
          <Button size="sm" onClick={() => setAdding(true)}><UserPlus size={16} /> Add delegates</Button>
        </div>
      </div>
      {loading ? <p className={muted}>Loading…</p> : delegates.length === 0 ? (
        <p className={clsx(muted, 'py-4 text-center')}>No delegates yet. Add them one by one or paste a list from a spreadsheet.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr><th className="px-2 py-2">Delegate</th><th className="px-2 py-2">Company</th><th className="px-2 py-2 hidden md:table-cell">ID</th><th className="px-2 py-2">App</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {delegates.map((d) => (
                <tr key={d.id}>
                  <td className="px-2 py-2"><p className="text-gray-900 dark:text-white font-medium">{d.firstName} {d.lastName}</p><p className="text-xs text-gray-500 dark:text-gray-400 break-all">{d.email}</p></td>
                  <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{d.company ?? '—'}{d.jobTitle ? <span className="block text-xs text-gray-500 dark:text-gray-400">{d.jobTitle}</span> : null}</td>
                  <td className="px-2 py-2 text-gray-600 dark:text-gray-300 hidden md:table-cell">{d.studentId}</td>
                  <td className="px-2 py-2">{d.signedIn
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><CheckCircle2 size={14} /> Signed in</span>
                    : <span className="text-xs text-gray-500 dark:text-gray-400">Not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Portalled: the card's blur creates its own layer, which would trap the window under the sections below. */}
      {adding && createPortal(<AddDelegatesModal cohortId={cohortId} programme={data?.programme.name ?? 'this programme'} onClose={(saved) => { setAdding(false); if (saved) announceChange(cohortId); }} onSaved={refetch} />, document.body)}
      {sessions && createPortal(<AddSessionsModal cohortId={cohortId} programme={data?.programme.name ?? 'this programme'} onClose={(saved) => { setSessions(false); if (saved) announceChange(cohortId); }} />, document.body)}
    </section>
  );
}

function AddDelegatesModal({ cohortId, programme, onClose: close, onSaved }: { cohortId: string; programme: string; onClose: (saved: boolean) => void; onSaved: () => void }) {
  const [saved, setSaved] = useState(false);
  const onClose = () => close(saved);
  const [tab, setTab] = useState<'form' | 'paste'>('form');
  const [rows, setRows] = useState<DelegateDraft[]>([emptyDraft()]);
  const [paste, setPaste] = useState('');
  const [result, setResult] = useState<StepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const list = useMemo(() => (tab === 'paste' ? parsePaste(paste) : rows).filter((r) => r.firstName || r.lastName || r.email), [tab, paste, rows]);
  const update = (i: number, k: keyof DelegateDraft, v: string) => { setResult(null); setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r))); };

  const send = async (mode: 'plan' | 'apply') => {
    setError('');
    if (!list.length) { setError('Add at least one delegate.'); return; }
    const missing = list.findIndex((r) => !r.firstName.trim() || !r.lastName.trim() || !r.email.trim());
    if (missing >= 0) { setError(`Row ${missing + 1} needs a first name, last name and email.`); return; }
    const badEmail = list.findIndex((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()));
    if (badEmail >= 0) { setError(`Row ${badEmail + 1}: "${list[badEmail].email}" is not a valid email address.`); return; }
    setBusy(true);
    try {
      const r = await api.post<StepResult>(`/cem/programmes/${cohortId}/delegates`, { mode, delegates: list.map((d) => ({ ...d, company: d.company || undefined, jobTitle: d.jobTitle || undefined })) });
      setResult(r);
      if (r.applied) { setSaved(true); onSaved(); }
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const describe = (r: PreviewRow) => { const d = list[r.rowNo - 1]; return d ? `${d.firstName} ${d.lastName} · ${d.email}` : r.email ?? ''; };

  return (
    <Modal open onClose={onClose} title={`Add delegates to ${programme}`}>
      <div className="space-y-4">
        {result?.applied ? (
          <>
            <PreviewTable result={result} describe={describe} />
            <p className={muted}>They can now sign in to the Tcheck app with their email. They'll see this programme's sessions and materials.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setResult(null); setRows([emptyDraft()]); setPaste(''); }}>Add more</Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <div role="tablist" className="inline-flex rounded-xl border border-gray-200 dark:border-white/10 p-1 gap-1">
              {(['form', 'paste'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setResult(null); }}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer', tab === t ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5')}>
                  {t === 'form' ? 'One by one' : 'Paste a list'}
                </button>
              ))}
            </div>
            {tab === 'form' ? (
              <div className="space-y-3">
                {rows.map((r, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 dark:border-white/10 p-3 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Delegate {i + 1}</span>
                      {rows.length > 1 && <button aria-label={`Remove delegate ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input placeholder="First name" aria-label="First name" value={r.firstName} onChange={(e) => update(i, 'firstName', e.target.value)} />
                      <Input placeholder="Last name" aria-label="Last name" value={r.lastName} onChange={(e) => update(i, 'lastName', e.target.value)} />
                      <div className="sm:col-span-2"><Input placeholder="Email" aria-label="Email" type="email" value={r.email} onChange={(e) => update(i, 'email', e.target.value)} /></div>
                      <Input placeholder="Company (optional)" aria-label="Company" value={r.company} onChange={(e) => update(i, 'company', e.target.value)} />
                      <Input placeholder="Job title (optional)" aria-label="Job title" value={r.jobTitle} onChange={(e) => update(i, 'jobTitle', e.target.value)} />
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => { setResult(null); setRows((rs) => [...rs, emptyDraft()]); }}><Plus size={14} /> Another delegate</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className={muted}>Copy the rows from Excel or Google Sheets and paste them here. Columns: first name, last name, email, company, job title.</p>
                <textarea aria-label="Pasted delegates" value={paste} onChange={(e) => { setPaste(e.target.value); setResult(null); }} rows={7}
                  placeholder={'Amina\tOdhiambo\tamina@company.com\tKilima Insurance\tHead of Claims'}
                  className={clsx(select, 'font-mono text-xs')} />
                <p className={muted}>{list.length} delegate{list.length === 1 ? '' : 's'} found.</p>
              </div>
            )}
            {result && <PreviewTable result={result} describe={describe} />}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              {result && !result.summary.errors
                ? <Button onClick={() => send('apply')} disabled={busy}>{busy ? 'Adding…' : `Add ${list.length} delegate${list.length === 1 ? '' : 's'}`}</Button>
                : <Button onClick={() => send('plan')} disabled={busy}>{busy ? 'Checking…' : 'Check'}</Button>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Sessions ────────────────────────────────────────────────────────────────────────────────────

interface SessionDraft { module: string; facultyEmail: string; date: string; startTime: string; endTime: string; room: string }

function AddSessionsModal({ cohortId, programme, onClose: close }: { cohortId: string; programme: string; onClose: (saved: boolean) => void }) {
  const [saved, setSaved] = useState(false);
  const onClose = () => close(saved);
  const { data: opts } = useApi<Options>('/cem/programme-options');
  const [base, setBase] = useState<SessionDraft>({ module: '', facultyEmail: '', date: '', startTime: '09:00', endTime: '12:00', room: '' });
  const [weeks, setWeeks] = useState(1);
  const [result, setResult] = useState<StepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof SessionDraft) => (e: { target: { value: string } }) => { setResult(null); setBase((b) => ({ ...b, [k]: e.target.value })); };

  // "Repeat weekly" makes one session per week from the first date.
  const sessions = useMemo(() => {
    if (!base.date) return [];
    return Array.from({ length: Math.max(1, Math.min(26, weeks)) }, (_, i) => {
      const d = new Date(`${base.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * i);
      return { ...base, date: d.toISOString().slice(0, 10) };
    });
  }, [base, weeks]);

  const send = async (mode: 'plan' | 'apply') => {
    setError('');
    if (!base.module.trim() || !base.facultyEmail || !base.date || !base.startTime || !base.endTime) { setError('Fill in the module, faculty, date and times.'); return; }
    if (base.endTime <= base.startTime) { setError('The end time must be after the start time.'); return; }
    setBusy(true);
    try {
      const r = await api.post<StepResult>(`/cem/programmes/${cohortId}/sessions`, { mode, sessions: sessions.map((s) => ({ ...s, room: s.room || undefined })) });
      setResult(r);
      if (r.applied) setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const describe = (r: PreviewRow) => { const s = sessions[r.rowNo - 1]; return s ? `${s.module} · ${fmt(s.date)} ${s.startTime}–${s.endTime}` : r.key ?? ''; };

  return (
    <Modal open onClose={onClose} title={`Add sessions to ${programme}`}>
      <div className="space-y-4">
        {result?.applied ? (
          <>
            <PreviewTable result={result} describe={describe} />
            <p className={muted}>Delegates see these sessions in the app and check in to them.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setResult(null)}>Add more</Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <Input label="Module" placeholder="e.g. Leading Change" value={base.module} onChange={set('module')} maxLength={120} />
            <div>
              <label className={label} htmlFor="as-fac">Faculty</label>
              <select id="as-fac" className={select} value={base.facultyEmail} onChange={set('facultyEmail')}>
                <option value="">Choose…</option>
                {opts?.faculty.map((f) => <option key={f.id} value={f.email}>{f.firstName} {f.lastName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Date" type="date" value={base.date} onChange={set('date')} />
              <Input label="Starts" type="time" value={base.startTime} onChange={set('startTime')} />
              <Input label="Ends" type="time" value={base.endTime} onChange={set('endTime')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="as-room">Room</label>
                <select id="as-room" className={select} value={base.room} onChange={set('room')}>
                  <option value="">No room yet</option>
                  {opts?.rooms.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="as-weeks">Repeat weekly</label>
                <select id="as-weeks" className={select} value={weeks} onChange={(e) => { setResult(null); setWeeks(Number(e.target.value)); }}>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Just once' : `${n} weeks`}</option>)}
                </select>
              </div>
            </div>
            {result && <PreviewTable result={result} describe={describe} />}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              {result && !result.summary.errors
                ? <Button onClick={() => send('apply')} disabled={busy}>{busy ? 'Adding…' : `Add ${sessions.length} session${sessions.length === 1 ? '' : 's'}`}</Button>
                : <Button onClick={() => send('plan')} disabled={busy}>{busy ? 'Checking…' : 'Check'}</Button>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
