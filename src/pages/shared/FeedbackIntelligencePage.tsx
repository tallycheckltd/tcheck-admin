import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { CampaignHistory, rateText } from '../../components/feedback/FeedbackCampaigns';
import type { FeedbackIntelligence, FeedbackPeriodSummary, FeedbackRequest, School } from '../../types';

/**
 * SBS Phase 5 — Feedback Intelligence. Session feedback, aggregated server-side and scoped by
 * role (lecturer: own sessions; CEM: assigned programmes; admin/leadership: school, dept-narrowed
 * for Dean/HOD). Anonymous: the API never returns who said what, and withholds any figure resting
 * on fewer than 3 responses. Every score here is shown with its sample size.
 */
const PERIODS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
] as const;

const CAMPAIGN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'SCHOOL_ADMIN', 'LECTURER', 'CLIENT_EXPERIENCE_MANAGER'];

function scopeTitle(role?: string): { title: string; subtitle: string } {
  if (role === 'LECTURER') return { title: 'Your sessions', subtitle: 'How delegates are experiencing the sessions you lead.' };
  if (role === 'CLIENT_EXPERIENCE_MANAGER') return { title: 'Programme experience', subtitle: 'How delegates are experiencing the programmes you look after.' };
  return { title: 'Executive Education experience', subtitle: 'How delegates are experiencing sessions across your school.' };
}

const fmt = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));

function Delta({ current, previous, periodLabel }: { current: number | null; previous: number | null; periodLabel: string }) {
  if (current == null || previous == null) return null;
  const d = Math.round((current - previous) * 10) / 10;
  const word = d > 0 ? 'up' : d < 0 ? 'down' : 'unchanged';
  const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '→';
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400">
      <span aria-hidden>{arrow} </span>
      {d === 0 ? 'Unchanged' : `${word === 'up' ? 'Up' : 'Down'} ${Math.abs(d).toFixed(1)}`} vs the {periodLabel.toLowerCase().replace('last ', 'previous ')}
    </p>
  );
}

function SampleLine({ p }: { p: FeedbackPeriodSummary }) {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
      {p.responses} response{p.responses === 1 ? '' : 's'} from {p.eligible} attended session{p.eligible === 1 ? '' : 's'} · {rateText(p.responseRate)} response rate
    </p>
  );
}

function Signal({ label, value, scale, answered, previous }: { label: string; value: number | null; scale: number; answered: number; previous: number | null }) {
  const trend = value != null && previous != null ? (value > previous ? '↑' : value < previous ? '↓' : '→') : '';
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{answered} answered</p>
      </div>
      <p className="text-xl font-semibold tabular-nums text-slate-950 dark:text-white">
        {fmt(value)}<span className="text-sm font-normal text-slate-400"> / {scale}</span>
        {trend && <span className="ml-2 text-sm font-normal text-slate-500" aria-label={trend === '↑' ? 'higher than previous period' : trend === '↓' ? 'lower than previous period' : 'same as previous period'}>{trend}</span>}
      </p>
    </div>
  );
}

