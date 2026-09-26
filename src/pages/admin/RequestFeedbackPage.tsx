import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { CampaignComposer, CampaignHistory } from '../../components/feedback/FeedbackCampaigns';
import type { School, Major, Cohort, FeedbackRequest } from '../../types';

/**
 * Cohort-wide feedback campaigns (SBS Phase 5: multi-question, frozen audience, close date,
 * anonymous results — see components/feedback/FeedbackCampaigns.tsx) — the admin-tier counterpart of StaffViewPage's
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

  const [targetSchoolId, setTargetSchoolId] = useState<string>(isSuperAdmin ? '' : (user?.schoolId ?? ''));
  const [targetMajorId, setTargetMajorId] = useState<string>('');
  const [targetCohortId, setTargetCohortId] = useState<string>('');

  const { data: majors } = useApi<Major[]>(targetSchoolId ? `/academic/majors?schoolId=${targetSchoolId}` : null);
  // The major filter narrows which cohorts show up below — resolved server-side through
  // CourseCohort + CourseMajor (see academic.service.ts's listCohorts), since Cohort has no
  // direct Major link in the schema.
  const { data: cohortsData } = useApi<Cohort[]>(
    targetSchoolId ? `/academic/cohorts?schoolId=${targetSchoolId}${targetMajorId ? `&majorId=${targetMajorId}` : ''}` : null,
  );
  const cohorts = cohortsData ?? [];
  const selectClass = 'w-full rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white disabled:opacity-50';

  const audience = (
    <div className="grid gap-3 grid-cols-1 sm:col-span-1">
      {isSuperAdmin && (
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="campaign-school">School</label>
          <select id="campaign-school" value={targetSchoolId} onChange={(e) => { setTargetSchoolId(e.target.value); setTargetMajorId(''); setTargetCohortId(''); }} className={selectClass}>
            <option value="">Select a school…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="campaign-programme">Programme filter</label>
          <select id="campaign-programme" value={targetMajorId} onChange={(e) => { setTargetMajorId(e.target.value); setTargetCohortId(''); }} disabled={!targetSchoolId} className={selectClass}>
            <option value="">All programmes</option>
            {majors?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="campaign-cohort">Cohort</label>
          <select id="campaign-cohort" value={targetCohortId} onChange={(e) => setTargetCohortId(e.target.value)} disabled={!targetSchoolId} className={selectClass}>
            <option value="">Select a cohort…</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Feedback</p>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white mt-1">Feedback campaigns</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
          Invite a cohort to share their perspective. The audience is fixed when you send, responses are anonymous to all staff, and each campaign closes on the date you choose.
        </p>
      </div>

      <section className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-950 dark:text-white mb-4">New campaign</h2>
        <CampaignComposer cohortId={targetCohortId} audience={audience} onSent={() => { setTargetCohortId(''); refetch({ silent: true }); }} />
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Campaigns</h2>
        <div className="glass-card px-6">
          <CampaignHistory requests={sent} onChanged={() => refetch({ silent: true })} />
        </div>
      </section>
    </div>
  );
}
