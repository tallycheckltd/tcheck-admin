import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, FileDown, Lock, Table2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import type { FeedbackIntelligence, FeedbackRequest, FollowUpsReport, OverviewReport, ProgrammeReport, School, SessionReport } from '../../types';
import { overviewCsv, overviewPdf, periodLabel, programmeCsv, programmePdf } from '../../lib/reportsExport';
import { OverviewView, ProgrammeView, SessionView } from '../../components/insights/OverviewTab';
import { FeedbackView } from '../../components/insights/FeedbackTab';
import { FollowUpsView } from '../../components/insights/FollowUpsTab';

/**
 * Insights (09-27: Executive Reports + Feedback Intelligence merged into one page).
 *   Overview — the management summary (attendance, punctuality, check-out, feedback headline,
 *              what needs attention, programmes, weeks, missing check-outs), with programme and
 *              session drill-downs and CSV/PDF export.
 *   Feedback — how delegates rate sessions: scores, weeks, per course, your school's questions,
 *              comments and campaigns.
 *   Follow-ups — who didn't attend which session (missed / no check-out), patterns first, with
 *              Message / Email to reach out (owner 09-28: delegates are never emailed about it).
 * One set of filters (school for SUPER_ADMIN, period) drives both; everything lives in the URL so
 * back/forward and shared links keep the view. Both are role-scoped server-side.
 */

type TabKey = 'overview' | 'feedback' | 'followups';
const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const PRESETS = [
  { key: 'week', label: 'This week', range: () => { const t = new Date(); return [localYmd(addDays(t, -((t.getDay() + 6) % 7))), localYmd(t)]; } },
  { key: 'month', label: 'This month', range: () => { const t = new Date(); return [localYmd(new Date(t.getFullYear(), t.getMonth(), 1)), localYmd(t)]; } },
  { key: '30', label: 'Last 30 days', range: () => { const t = new Date(); return [localYmd(addDays(t, -29)), localYmd(t)]; } },
  { key: '90', label: 'Last 90 days', range: () => { const t = new Date(); return [localYmd(addDays(t, -89)), localYmd(t)]; } },
  { key: '365', label: 'Last 12 months', range: () => { const t = new Date(); return [localYmd(addDays(t, -364)), localYmd(t)]; } },
] as const;
const ROSTER_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LECTURER'];
const CAMPAIGN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LECTURER', 'CLIENT_EXPERIENCE_MANAGER'];
/** Roles with the /messages page, so Follow-ups can open a conversation (others get Email only). */
const MESSAGE_ROLES = ['LECTURER', 'CLIENT_EXPERIENCE_MANAGER'];
const exportBtn = 'inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 cursor-pointer';
const selectCls = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white';

function ExportButtons({ onCsv, onPdf }: { onCsv: () => void; onPdf: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <button type="button" className={exportBtn} onClick={onCsv}><Table2 size={15} /> CSV</button>
      <button type="button" className={exportBtn} disabled={busy} onClick={async () => { setBusy(true); try { await onPdf(); } finally { setBusy(false); } }}>
        <FileDown size={15} /> {busy ? 'Preparing…' : 'PDF briefing'}
      </button>
    </div>
  );
}

