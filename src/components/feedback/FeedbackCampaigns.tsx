import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, Eye, Lock, Plus, Search, Send, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { CampaignAudiences, FeedbackQuestionResult, FeedbackQuestionSets, FeedbackQuestionType, FeedbackRequest, FeedbackRequestResults, School, SchoolQuestion } from '../../types';

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

/** Who a campaign goes to — one or more programmes, or the whole school. */
export interface CampaignTarget { audience: 'COHORT' | 'SCHOOL'; cohortIds: string[]; schoolId?: string }

/** Composer: the audience picker is passed in; everything else is here. */
export function CampaignComposer({ target, audience, onSent }: { target: CampaignTarget | null; audience: ReactNode; onSent: () => void }) {
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
  const targetValid = !!target && (target.audience === 'SCHOOL' || target.cohortIds.length > 0);
  const canSend = targetValid && !!title.trim() && !!intro.trim() && questions.every((q) => q.prompt.trim() && choicesValid(q)) && closeValid && !loading;

  const send = async () => {
    setMessage(null);
    try {
      const result = await create('/feedback-requests', {
        audience: target!.audience,
        ...(target!.audience === 'COHORT' ? { cohortIds: target!.cohortIds } : {}),
        ...(target!.schoolId ? { schoolId: target!.schoolId } : {}),
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
      {audience}
      <div>
        <label className={labelClass} htmlFor="campaign-title">Title</label>
        <input id="campaign-title" className={fieldClass} maxLength={200} placeholder="e.g. Programme pulse — week 2" value={title} onChange={(e) => setTitle(e.target.value)} />
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
                  {r.kind === 'COURSE_END' && (
                    <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">Automatic · end of course</span>
                  )}
                  {r.canManage === false && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400"><Eye size={11} /> View only</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {r.audienceLabel ?? (r.cohort ? `${r.cohort.name} (${r.cohort.year})` : 'Whole school')} · {r.questionCount} question{r.questionCount === 1 ? '' : 's'} · sent {formatDay(r.createdAt)} by {r.createdByName}
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
                {r.status === 'OPEN' && r.canManage !== false && (
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

// ─── The one Request Feedback workspace (09-27) ──────────────────────────────────────────────

type AudienceMode = 'COHORT' | 'SCHOOL' | 'STUDENT';
const modeLabel: Record<AudienceMode, string> = { COHORT: 'Programmes', SCHOOL: 'Whole school', STUDENT: 'One student' };

/** Open campaigns this new one would overlap — same people asked twice in the same week. */
function overlapping(requests: FeedbackRequest[] | null, target: CampaignTarget | null, schoolId: string | undefined): FeedbackRequest[] {
  if (!requests || !target) return [];
  return requests.filter((r) => {
    if (r.status !== 'OPEN') return false;
    if (schoolId && r.school?.id && r.school.id !== schoolId) return false;
    if (target.audience === 'SCHOOL' || r.audience === 'SCHOOL') return true;
    const ids = new Set((r.cohorts?.length ? r.cohorts : r.cohort ? [r.cohort] : []).map((c) => c.id));
    return target.cohortIds.some((id) => ids.has(id));
  });
}

interface StudentHit { id: string; firstName: string; lastName: string; studentId?: string | null }

/** Staff only: nudge one delegate to rate their latest session (the pre-campaign flow, unchanged). */
function OneStudentRequest({ cohortId }: { cohortId?: string }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [status, setStatus] = useState('');
  const { mutate: request, loading } = useMutation('post');
  const q = search.trim();
  const { data: hits } = useApi<StudentHit[]>(q.length >= 2 ? `/staff/students?search=${encodeURIComponent(q)}${cohortId ? `&cohortId=${cohortId}` : ''}` : null);

  const submit = async () => {
    if (!picked) return;
    try {
      await request('/staff/request-feedback', { studentId: picked.id });
      setStatus(`Asked ${picked.firstName} ${picked.lastName} to rate their latest session.`);
      setPicked(null); setSearch('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'The request could not be sent.');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-400">Sends one delegate the standard "How was the session?" rating for their most recent session with you.</p>
      {picked ? (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-sm">
          <span>{picked.firstName} {picked.lastName}{picked.studentId ? ` (${picked.studentId})` : ''}</span>
          <button type="button" onClick={() => setPicked(null)} className="text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer">Change</button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input className={clsx(fieldClass, 'pl-9')} placeholder="Search by name or student ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
          {!!hits?.length && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg">
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => { setPicked(h); setSearch(''); }} className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                  {h.firstName} {h.lastName} {h.studentId ? <span className="text-slate-500">({h.studentId})</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={() => void submit()} disabled={!picked || loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          <Send size={15} /> {loading ? 'Sending…' : 'Send request'}
        </button>
      </div>
      {status && <p role="status" className="text-sm text-slate-600 dark:text-slate-400">{status}</p>}
    </div>
  );
}

/**
 * The single Request Feedback page — the admin tab, the lecturer/CEM Staff View panel and the CEM
 * programme page all render THIS, so the tabs look and work the same; only the scope differs.
 * What each account may target comes from GET /feedback-requests/audiences (and is enforced again
 * server-side on send): school admins and SUPER_ADMIN may pick any programme(s) or the whole
 * school; lecturers/CEMs their own programmes, plus the one-student request. At a non-Executive
 * Education school only SUPER_ADMIN may send — everyone else sees why instead of a form.
 *
 * `cohortId` (CEM programme page) preselects that programme and narrows the history to campaigns
 * that reached it. `showHeader` is off where the surrounding page already has the title.
 */
export function RequestFeedbackWorkspace({ cohortId, showHeader = true }: { cohortId?: string; showHeader?: boolean }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [schoolId, setSchoolId] = useState('');
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const { data: options } = useApi<CampaignAudiences>(
    isSuperAdmin ? (schoolId ? `/feedback-requests/audiences?schoolId=${schoolId}` : null) : '/feedback-requests/audiences',
  );
  const { data: allRequests, refetch } = useApi<FeedbackRequest[]>(`/feedback-requests${cohortId ? `?cohortId=${cohortId}` : ''}`);

  const [mode, setMode] = useState<AudienceMode>('COHORT');
  const [selected, setSelected] = useState<string[]>(cohortId ? [cohortId] : []);
  const [filter, setFilter] = useState('');

  const requests = useMemo(
    () => (allRequests && isSuperAdmin && schoolId ? allRequests.filter((r) => r.school?.id === schoolId) : allRequests),
    [allRequests, isSuperAdmin, schoolId],
  );
  const modes: AudienceMode[] = [
    'COHORT',
    ...(options?.canSurveySchool ? (['SCHOOL'] as const) : []),
    ...(options?.canAskOneStudent ? (['STUDENT'] as const) : []),
  ];
  const activeMode = modes.includes(mode) ? mode : 'COHORT';
  const target: CampaignTarget | null = activeMode === 'SCHOOL'
    ? { audience: 'SCHOOL', cohortIds: [], ...(isSuperAdmin && schoolId ? { schoolId } : {}) }
    : activeMode === 'COHORT' ? { audience: 'COHORT', cohortIds: selected } : null;
  const clashes = overlapping(requests ?? null, target && (target.audience === 'SCHOOL' || target.cohortIds.length) ? target : null, options?.school?.id);
  const cohorts = (options?.cohorts ?? []).filter((c) => !filter.trim() || c.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const scopeLine = !options ? null
    : options.canSurveySchool ? `You can survey any programme at ${options.school?.name ?? 'this school'}, several at once, or the whole school.`
      : options.canSend ? 'You can survey the programmes you teach into, or ask one delegate for feedback.'
        : null;

  const audiencePicker = (
    <div className="space-y-3">
      {isSuperAdmin && (
        <div>
          <label className={labelClass} htmlFor="rf-school">School</label>
          <select id="rf-school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setSelected([]); }} className={clsx(fieldClass, 'sm:w-80')}>
            <option value="">Select a school…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <p className={labelClass}>Send to</p>
        <div role="radiogroup" aria-label="Audience" className="inline-flex rounded-xl border border-gray-200 dark:border-white/10 p-1 gap-1">
          {modes.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={activeMode === m} onClick={() => setMode(m)}
              className={clsx('px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer', activeMode === m ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5')}>
              {modeLabel[m]}
            </button>
          ))}
        </div>
      </div>
      {activeMode === 'COHORT' && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-white/10">
            <Search size={14} className="text-slate-400" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter programmes…" aria-label="Filter programmes" className="flex-1 bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{selected.length} selected</span>
          </div>
          <ul className="max-h-56 overflow-y-auto p-1.5">
            {cohorts.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="rounded border-gray-300 dark:border-white/20" />
                  <span className="text-slate-900 dark:text-slate-100">{c.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{c.year}</span>
                </label>
              </li>
            ))}
            {!cohorts.length && <li className="px-2.5 py-3 text-sm text-slate-500 dark:text-slate-400">No programmes match.</li>}
          </ul>
        </div>
      )}
      {activeMode === 'SCHOOL' && (
        <p className="text-sm text-slate-600 dark:text-slate-400">Every approved student at {options?.school?.name ?? 'the school'} receives it.</p>
      )}
      {clashes.length > 0 && (
        <div role="status" className="flex gap-2 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {clashes.length === 1 ? 'A campaign that reaches' : `${clashes.length} campaigns that reach`} some of these delegates {clashes.length === 1 ? 'is' : 'are'} already open:{' '}
            {clashes.slice(0, 3).map((r) => `"${r.title}" (until ${formatDay(r.closesAt)})`).join(', ')}. Sending another means they are asked twice.
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        {showHeader && (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Feedback</p>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white mt-1">Request Feedback</h1>
          </>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
          Invite delegates to share their perspective. The audience is fixed when you send, responses are anonymous to all staff, and each campaign closes on the date you choose.
        </p>
        {scopeLine && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{scopeLine}</p>}
      </div>

      <section className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-950 dark:text-white mb-4">New campaign</h2>
        {isSuperAdmin && !schoolId ? (
          <div className="space-y-3">{audiencePicker}</div>
        ) : !options ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : !options.canSend ? (
          <div className="space-y-3">
            {isSuperAdmin && audiencePicker}
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Lock size={14} /> {options.reason}</p>
          </div>
        ) : activeMode === 'STUDENT' ? (
          <div className="space-y-5">{audiencePicker}<OneStudentRequest cohortId={cohortId} /></div>
        ) : (
          <CampaignComposer target={target} audience={audiencePicker} onSent={() => { setSelected(cohortId ? [cohortId] : []); refetch({ silent: true }); }} />
        )}
      </section>

      {(user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUB_ADMIN' || (isSuperAdmin && !!schoolId)) && (
        <AutomaticQuestionsSection key={schoolId} schoolId={isSuperAdmin ? schoolId : undefined} />
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Campaigns</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {user?.role === 'LECTURER' || user?.role === 'CLIENT_EXPERIENCE_MANAGER'
            ? 'Campaigns you sent, plus any that reached your programmes (view only).'
            : 'Every campaign sent at your school.'}
        </p>
        <div className="glass-card px-6">
          <CampaignHistory requests={requests ?? null} onChanged={() => refetch({ silent: true })} />
        </div>
      </section>
    </div>
  );
}

// ─── A school's own feedback questions (09-27, Executive Education, school admins) ──────────

const MAX_SCHOOL_QUESTIONS = 8;

/** One editable list of 1–5 questions (wording and order only — the type is fixed). */
function QuestionListEditor({ title, help, initial, saveTo, schoolId }: {
  title: string; help: string; initial: SchoolQuestion[]; saveTo: 'session' | 'course_end'; schoolId?: string;
}) {
  const [items, setItems] = useState<SchoolQuestion[]>(initial);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const { mutate: put, loading } = useMutation<FeedbackQuestionSets>('put');
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);
  const valid = items.every((q) => q.prompt.trim() && q.prompt.trim().length <= 300);
  const move = (i: number, d: -1 | 1) => setItems((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const next = [...xs];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  });

  const save = async () => {
    setStatus(null);
    try {
      const r = await put(`/feedback/question-sets/${saveTo}${schoolId ? `?schoolId=${schoolId}` : ''}`, { questions: items.map((q) => ({ id: q.id, prompt: q.prompt.trim() })) } as never);
      if (r) setItems(saveTo === 'session' ? r.session : r.courseEnd);
      setStatus({ tone: 'ok', text: 'Saved. Applies from now on — anything already sent keeps its questions.' });
    } catch (e) {
      setStatus({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{help}</p>
      </div>
      {items.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No questions yet.</p>}
      <ol className="space-y-2">
        {items.map((q, i) => (
          <li key={q.id ?? `new-${i}`} className="flex items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-slate-400 w-6">{String(i + 1).padStart(2, '0')}</span>
            <input aria-label={`${title} — question ${i + 1}`} className={fieldClass} maxLength={300} value={q.prompt}
              placeholder="e.g. The pace of the session was right for me"
              onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
            <span className="hidden sm:inline shrink-0 text-xs text-slate-500 dark:text-slate-400 tabular-nums">1–5</span>
            <button type="button" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"><ChevronDown size={14} className="rotate-180" /></button>
            <button type="button" aria-label={`Move question ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"><ChevronDown size={14} /></button>
            <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-3">
        {items.length < MAX_SCHOOL_QUESTIONS ? (
          <button type="button" onClick={() => setItems((xs) => [...xs, { prompt: '' }])} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer"><Plus size={15} /> Add a question</button>
        ) : <span className="text-xs text-slate-500 dark:text-slate-400">{MAX_SCHOOL_QUESTIONS} questions maximum</span>}
        <button type="button" onClick={() => void save()} disabled={!dirty || !valid || loading}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
      {status && <p role="status" className={clsx('text-sm', status.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{status.text}</p>}
    </div>
  );
}

/**
 * "Automatic feedback questions" — school admins (and SUPER_ADMIN for a chosen school) at an
 * Executive Education school. Renders nothing elsewhere (the API refuses non-exec schools).
 */
export function AutomaticQuestionsSection({ schoolId }: { schoolId?: string }) {
  const { data, error } = useApi<FeedbackQuestionSets>(`/feedback/question-sets${schoolId ? `?schoolId=${schoolId}` : ''}`);
  if (error || !data) return null;
  return (
    <section className="glass-card p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Automatic feedback questions</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
          Your school's own questions, each rated 1–5 on a slider. Sent automatically — nobody has to press send. Responses are anonymous and results appear from 3 responses.
        </p>
      </div>
      <QuestionListEditor key={`s-${data.updatedAt}`} title="After every session" saveTo="session" schoolId={schoolId} initial={data.session}
        help="Added after the standard session questions (overall, facilitator, relevance, what stood out). Averages show in Feedback Intelligence. Delegates see them once they update the app." />
      <div className="border-t border-gray-100 dark:border-white/10" />
      <QuestionListEditor key={`c-${data.updatedAt}`} title="When a course ends" saveTo="course_end" schoolId={schoolId} initial={data.courseEnd}
        help="Sent to everyone enrolled once the course's last session has ended, open for 7 days with one reminder. Results appear under Campaigns below. Leave empty to send nothing." />
    </section>
  );
}
