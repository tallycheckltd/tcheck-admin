import { useState } from 'react';
import { clsx } from 'clsx';
import { MessageSquareHeart } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { FeedbackIntelligence } from '../../types';
import { FeedbackView } from '../../components/insights/FeedbackTab';
import { Card, Empty } from '../../components/insights/InsightsUi';

/**
 * SBS (Hans, 2026-11-05) — programme feedback for CEMs and the Head of CEM: NPS and session
 * ratings per programme, then Insights' own feedback detail (by module, by week, the school's
 * questions, comments) for the programmes chosen. Anonymous; scores withheld below the minimum.
 * Server: GET /cem/feedback (cemFeedback.service).
 */

interface Scores {
  responses: number; eligible: number; responseRate: number | null; withheld: boolean;
  nps: number | null; promoters: number | null; passives: number | null; detractors: number | null;
  overall: number | null; facilitator: number | null; relevance: number | null;
}
interface Data {
  minResponses: number;
  cems: { id: string; name: string }[];
  programmesToPick: { id: string; name: string }[];
  summary: Scores;
  programmes: (Scores & { id: string; name: string; cem: { id: string; name: string } | null })[];
  detail: FeedbackIntelligence;
}

const PERIODS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 3 months', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];
const startOf = (key: string) => new Date(Date.now() - PERIODS.find((x) => x.key === key)!.days * 86_400_000).toISOString().slice(0, 10);
const one = (n: number | null) => (n == null ? '—' : n.toFixed(1));
const npsTone = (n: number | null) => (n == null ? 'text-gray-400' : n >= 30 ? 'text-green-600 dark:text-green-400' : n >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400');
const rate = (r: number | null) => (r == null ? '—' : `${r}%`);

function NpsCard({ s, min }: { s: Scores; min: number }) {
  return (
    <Card title="Net Promoter Score" subtitle="% who scored a session 9–10, minus % who scored 0–6">
      {s.withheld ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{s.responses ? `Only ${s.responses} response${s.responses === 1 ? '' : 's'} so far.` : 'No responses yet.'} Scores appear from {min} responses, so no one can be identified.</p>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="shrink-0">
            <p className={clsx('text-5xl font-bold tabular-nums', npsTone(s.nps))}>{s.nps! > 0 ? `+${s.nps}` : s.nps}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.responses} of {s.eligible} sessions rated · {rate(s.responseRate)}</p>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10" aria-label={`Promoters ${s.promoters}%, passives ${s.passives}%, detractors ${s.detractors}%`}>
              <div className="bg-green-500" style={{ width: `${s.promoters}%` }} />
              <div className="bg-gray-300 dark:bg-white/25" style={{ width: `${s.passives}%` }} />
              <div className="bg-red-500" style={{ width: `${s.detractors}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Promoters {s.promoters}%</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-white/25" /> Passives {s.passives}%</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Detractors {s.detractors}%</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function CemFeedbackPage() {
  const { user } = useAuth();
  const isCem = user?.role === 'CLIENT_EXPERIENCE_MANAGER';
  const [period, setPeriodKey] = useState<PeriodKey>('90');
  const [from, setFrom] = useState(() => startOf('90'));
  const setPeriod = (key: PeriodKey) => { setPeriodKey(key); setFrom(startOf(key)); };
  const [cemId, setCemId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const qs = new URLSearchParams({ from, ...(cemId ? { cemId } : {}), ...(cohortId ? { cohortId } : {}) });
  const { data, loading, error } = useApi<Data>(`/cem/feedback?${qs}`);
  const days = PERIODS.find((p) => p.key === period)!.days;
  const showCem = !!data?.cems.length && !cemId;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><MessageSquareHeart size={22} className="text-blue-500" /> Programme feedback</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            How delegates rate {isCem ? 'your' : 'your team\'s'} programmes after each session. Anonymous; scores show from {data?.minResponses ?? 3} responses.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5 text-sm">
          {PERIODS.map((x) => (
            <button key={x.key} onClick={() => setPeriod(x.key)} aria-pressed={period === x.key}
              className={clsx('px-3 py-1.5 rounded-lg font-medium cursor-pointer', period === x.key ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400')}>{x.label}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {!!data?.cems.length && (
          <select value={cemId} onChange={(e) => { setCemId(e.target.value); setCohortId(''); }} aria-label="CEM"
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-sm">
            <option value="">All CEMs</option>
            {data.cems.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {!!data?.programmesToPick.length && (
          <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} aria-label="Programme"
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-sm max-w-xs">
            <option value="">All programmes</option>
            {data.programmesToPick.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading && !data ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        : error || !data ? <p className="text-sm text-red-600 dark:text-red-400">Feedback couldn't be loaded.</p>
          : (
            <>
              <NpsCard s={data.summary} min={data.minResponses} />

              {!cohortId && (
                <Card title="By programme" subtitle="Session feedback from each programme's delegates in this period · select one to see its detail">
                  {data.programmes.length === 0 ? <Empty title="No sessions in this period" /> : (
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                          <tr>
                            <th className="p-2">Programme</th>
                            {showCem && <th className="p-2">CEM</th>}
                            <th className="p-2 text-right">NPS</th>
                            <th className="p-2 text-right">Overall</th>
                            <th className="p-2 text-right">Facilitator</th>
                            <th className="p-2 text-right">Relevance</th>
                            <th className="p-2 text-right">Responses</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.programmes.map((p) => (
                            <tr key={p.id} onClick={() => setCohortId(p.id)} className="border-t border-gray-100 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                              <td className="p-2 font-medium text-gray-900 dark:text-white">{p.name}</td>
                              {showCem && <td className="p-2 text-gray-600 dark:text-gray-300">{p.cem?.name ?? '—'}</td>}
                              <td className={clsx('p-2 text-right font-semibold tabular-nums', npsTone(p.nps))}>{p.responses === 0 ? <span className="text-xs font-normal text-gray-400">No responses yet</span> : p.withheld ? 'Withheld' : p.nps}</td>
                              <td className="p-2 text-right tabular-nums">{p.withheld ? '—' : `${one(p.overall)} / 10`}</td>
                              <td className="p-2 text-right tabular-nums">{p.withheld || p.facilitator == null ? '—' : `${one(p.facilitator)} / 10`}</td>
                              <td className="p-2 text-right tabular-nums">{p.withheld || p.relevance == null ? '—' : `${one(p.relevance)} / 5`}</td>
                              <td className="p-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{p.responses}/{p.eligible} · {rate(p.responseRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}

              <FeedbackView data={data.detail} days={days} campaigns={null} canCreateCampaign={false} onCampaignsChanged={() => undefined} />
            </>
          )}
    </div>
  );
}
