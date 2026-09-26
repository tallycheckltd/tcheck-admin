import { useState, type ReactNode } from 'react';
import { ChevronDown, Lock, Plus, Send, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useApi, useMutation } from '../../hooks/useApi';
import type { FeedbackQuestionResult, FeedbackQuestionType, FeedbackRequest, FeedbackRequestResults } from '../../types';

/**
 * SBS Phase 5 — feedback campaigns, shared by the admin Request Feedback page and the staff
 * panel (StaffViewPage). Results are anonymous to all staff: the API never returns who answered,
 * and withholds scores/comments below the minimum group size — this UI just says so plainly.
 */

const MAX_QUESTIONS = 6;
const QUESTION_TYPE_LABEL: Record<FeedbackQuestionType, string> = { SCALE: 'Scale 0–10', CHOICE: 'Single choice', TEXT: 'Free text' };
const DEFAULT_CHOICES = ['Not at all', 'Somewhat', 'Very much'];

interface DraftQuestion { type: FeedbackQuestionType; prompt: string; options: string[]; required: boolean }

const blankQuestion = (type: FeedbackQuestionType = 'SCALE'): DraftQuestion => ({
  type, prompt: '', options: type === 'CHOICE' ? [...DEFAULT_CHOICES] : [], required: type !== 'TEXT',
});

