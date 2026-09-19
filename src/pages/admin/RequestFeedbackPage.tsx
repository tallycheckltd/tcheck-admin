import { useState } from 'react';
import { Star, Send, CheckCircle, ChevronDown, Users2 } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { School, Major, Cohort, FeedbackRequest, FeedbackRequestResults } from '../../types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Cohort-wide "Request Feedback" survey composer — the admin-tier counterpart of StaffViewPage's
 * FeedbackRequestPanel (same /feedback-requests endpoints, LECTURER/CLIENT_EXPERIENCE_MANAGER use
 * that one from their Staff View instead). Mirrors SystemAnnouncementsPage's shape closely: a
 * school (SUPER_ADMIN only) narrows which cohorts are reachable, and the "faculty/major" filter
 * here is the "switch [program] to get that particular data" selector — it doesn't target
 * anything itself, it just narrows the cohort dropdown so a school with many programs' worth of
 * cohorts isn't one long flat list.
 */
export function RequestFeedbackPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: sent, refetch } = useApi<FeedbackRequest[]>('/feedback-requests');
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const { mutate: create, loading: sending } = useMutation<FeedbackRequest>('post');

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [targetSchoolId, setTargetSchoolId] = useState<string>(isSuperAdmin ? '' : (user?.schoolId ?? ''));
  const [targetMajorId, setTargetMajorId] = useState<string>('');
  const [targetCohortId, setTargetCohortId] = useState<string>('');
  const [sentMsg, setSentMsg] = useState('');
  const [error, setError] = useState('');
  const [openResultsId, setOpenResultsId] = useState<string | null>(null);

  const { data: majors } = useApi<Major[]>(targetSchoolId ? `/academic/majors?schoolId=${targetSchoolId}` : null);
  // The major filter narrows which cohorts show up below — resolved server-side through
  // CourseCohort + CourseMajor (see academic.service.ts's listCohorts), since Cohort has no
  // direct Major link in the schema.
  const { data: cohortsData } = useApi<Cohort[]>(
    targetSchoolId ? `/academic/cohorts?schoolId=${targetSchoolId}${targetMajorId ? `&majorId=${targetMajorId}` : ''}` : null,
  );
  const cohorts = cohortsData ?? [];

  const handleSend = async () => {
    if (!title.trim() || !prompt.trim() || !targetCohortId) return;
    setError('');
    try {
      const result = await create('/feedback-requests', { title: title.trim(), prompt: prompt.trim(), cohortId: targetCohortId });
      setTitle('');
      setPrompt('');
      setTargetCohortId('');
      setSentMsg(`Sent to ${result?.recipientCount ?? 0} student(s) — push, in-app and email.`);
      refetch();
      setTimeout(() => setSentMsg(''), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send feedback request');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Request Feedback</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Ask every student in a cohort a free-form question — sent on push, in-app and email with a link straight into the app's feedback popup.
        </p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Star size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">New Request</h2>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Title (e.g. Mid-program pulse check)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <textarea
            placeholder="What would you like to ask them?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">School</label>
              {isSuperAdmin ? (
                <select
                  value={targetSchoolId}
                  onChange={(e) => { setTargetSchoolId(e.target.value); setTargetMajorId(''); setTargetCohortId(''); }}
                  className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
                >
                  <option value="">Select a school…</option>
                  {schools?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                  Your school only
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Switch program (optional)</label>
              <select
                value={targetMajorId}
                onChange={(e) => { setTargetMajorId(e.target.value); setTargetCohortId(''); }}
                disabled={!targetSchoolId}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white disabled:opacity-50"
              >
                <option value="">All programs</option>
                {majors?.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cohort</label>
              <select
                value={targetCohortId}
                onChange={(e) => setTargetCohortId(e.target.value)}
                disabled={!targetSchoolId}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white disabled:opacity-50"
              >
                <option value="">Select a cohort…</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleSend}
              disabled={!title.trim() || !prompt.trim() || !targetCohortId || sending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {sentMsg ? (
                <><CheckCircle size={15} /> Sent!</>
              ) : (
                <><Send size={15} /> {sending ? 'Sending...' : 'Send to Cohort'}</>
              )}
            </button>
          </div>
          {sentMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-right">{sentMsg}</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">Request History</h2>
        <div className="space-y-3">
          {sent?.map((r) => (
            <div key={r.id} className="glass-card p-4 border-l-4 border-l-blue-500">
              <button className="w-full flex items-start justify-between gap-3 text-left cursor-pointer" onClick={() => setOpenResultsId(openResultsId === r.id ? null : r.id)}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex-shrink-0"><Star size={16} className="text-blue-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{r.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{r.prompt}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1"><Users2 size={10} /> {r.cohort.name} ({r.cohort.year})</span>
                      <span>· {timeAgo(r.createdAt)}</span>
                      <span>· Sent by {r.createdByName}</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{r.responseCount}/{r.recipientCount} responded</span>
                    </div>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openResultsId === r.id ? 'rotate-180' : ''}`} />
              </button>
              {openResultsId === r.id && <FeedbackRequestResultsPanel requestId={r.id} />}
            </div>
          ))}
          {sent?.length === 0 && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">No feedback requests sent yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackRequestResultsPanel({ requestId }: { requestId: string }) {
  const { data: results } = useApi<FeedbackRequestResults>(`/feedback-requests/${requestId}/results`);
  if (!results) return <p className="mt-3 text-xs text-slate-400">Loading…</p>;
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10 space-y-2">
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          Avg score: {results.avgScore == null ? '—' : results.avgScore.toFixed(1)}/10
        </span>
        <span className="text-slate-500 dark:text-slate-400">{results.responses.length} response(s)</span>
      </div>
      {results.responses.length === 0 ? (
        <p className="text-xs text-slate-400">No responses yet.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {results.responses.map((resp) => (
            <li key={resp.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">{resp.studentName}</span>
                <span className="px-1.5 py-0.5 rounded bg-white dark:bg-white/10 font-semibold text-slate-700 dark:text-slate-200">{resp.npsScore}/10</span>
              </div>
              {resp.comment && <p className="text-slate-500 dark:text-slate-400 mt-1">{resp.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