export function InsightsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: TabKey = tabParam === 'feedback' || tabParam === 'followups' ? tabParam : 'overview';
  const [defFrom, defTo] = PRESETS[2].range();
  const from = params.get('from') ?? defFrom;
  const to = params.get('to') ?? defTo;
  const schoolId = params.get('school') ?? '';
  const programmeId = params.get('programme');
  const sessionId = params.get('session');
  const courseId = params.get('course') ?? '';
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) if (v == null || v === '') next.delete(k); else next.set(k, v);
    setParams(next);
  };

  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const canQuery = !isSuperAdmin || !!schoolId;
  const rangeValid = from <= to;
  const days = Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1;
  const base = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (isSuperAdmin && schoolId) p.set('schoolId', schoolId);
    return p;
  }, [from, to, schoolId, isSuperAdmin]);

  const onOverview = tab === 'overview';
  const overview = useApi<OverviewReport>(onOverview && canQuery && rangeValid && !programmeId && !sessionId ? `/reports/overview?${base}` : null);
  const programme = useApi<ProgrammeReport>(onOverview && canQuery && rangeValid && programmeId && !sessionId ? `/reports/programmes/${programmeId}?${base}` : null);
  const session = useApi<SessionReport>(onOverview && canQuery && sessionId ? `/reports/sessions/${sessionId}${isSuperAdmin && schoolId ? `?schoolId=${schoolId}` : ''}` : null);
  const fbQs = useMemo(() => { const p = new URLSearchParams(base); if (courseId) p.set('courseId', courseId); return p.toString(); }, [base, courseId]);
  const onFeedbackTab = tab === 'feedback';
  const feedback = useApi<FeedbackIntelligence>(onFeedbackTab && canQuery && rangeValid ? `/feedback/intelligence?${fbQs}` : null);
  const followUps = useApi<FollowUpsReport>(tab === 'followups' && canQuery && rangeValid ? `/reports/follow-ups?${base}` : null);
  const campaigns = useApi<FeedbackRequest[]>(onFeedbackTab && CAMPAIGN_ROLES.includes(user?.role ?? '') ? '/feedback-requests' : null);

  // The feedback course filter lists every course seen unfiltered, so picking one doesn't shrink it.
  const [knownCourses, setKnownCourses] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (feedback.data && !courseId) setKnownCourses(feedback.data.courses.map((c) => ({ id: c.courseId, label: `${c.code} — ${c.name}` })));
  }, [feedback.data, courseId]);

  const scopeLabel = isSuperAdmin
    ? schools?.find((s) => s.id === schoolId)?.name ?? 'Selected school'
    : user?.role === 'LECTURER' ? 'Your sessions'
      : user?.role === 'CLIENT_EXPERIENCE_MANAGER' ? 'Your programmes'
        : user?.school?.name ?? 'Your school';
  const activePreset = PRESETS.find((p) => { const [f, t] = p.range(); return f === from && t === to; })?.key ?? 'custom';
  const current = tab === 'followups' ? followUps : onFeedbackTab ? feedback : sessionId ? session : programmeId ? programme : overview;
  const scopedCampaigns = campaigns.data?.filter((c) => !isSuperAdmin || !schoolId || c.school.id === schoolId) ?? null;

  const tabs: { key: TabKey; label: string }[] = [{ key: 'overview', label: 'Overview' }, { key: 'feedback', label: 'Feedback' }, { key: 'followups', label: 'Follow-ups' }];

  return (
    <div className="space-y-6 max-w-7xl">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Insights</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {scopeLabel}{!sessionId ? ` · ${periodLabel({ from, to })}` : ''}
          </p>
        </div>
        {onOverview && !sessionId && canQuery && (
          programmeId && programme.data ? <ExportButtons onCsv={() => programmeCsv(programme.data!)} onPdf={() => programmePdf(programme.data!, scopeLabel)} />
            : !programmeId && overview.data ? <ExportButtons onCsv={() => overviewCsv(overview.data!, scopeLabel)} onPdf={() => overviewPdf(overview.data!, scopeLabel)} />
              : null
        )}
      </header>

      <GlassCard className="!p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Insights" className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} type="button"
                onClick={() => set({ tab: t.key === 'overview' ? null : t.key, programme: null, session: null })}
                className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer', tab === t.key ? 'bg-white dark:bg-white/15 text-slate-950 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400')}>
                {t.label}
              </button>
            ))}
          </div>
          {isSuperAdmin && (
            <select aria-label="Institution" value={schoolId} onChange={(e) => { set({ school: e.target.value, programme: null, session: null, course: null }); setKnownCourses([]); }} className={selectCls}>
              <option value="">Select an institution…</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {!sessionId && (
            <>
              <select aria-label="Period" value={activePreset} onChange={(e) => { const p = PRESETS.find((x) => x.key === e.target.value); if (p) { const [f, t] = p.range(); set({ from: f, to: t }); } }} className={selectCls}>
                {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                <option value="custom" disabled>Custom range</option>
              </select>
              <input aria-label="From" type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} className={selectCls} />
              <input aria-label="To" type="date" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} className={selectCls} />
            </>
          )}
          {onFeedbackTab && knownCourses.length > 1 && (
            <select aria-label="Course" value={courseId} onChange={(e) => set({ course: e.target.value })} className={clsx(selectCls, 'max-w-[16rem]')}>
              <option value="">All courses</option>
              {knownCourses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
          {tab !== 'followups' && <p className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Lock size={11} /> Feedback is anonymous · withheld below 3 responses</p>}
        </div>
      </GlassCard>

      {onOverview && (programmeId || sessionId) && (
        <nav aria-label="Report level" className="flex items-center gap-1.5 text-sm">
          <button type="button" onClick={() => set({ programme: null, session: null })} className="text-blue-600 dark:text-blue-400 cursor-pointer">Overview</button>
          {programmeId && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <button type="button" onClick={() => set({ session: null })} className={clsx(sessionId ? 'text-blue-600 dark:text-blue-400 cursor-pointer' : 'text-slate-700 dark:text-slate-300')}>
                {programme.data?.programme.name ?? 'Programme'}
              </button>
            </>
          )}
          {sessionId && (<><ChevronRight size={14} className="text-slate-400" /><span className="text-slate-700 dark:text-slate-300">{session.data?.session.title ?? 'Session'}</span></>)}
        </nav>
      )}

      {!canQuery ? (
        <GlassCard><p className="text-sm text-slate-600 dark:text-slate-400">Select an institution to see its insights.</p></GlassCard>
      ) : !rangeValid && !sessionId ? (
        <GlassCard><p role="alert" className="text-sm text-amber-700 dark:text-amber-300">The start date must be on or before the end date.</p></GlassCard>
      ) : current.error ? (
        <GlassCard><p role="alert" className="text-sm text-red-700 dark:text-red-300">This couldn't be loaded. {current.error}</p></GlassCard>
      ) : !current.data ? (
        <GlassCard><p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p></GlassCard>
      ) : tab === 'followups' && followUps.data ? (
        <FollowUpsView r={followUps.data} scopeLabel={scopeLabel} canMessage={MESSAGE_ROLES.includes(user?.role ?? '')} />
      ) : onFeedbackTab && feedback.data ? (
        <FeedbackView data={feedback.data} days={days} campaigns={scopedCampaigns}
          canCreateCampaign={['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(user?.role ?? '')}
          onCampaignsChanged={() => campaigns.refetch({ silent: true })} />
      ) : sessionId && session.data ? (
        <SessionView r={session.data} canSeeRoster={ROSTER_ROLES.includes(user?.role ?? '')} />
      ) : programmeId && programme.data ? (
        <ProgrammeView r={programme.data} scopeLabel={scopeLabel} onSession={(id) => set({ session: id })} onFeedback={() => set({ tab: 'feedback', programme: null, session: null })} />
      ) : overview.data ? (
        <OverviewView r={overview.data} scopeLabel={scopeLabel} onProgramme={(id) => set({ programme: id })} onSession={(id) => set({ session: id })}
          onFeedback={() => set({ tab: 'feedback' })} />
      ) : null}
    </div>
  );
}

/** Old addresses (Executive Reports / Feedback Intelligence) keep working: they land on the right tab. */
export function LegacyInsightsRedirect({ tab }: { tab: TabKey }) {
  const { search } = useLocation();
  const p = new URLSearchParams(search);
  if (tab === 'feedback') p.set('tab', 'feedback');
  const qs = p.toString();
  return <Navigate to={`/insights${qs ? `?${qs}` : ''}`} replace />;
}