function defaultCloseDate(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fieldClass = 'w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40';
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

export function formatDay(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Composer: audience comes from the caller (cohort picker differs per page); everything else is here. */
export function CampaignComposer({ cohortId, audience, onSent }: { cohortId: string; audience: ReactNode; onSent: () => void }) {
  const { mutate: create, loading } = useMutation<FeedbackRequest & { recipientCount: number }>('post');
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([{ ...blankQuestion('SCALE') }]);
  const [closeDate, setCloseDate] = useState(defaultCloseDate());
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const update = (i: number, patch: Partial<DraftQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const choicesValid = (q: DraftQuestion) => q.type !== 'CHOICE' || (q.options.filter((o) => o.trim()).length >= 2 && new Set(q.options.map((o) => o.trim())).size === q.options.length);
  const closesAt = closeDate ? new Date(`${closeDate}T23:59:00`) : null;
  const closeValid = !!closesAt && closesAt.getTime() > Date.now() + 60 * 60 * 1000 && closesAt.getTime() < Date.now() + 90 * 24 * 60 * 60 * 1000;
  const canSend = !!cohortId && !!title.trim() && !!intro.trim() && questions.every((q) => q.prompt.trim() && choicesValid(q)) && closeValid && !loading;

  const send = async () => {
    setMessage(null);
    try {
      const result = await create('/feedback-requests', {
        cohortId,
        title: title.trim(),
        prompt: intro.trim(),
        closesAt: closesAt!.toISOString(),
        questions: questions.map((q) => ({
          type: q.type, prompt: q.prompt.trim(), required: q.required,
          ...(q.type === 'CHOICE' ? { options: q.options.map((o) => o.trim()).filter(Boolean) } : {}),
        })),
      });
      setTitle(''); setIntro(''); setQuestions([{ ...blankQuestion('SCALE') }]); setCloseDate(defaultCloseDate());
      setMessage({ tone: 'ok', text: `Sent to ${result?.recipientCount ?? 0} delegates by push, in-app notification and email.` });
      onSent();
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'The campaign could not be sent.' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="campaign-title">Title</label>
          <input id="campaign-title" className={fieldClass} maxLength={200} placeholder="e.g. Programme pulse — week 2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {audience}
      </div>
      <div>
        <label className={labelClass} htmlFor="campaign-intro">Introduction</label>
        <textarea id="campaign-intro" className={clsx(fieldClass, 'resize-none')} rows={2} maxLength={2000}
          placeholder="One or two sentences on why you are asking — shown to delegates before the questions."
          value={intro} onChange={(e) => setIntro(e.target.value)} />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Questions</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{questions.length} of {MAX_QUESTIONS}</p>
        </div>
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={i} className="rounded-xl border border-gray-200 dark:border-white/10 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-slate-400 w-6">{String(i + 1).padStart(2, '0')}</span>
                <select aria-label={`Question ${i + 1} type`} value={q.type}
                  onChange={(e) => { const type = e.target.value as FeedbackQuestionType; update(i, { type, options: type === 'CHOICE' ? (q.options.length ? q.options : [...DEFAULT_CHOICES]) : [], required: type !== 'TEXT' }); }}
                  className="rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-800 dark:text-slate-200">
                  {(Object.keys(QUESTION_TYPE_LABEL) as FeedbackQuestionType[]).map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 ml-auto">
                  <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="rounded border-gray-300 dark:border-white/20" />
                  Required
                </label>
                {questions.length > 1 && (
                  <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <input aria-label={`Question ${i + 1}`} className={fieldClass} maxLength={300} placeholder="Question" value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
              {q.type === 'CHOICE' && (
                <div className="space-y-1.5 pl-8">
                  {q.options.map((o, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <input aria-label={`Option ${k + 1}`} className={clsx(fieldClass, 'py-1.5')} maxLength={100} value={o}
                        onChange={(e) => update(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                      {q.options.length > 2 && (
                        <button type="button" aria-label={`Remove option ${k + 1}`} onClick={() => update(i, { options: q.options.filter((_, m) => m !== k) })} className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 7 && (
                    <button type="button" onClick={() => update(i, { options: [...q.options, ''] })} className="text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer">Add option</button>
                  )}
                  {!choicesValid(q) && <p className="text-xs text-amber-600 dark:text-amber-400">Needs at least two distinct options.</p>}
                </div>
              )}
              {q.type === 'TEXT' && <p className="pl-8 text-xs text-slate-500 dark:text-slate-400">Delegates can write up to 1,000 characters.</p>}
            </li>
          ))}
        </ol>
        {questions.length < MAX_QUESTIONS && (
          <button type="button" onClick={() => setQuestions((qs) => [...qs, blankQuestion('SCALE')])}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer">
            <Plus size={15} /> Add a question
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-t border-gray-100 dark:border-white/10 pt-4">
        <div>
          <label className={labelClass} htmlFor="campaign-close">Closes</label>
          <input id="campaign-close" type="date" className={clsx(fieldClass, 'sm:w-48')} value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          <p className={clsx('text-xs mt-1', closeValid ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-400')}>
            {closeValid ? 'At the end of that day. One reminder goes to non-responders 24 hours before.' : 'Choose a date between tomorrow and 90 days from now.'}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1.5">
          <button onClick={() => void send()} disabled={!canSend}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
            <Send size={15} /> {loading ? 'Sending…' : 'Send campaign'}
          </button>
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Lock size={11} /> Responses are anonymous to all staff.</p>
        </div>
      </div>
      {message && (
        <p role="status" className={clsx('text-sm', message.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{message.text}</p>
      )}
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-950 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

export const rateText = (rate: number | null) => (rate == null ? '—' : `${rate.toFixed(1)}%`);

/** Campaign history — status is always spelled out in words, never colour alone. */
export function CampaignHistory({ requests, onChanged, compact = false }: { requests: FeedbackRequest[] | null; onChanged: () => void; compact?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { mutate: post, loading: closing } = useMutation('post');

  if (!requests) return <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">Loading campaigns…</p>;
  if (requests.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No campaigns yet</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Campaigns you send will appear here with their response rate.</p>
      </div>
    );
  }

  const close = async (r: FeedbackRequest) => {
    if (!window.confirm(`Close "${r.title}" now? Delegates will no longer be able to respond or change their answers.`)) return;
    await post(`/feedback-requests/${r.id}/close`);
    onChanged();
  };

  return (
    <ul className="divide-y divide-gray-100 dark:divide-white/10">
      {requests.map((r) => {
        const open = openId === r.id;
        return (
          <li key={r.id} className="py-4">
            <button className="w-full flex items-start gap-4 text-left cursor-pointer" aria-expanded={open} onClick={() => setOpenId(open ? null : r.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{r.title}</p>
                  <span className={clsx('text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
                    r.status === 'OPEN' ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10' : 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-white/10')}>
                    {r.status === 'OPEN' ? 'Open' : 'Closed'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {r.cohort.name} ({r.cohort.year}) · {r.questionCount} question{r.questionCount === 1 ? '' : 's'} · sent {formatDay(r.createdAt)} by {r.createdByName}
                  {r.status === 'OPEN' && r.closesAt ? ` · closes ${formatDay(r.closesAt)}` : ''}
                  {r.status === 'CLOSED' ? ` · closed ${formatDay(r.closedAt ?? r.closesAt)}` : ''}
                </p>
              </div>
              {!compact && (
                <div className="hidden sm:grid grid-cols-3 gap-6 text-right shrink-0">
                  <Figure label="Audience" value={String(r.recipientCount)} />
                  <Figure label="Responses" value={String(r.responseCount)} />
                  <Figure label="Rate" value={rateText(r.responseRate)} />
                </div>
              )}
              <ChevronDown size={16} className={clsx('text-slate-400 shrink-0 mt-1 transition-transform', open && 'rotate-180')} />
            </button>
            {compact && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">{r.responseCount} of {r.recipientCount} responded · {rateText(r.responseRate)}</p>}
            {open && (
              <div className="mt-4 space-y-4">
                <CampaignResults requestId={r.id} />
                {r.status === 'OPEN' && (
                  <button onClick={() => void close(r)} disabled={closing}
                    className="text-xs font-medium text-slate-600 dark:text-slate-300 underline underline-offset-2 hover:text-red-600 disabled:opacity-50 cursor-pointer">
                    Close campaign now
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function QuestionResult({ q, total }: { q: FeedbackQuestionResult; total: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{q.prompt}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">{q.answered} answered</p>
      </div>
      {q.type === 'SCALE' && (
        q.average == null ? <p className="text-sm text-slate-500 dark:text-slate-400">—</p> : (
          <div className="flex items-end gap-4">
            <p className="text-3xl font-semibold tabular-nums text-slate-950 dark:text-white leading-none">{q.average.toFixed(1)}<span className="text-base font-normal text-slate-400"> / 10</span></p>
            {q.distribution && (
              <div className="flex items-end gap-0.5 h-8" aria-label="Score distribution from 0 to 10">
                {q.distribution.map((n, i) => (
                  <div key={i} title={`${i}: ${n}`} className="w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" style={{ height: `${Math.max(6, (n / Math.max(1, ...q.distribution!)) * 100)}%` }} />
                ))}
              </div>
            )}
          </div>
        )
      )}
      {q.type === 'CHOICE' && q.distribution && (
        <ul className="space-y-1.5">
          {q.options!.map((o, i) => {
            const n = q.distribution![i];
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <li key={o} className="text-sm">
                <div className="flex justify-between text-slate-700 dark:text-slate-300"><span>{o}</span><span className="tabular-nums text-slate-500">{n} · {pct}%</span></div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 mt-1"><div className="h-full rounded-full bg-slate-500 dark:bg-slate-400" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
      )}
      {q.type === 'TEXT' && q.comments && (
        q.comments.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No written responses.</p> : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {q.comments.map((c, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-slate-200 dark:border-white/15 pl-3 leading-relaxed">{c}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** Anonymous results for one campaign — no respondent is ever named. */
export function CampaignResults({ requestId }: { requestId: string }) {
  const { data: r, error } = useApi<FeedbackRequestResults>(`/feedback-requests/${requestId}/results`);
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Results could not be loaded. {error}</p>;
  if (!r) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading results…</p>;
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-4 space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Figure label="Audience" value={String(r.recipientCount)} sub="frozen when sent" />
        <Figure label="Responses" value={String(r.responseCount)} />
        <Figure label="Response rate" value={rateText(r.responseRate)} />
      </div>
      {r.suppressed ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 border-t border-gray-200 dark:border-white/10 pt-4">
          Results appear once at least 3 delegates have responded, so no individual answer can be singled out.
        </p>
      ) : (
        <div className="space-y-6 border-t border-gray-200 dark:border-white/10 pt-4">
          {r.questions.map((q) => <QuestionResult key={q.id} q={q} total={q.answered} />)}
        </div>
      )}
      <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Lock size={11} /> Anonymous — respondents are never identified, comments are shown in alphabetical order.</p>
    </div>
  );
}
