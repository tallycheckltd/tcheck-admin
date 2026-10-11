import { useState } from 'react';
import { clsx } from 'clsx';
import { BookOpen, CheckCircle2, Circle, FileText, MessageSquareText, Trash2, UploadCloud, Users } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';

/**
 * The parts of TALI a school sets up once, shown where setting-up already happens:
 *   - TaliSchoolText → Institution Setup (the documents students' campus questions are answered from)
 *   - SwitchesCard   → Settings (the School Admin's on/off for staff and students)
 * Both call /insights/* on our own backend, which checks the role and the TALI permission.
 */

export interface TaliAccess { enabled: boolean; permissions: string[]; switches?: { staff: boolean; student: boolean } }

const selectCls = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';
const muted = 'text-slate-600 dark:text-slate-400';
function Loading() { return <p className={clsx('text-sm', muted)}>Loading…</p>; }

// ── The school's own text ───────────────────────────────────────────────────────────────────
interface Doc { id: string; title: string; kind: string; passages: number; sourceLabel: string }
const KINDS = ['handbook', 'campus', 'fees', 'exams', 'calendar', 'policy', 'other'];

/** What a school usually needs, so the list reads as a checklist and not a blank page. */
const EXPECTED: { kind: string; label: string }[] = [
  { kind: 'handbook', label: 'Student handbook' }, { kind: 'fees', label: 'Fees and payments' }, { kind: 'exams', label: 'Exam rules' },
  { kind: 'calendar', label: 'Academic calendar' }, { kind: 'campus', label: 'Campus services (library, health, hostels)' },
];