export function FeedbackIntelligencePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]['key']>('30');
  const [courseId, setCourseId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const period = PERIODS.find((p) => p.key === periodKey)!;

  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const qs = useMemo(() => {
    // Calendar days (SBS Phase 6: sessions are grouped by their own scheduled day everywhere).
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const to = new Date();
    const from = new Date(to.getTime() - (period.days - 1) * 24 * 60 * 60 * 1000);
    const p = new URLSearchParams({ from: ymd(from), to: ymd(to) });
    if (courseId) p.set('courseId', courseId);
    if (isSuperAdmin && schoolId) p.set('schoolId', schoolId);
    return p.toString();
    // Recomputed only when a filter changes, so the request isn't re-issued on every render.
  }, [period.days, courseId, schoolId, isSuperAdmin]);
  const canQuery = !isSuperAdmin || !!schoolId;
  const { data, loading, error } = useApi<FeedbackIntelligence>(canQuery ? `/feedback/intelligence?${qs}` : null);
  const { data: campaigns, refetch: refetchCampaigns } = useApi<FeedbackRequest[]>(
    CAMPAIGN_ROLES.includes(user?.role ?? '') ? '/feedback-requests' : null,
  );
  // The course filter lists every course that has had feedback in scope at all.
  // Captured from the unfiltered view, so choosing one course doesn't shrink the list to itself.
  const [knownCourses, setKnownCourses] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (data && !courseId) setKnownCourses(data.courses.map((c) => ({ id: c.courseId, label: `${c.code} — ${c.name}` })));
  }, [data, courseId]);

  const { title, subtitle } = scopeTitle(user?.role);
  const cur = data?.current;
  const prev = data?.previous;
  const hasData = !!cur && cur.responses > 0;
  const selectClass = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white';
  const scopedCampaigns = campaigns?.filter((c) => !isSuperAdmin || !schoolId || c.school.id === schoolId) ?? null;

  return (
    <div className="space-y-10 max-w-5xl">
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Feedback Intelligence</p>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white mt-1">{title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && (
            <select aria-label="School" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setCourseId(''); setKnownCourses([]); }} className={selectClass}>
              <option value="">Select a school…</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select aria-label="Period" value={periodKey} onChange={(e) => setPeriodKey(e.target.value as typeof periodKey)} className={selectClass}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {knownCourses.length > 1 && (
            <select aria-label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectClass}>
              <option value="">All courses</option>
              {knownCourses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 ml-auto">
            <Lock size={11} /> Anonymous · figures need at least {data?.minResponses ?? 3} responses
          </p>
        </div>
      </header>

      {!canQuery ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Select a school to see its feedback.</p>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">Feedback could not be loaded. {error}</div>
      ) : loading && !data ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading feedback…</p>
      ) : !hasData ? (
        <div className="py-12 text-center border-y border-gray-100 dark:border-white/10">
          <p className="text-base font-medium text-slate-800 dark:text-slate-200">No session feedback in this period</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Delegates are invited to give feedback as each session ends. Results appear here once responses arrive.
            {cur ? ` ${cur.eligible} attended session${cur.eligible === 1 ? '' : 's'} in this period.` : ''}
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="overall-heading" className="grid gap-8 md:grid-cols-[1fr_1.2fr] items-start">
            <div className="space-y-2">
              <h2 id="overall-heading" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Overall experience</h2>
              {cur!.overall.average == null ? (
                <p className="text-base text-slate-700 dark:text-slate-300 max-w-xs">
                  Not enough responses yet to show a score without singling anyone out.
                </p>
              ) : (
                <p className="text-6xl font-semibold tabular-nums text-slate-950 dark:text-white leading-none">
                  {fmt(cur!.overall.average)}<span className="text-2xl font-normal text-slate-400"> / 10</span>
                </p>
              )}
              <SampleLine p={cur!} />
              <Delta current={cur!.overall.average} previous={prev?.overall.average ?? null} periodLabel={period.label} />
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Experience signals</h2>
              <div className="divide-y divide-gray-100 dark:divide-white/10">
                <Signal label="Overall session" value={cur!.overall.average} scale={10} answered={cur!.overall.answered} previous={prev?.overall.average ?? null} />
                {cur!.facilitator.answered > 0 && <Signal label="Facilitator" value={cur!.facilitator.average} scale={10} answered={cur!.facilitator.answered} previous={prev?.facilitator.average ?? null} />}
                {cur!.relevance.answered > 0 && <Signal label="Relevance to delegates' roles" value={cur!.relevance.average} scale={5} answered={cur!.relevance.answered} previous={prev?.relevance.average ?? null} />}
              </div>
              {prev && prev.responses > 0 && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Arrows compare with the preceding period of the same length ({prev.responses} responses).</p>}
            </div>
          </section>

          {data!.trend.filter((t) => t.overall != null).length >= 2 && (
            <section aria-labelledby="trend-heading">
              <h2 id="trend-heading" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Week by week</h2>
              <ol className="flex flex-wrap gap-x-8 gap-y-3">
                {data!.trend.map((t) => (
                  <li key={t.weekStart}>
                    <p className="text-xs text-slate-500 dark:text-slate-400">w/c {new Date(t.weekStart).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
                    <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmt(t.overall)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{t.responses} resp.</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {data!.courses.length > 0 && (
            <section aria-labelledby="courses-heading">
              <h2 id="courses-heading" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">By course</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/10">
                      <th className="py-2 pr-4 font-medium">Course</th>
                      <th className="py-2 pr-4 font-medium text-right">Responses</th>
                      <th className="py-2 pr-4 font-medium text-right">Rate</th>
                      <th className="py-2 pr-4 font-medium text-right">Overall</th>
                      <th className="py-2 pr-4 font-medium text-right">Facilitator</th>
                      <th className="py-2 font-medium text-right">Relevance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                    {data!.courses.map((c) => (
                      <tr key={c.courseId}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{c.code}{c.facilitatorName ? ` · ${c.facilitatorName}` : ''}</p>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{c.responses} / {c.eligible}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{rateText(c.responseRate)}</td>
                        {c.withheld ? (
                          <td colSpan={3} className="py-3 text-right text-xs text-slate-500 dark:text-slate-400">Fewer than {data!.minResponses} responses — withheld</td>
                        ) : (
                          <>
                            <td className="py-3 pr-4 text-right tabular-nums font-semibold text-slate-950 dark:text-white">{fmt(c.overall)}</td>
                            <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{fmt(c.facilitator)}</td>
                            <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{c.relevance == null ? '—' : `${fmt(c.relevance)} / 5`}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-labelledby="voice-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="voice-heading" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">What delegates said</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{data!.comments.total} comment{data!.comments.total === 1 ? '' : 's'}</p>
            </div>
            {data!.comments.withheld ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Comments appear once at least {data!.minResponses} delegates have responded, so no remark can be traced to one person.</p>
            ) : data!.comments.items.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">No written comments in this period.</p>
            ) : (
              <>
                <ul className={clsx('mt-3 grid gap-x-10 gap-y-3', data!.comments.items.length > 4 && 'md:grid-cols-2')}>
                  {data!.comments.items.map((c, i) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300 border-l-2 border-slate-200 dark:border-white/15 pl-3 leading-relaxed">{c}</li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Unattributed and in alphabetical order{data!.comments.total > data!.comments.items.length ? ` · showing ${data!.comments.items.length} of the ${data!.comments.total} most recent` : ''}.
                </p>
              </>
            )}
          </section>
        </>
      )}

      {scopedCampaigns && scopedCampaigns.length > 0 && (
        <section aria-labelledby="campaigns-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="campaigns-heading" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Feedback campaigns</h2>
            {['SUPER_ADMIN', 'SUB_ADMIN', 'SCHOOL_ADMIN'].includes(user?.role ?? '') && (
              <Link to="/admin/request-feedback" className="text-xs font-medium text-blue-600 dark:text-blue-400">New campaign</Link>
            )}
          </div>
          <CampaignHistory requests={scopedCampaigns.slice(0, 10)} onChanged={() => refetchCampaigns({ silent: true })} />
        </section>
      )}
    </div>
  );
}
