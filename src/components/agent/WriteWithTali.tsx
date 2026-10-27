import { useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';

/**
 * Action Engine F1 — "Write with TALI" at the top of the Announcements page.
 *
 *   1. Staff describe the announcement; TALI reads it (/agent/intent) or asks one short question.
 *   2. The server drafts it and shows a preview (/agent/actions): who it reaches and how many, the
 *      first few names, the title and body, any warnings, or the audiences to choose from.
 *   3. "Open as a draft" saves it as a DRAFT announcement and opens it in the normal form below
 *      (`onDrafted`). Nothing is sent from here: the person edits and sends it there.
 * Shown only when this person may use the composer (GET /agent/available).
 */

interface Preview {
  summary: string; count: number; sample: string[]; warnings: string[];
  choices?: { kind: string; id: string; label: string }[];
  draft?: { title?: string; body?: string };
}
interface Created { action: { id: string; params: Record<string, unknown> }; preview: Preview }

const muted = 'text-slate-600 dark:text-slate-400';
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function WriteWithTali({ onDrafted }: { onDrafted: (broadcastId: string) => void }) {
  const { data: avail } = useApi<{ actions: { type: string }[] }>('/agent/available');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  /** The conversation so far: the request, TALI's questions and the answers (sent with each turn, kept only here). */
  const [turns, setTurns] = useState<{ role: 'staff' | 'tali'; text: string }[]>([]);

  if (!avail?.actions.some((a) => a.type === 'composer.draft')) return null;

  const reset = () => { setCreated(null); setQuestion(''); setError(''); };
  const startOver = () => { reset(); setTurns([]); setText(''); };

  const create = async (params: Record<string, unknown>) => {
    const c = await api.post<Created>('/agent/actions', { type: 'composer.draft', params, idempotencyKey: newKey() });
    setCreated(c);
  };

  const ask = async () => {
    const said = text.trim();
    reset();
    setBusy(true);
    try {
      // After a question, this is the answer: TALI gets the conversation so far with it.
      const r = await api.post<{ actionType?: string; params?: Record<string, unknown>; question?: string }>('/agent/intent', { text: said, earlier: turns.slice(-6) });
      if (r.question) {
        setTurns((t) => [...t, { role: 'staff' as const, text: said }, { role: 'tali' as const, text: r.question! }].slice(-6));
        setQuestion(r.question);
        setText('');
        return;
      }
      if (r.actionType !== 'composer.draft') { setQuestion('That sounds like something other than an announcement. Describe what to announce and to whom.'); return; }
      setTurns([]);
      await create(r.params ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TALI could not draft that');
    } finally { setBusy(false); }
  };

  const pick = async (choice: { kind: string; id: string }) => {
    if (!created) return;
    setBusy(true); setError('');
    try { await create({ ...created.action.params, target: { kind: choice.kind, id: choice.id } }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not use that audience'); } finally { setBusy(false); }
  };

  const open = async () => {
    if (!created) return;
    setBusy(true); setError('');
    try {
      const done = await api.post<{ status: string; error?: string | null; result?: { broadcastId?: string } }>(`/agent/actions/${created.action.id}/confirm`, {});
      if (done.status !== 'DONE' || !done.result?.broadcastId) { setError(done.error || 'TALI could not save the draft'); return; }
      onDrafted(done.result.broadcastId);
      startOver();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the draft');
    } finally { setBusy(false); }
  };

  const p = created?.preview;
  const more = p ? p.count - p.sample.length : 0;
  return (
    <div className="glass-card p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-blue-500" />
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Write with TALI</h2>
      </div>
      <p className={clsx('text-xs', muted)}>Describe the announcement: who it's for, what to say, the tone, and app, push or email. TALI drafts it; nothing is sent until you press Send. Don't type students' names.</p>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500}
        aria-label="Describe the announcement"
        placeholder={turns.length ? 'Your answer…' : 'Remind COM101 students the exam card deadline is Friday, friendly tone, app and email.'}
        className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || text.trim().length < (turns.length ? 1 : 3)} onClick={() => void ask()}>{busy && !created ? 'Drafting…' : turns.length ? 'Answer' : 'Draft it'}</Button>
        {(created || question || turns.length > 0) && <button type="button" onClick={startOver} className={clsx('text-xs flex items-center gap-1 cursor-pointer', muted)}><X size={12} /> Start over</button>}
      </div>
      {turns.length > 0 && (
        <div className="space-y-1.5">
          {turns.map((t, i) => (
            <p key={i} className={clsx('text-sm rounded-lg px-3 py-2', t.role === 'tali' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300' : 'bg-gray-50 dark:bg-white/5 text-slate-800 dark:text-slate-200')}>
              <span className="font-medium">{t.role === 'tali' ? 'TALI: ' : 'You: '}</span>{t.text}
            </p>
          ))}
        </div>
      )}
      {question && !turns.length && <p role="status" className="text-sm rounded-lg px-3 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300">{question}</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {p && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-950 dark:text-white">{p.summary}</p>
          {p.count > 0 && <p className={clsx('text-xs', muted)}>Includes {p.sample.join(', ')}{more > 0 ? ` and ${more} more` : ''}.</p>}
          {p.warnings.map((w) => <p key={w} className="text-xs flex items-start gap-1.5 text-amber-700 dark:text-amber-400"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {w}</p>)}
          {p.choices && p.choices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {p.choices.map((c) => (
                <button key={`${c.kind}:${c.id}`} type="button" disabled={busy} onClick={() => void pick(c)}
                  className="px-3 py-1.5 rounded-full text-xs bg-gray-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/20 cursor-pointer disabled:opacity-50">
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {p.draft?.title && (
            <div className="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{p.draft.title}</p>
              <p className={clsx('text-sm whitespace-pre-line mt-1', muted)}>{p.draft.body}</p>
            </div>
          )}
          {!p.choices?.length && (
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={busy} onClick={() => void open()}>{busy ? 'Saving…' : 'Open as a draft'}</Button>
              <span className={clsx('text-xs', muted)}>You can edit everything before sending.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