export function TaliSchoolText() {
  const docs = useApi<{ docs: Doc[] }>('/insights/school-text/docs');
  const contacts = useApi<{ contacts: { topic: string; label: string }[] }>('/insights/school-text/contacts');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('other');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [removing, setRemoving] = useState<Doc | null>(null);
  if (docs.loading) return <Loading />;
  if (docs.error) return null; // TALI is not on for this school, or not for this person: nothing to set up here
  const have = new Set((docs.data?.docs ?? []).map((d) => d.kind));
  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.(txt|md)$/i.test(f.name)) { setMsg('For now, upload a .txt or .md file, or paste the text. Word and PDF are coming.'); return; }
    setText(await f.text());
    if (!title.trim()) setTitle(f.name.replace(/\.(txt|md)$/i, ''));
    setMsg(`Loaded ${f.name}. Check it, pick what it is, then press Add.`);
  };
  const add = async () => {
    if (!title.trim() || !text.trim()) { setMsg('A title and the text are both needed.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await api.post<{ passages: number }>('/insights/school-text/docs', { title: title.trim(), kind, sourceLabel: title.trim(), text });
      setMsg(`Added: ${r.passages} passage(s). Students can ask about it now.`); setTitle(''); setText(''); await docs.refetch({ silent: true });
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not add'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="font-semibold text-slate-950 dark:text-white flex items-center gap-2"><BookOpen size={18} className="text-blue-500" /> TALI: what students can ask about</h2>
        <p className={clsx('text-sm mt-1', muted)}>Students' campus questions are answered <strong>only</strong> from the documents you add here, with the source shown. When nothing matches, TALI says it doesn't know and points to your contacts.</p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {EXPECTED.map((e) => (
            <li key={e.kind} className="flex items-center gap-2 text-sm">
              {have.has(e.kind) ? <CheckCircle2 size={16} className="text-green-600 shrink-0" /> : <Circle size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />}
              <span className={have.has(e.kind) ? 'text-slate-950 dark:text-white' : muted}>{e.label}{have.has(e.kind) ? '' : ': not added yet'}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="font-semibold text-slate-950 dark:text-white mb-3">Documents</h2>
          {docs.data?.docs.length ? (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {docs.data.docs.map((d) => (
                <li key={d.id} className="py-2 flex items-start justify-between gap-3">
                  <span><span className="font-medium text-sm text-slate-950 dark:text-white">{d.title}</span>
                    <span className={clsx('block text-xs', muted)}>{d.kind} · {d.passages} passages · shown as "{d.sourceLabel}"</span></span>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${d.title}`} onClick={() => setRemoving(d)}><Trash2 size={14} /></Button>
                </li>
              ))}
            </ul>
          ) : <EmptyState size="sm" icon={FileText} title="No documents yet" description="Add the handbook, fees or campus guide below." />}
          <div className="mt-4 space-y-2 border-t border-gray-100 dark:border-white/5 pt-4">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Add a document</h3>
            <div className="flex gap-2">
              <div className="flex-1"><Input aria-label="Title" placeholder="Title, e.g. Hostel rules 2026" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} className={selectCls}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </div>
            <textarea aria-label="Text" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the text. Use # headings for sections."
              className="w-full rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white" />
            <div className="flex flex-wrap items-center gap-3"><Button size="sm" disabled={busy} onClick={() => void add()}>{busy ? 'Adding…' : 'Add'}</Button>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer"><UploadCloud size={14} /> Upload a text file
                <input type="file" accept=".txt,.md,text/plain" className="sr-only" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} /></label>{msg && <span role="status" className={clsx('text-xs', muted)}>{msg}</span>}</div>
          </div>
        </GlassCard>
        <GlassCard>
          <h2 className="font-semibold text-slate-950 dark:text-white mb-3">Contacts</h2>
          <p className={clsx('text-xs mb-3', muted)}>Where TALI sends a student when the documents don't answer them.</p>
          {contacts.data?.contacts.length ? (
            <table className="w-full text-sm"><tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {contacts.data.contacts.map((c) => <tr key={c.topic}><td className={clsx('py-2 pr-3 text-xs capitalize', muted)}>{c.topic.replace(/_/g, ' ')}</td><td className="py-2">{c.label}</td></tr>)}
            </tbody></table>
          ) : <p className={clsx('text-sm', muted)}>No contacts set.</p>}
        </GlassCard>
      </div>
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove this document?">
        <p className="text-sm text-slate-700 dark:text-slate-300">"{removing?.title}" and its passages are removed. Students can no longer get answers from it.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setRemoving(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => { const d = removing!; setRemoving(null); void api.delete(`/insights/school-text/docs/${d.id}`).then(() => docs.refetch({ silent: true })); }}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── The School Admin's switches ─────────────────────────────────────────────────────────────
function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={clsx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50', on ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/20')}>
      <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5', on ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function SwitchesCard({ initial, onChange }: { initial: { staff: boolean; student: boolean }; onChange?: (s: { staff: boolean; student: boolean }) => void }) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = async (patch: Partial<typeof s>) => {
    setBusy(true); setMsg('');
    try { const next = await api.put<typeof s>('/insights/switches', patch); setS(next); onChange?.(next); setMsg('Saved.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const row = (key: 'staff' | 'student', icon: React.ReactNode, title: string, desc: string) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex gap-3">{icon}<div><p className="text-sm font-medium text-slate-950 dark:text-white">{title}</p><p className={clsx('text-xs max-w-xl', muted)}>{desc}</p></div></div>
      <Switch on={s[key]} disabled={busy} label={title} onChange={(v) => void set({ [key]: v })} />
    </div>
  );
  return (
    <GlassCard>
      <h2 className="font-semibold text-slate-950 dark:text-white">TALI for your institution</h2>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {row('staff', <Users size={18} className="text-blue-500 mt-0.5" />, 'Staff TALI', 'This tab for the roles allowed it: the weekly briefing, students at risk and Ask. Off hides it for everyone; nightly scoring and briefing emails stop.')}
        {row('student', <MessageSquareText size={18} className="text-blue-500 mt-0.5" />, 'Student TALI', 'The TALI chat in the student app. Students only ever see their own classes and attendance, and answers about campus come only from your documents. Off removes the chat for every student.')}
      </div>
      {msg && <p role="status" className={clsx('text-xs mt-2', muted)}>{msg}</p>}
    </GlassCard>
  );
}
