import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, GraduationCap, Undo2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';

/**
 * SBS (Hans, 2026-11-05) — a programme's Completion tab. Every delegate against the school's
 * attendance threshold (80% by default). The CEM approves those who passed; each approved
 * delegate gets one thank-you email. Server: /cem/programmes/:id/completion (cemProgrammes.service).
 */

type State = 'COMPLETED' | 'ELIGIBLE' | 'ON_TRACK' | 'AT_RISK' | 'CANNOT_REACH' | 'NO_SESSIONS';
interface Row { id: string; firstName: string; lastName: string; email: string; company: string | null; attended: number; held: number; total: number; rate: number | null; state: State; completedAt: string | null }
interface Data {
  programme: { id: string; name: string };
  threshold: number;
  sessions: { total: number; held: number; finished: boolean };
  delegates: Row[];
  summary: { completed: number; eligible: number; onTrack: number; atRisk: number; cannotReach: number };
}

const STYLE: Record<State, string> = {
  COMPLETED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  ELIGIBLE: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
  ON_TRACK: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  AT_RISK: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  CANNOT_REACH: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  NO_SESSIONS: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
};
const label = (s: State, threshold: number, finished: boolean) => ({
  COMPLETED: 'Completed',
  ELIGIBLE: 'Passed',
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  CANNOT_REACH: finished ? `Below ${threshold}%` : `Can't reach ${threshold}%`,
  NO_SESSIONS: 'No sessions yet',
}[s]);

const ORDER: State[] = ['ELIGIBLE', 'AT_RISK', 'CANNOT_REACH', 'ON_TRACK', 'COMPLETED', 'NO_SESSIONS'];

export function CemCompletionPage() {
  const { cohortId = '' } = useParams<{ cohortId: string }>();
  const fromState = useLocation().state;
  const { data, loading, error, refetch } = useApi<Data>(`/cem/programmes/${cohortId}/completion`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [fail, setFail] = useState('');
  const [filter, setFilter] = useState<State | 'ALL'>('ALL');

  const rows = useMemo(() => {
    const all = [...(data?.delegates ?? [])].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.lastName.localeCompare(b.lastName));
    return filter === 'ALL' ? all : all.filter((r) => r.state === filter);
  }, [data, filter]);
  const passed = (data?.delegates ?? []).filter((d) => d.state === 'ELIGIBLE');

  const approve = async (ids: string[]) => {
    setBusy(true); setNote(''); setFail('');
    try {
      const r = await api.post<{ approved: string[]; skipped: { id: string; reason: string }[] }>(`/cem/programmes/${cohortId}/completion`, { userIds: ids });
      setNote(`${r.approved.length} approved. Each will get a thank-you email.${r.skipped.length ? ` ${r.skipped.length} skipped: ${r.skipped[0].reason.toLowerCase()}.` : ''}`);
      refetch();
    } catch (e) {
      setFail(e instanceof Error ? e.message : 'Could not approve');
    } finally {
      setBusy(false);
    }
  };
  const undo = async (r: Row) => {
    setBusy(true); setNote(''); setFail('');
    try {
      await api.post(`/cem/programmes/${cohortId}/completion/undo`, { userId: r.id });
      setNote(`${r.firstName} ${r.lastName} is no longer marked as completed. Their thank-you email, if sent, is not recalled.`);
      refetch();
    } catch (e) {
      setFail(e instanceof Error ? e.message : 'Could not undo');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (error || !data) return <p className="text-sm text-red-600 dark:text-red-400">This programme couldn't be loaded.</p>;
  const t = data.threshold;
  const chips: { key: State | 'ALL'; text: string; n: number }[] = [
    { key: 'ALL', text: 'Everyone', n: data.delegates.length },
    { key: 'ELIGIBLE', text: 'Passed', n: data.summary.eligible },
    { key: 'AT_RISK', text: 'At risk', n: data.summary.atRisk },
    { key: 'CANNOT_REACH', text: data.sessions.finished ? `Below ${t}%` : `Can't reach ${t}%`, n: data.summary.cannotReach },
    { key: 'ON_TRACK', text: 'On track', n: data.summary.onTrack },
    { key: 'COMPLETED', text: 'Completed', n: data.summary.completed },
  ];

  return (
    <div className="space-y-6">
      <Link to={`/cem/cohorts/${cohortId}`} state={fromState} className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
        <ArrowLeft size={14} /> Back to {data.programme.name}
      </Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><GraduationCap size={22} className="text-blue-500" /> Completion</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Delegates who attend at least {t}% of the programme's sessions can be approved for completion. Each approved delegate gets a thank-you email.
            {' '}{data.sessions.finished ? `All ${data.sessions.total} sessions have taken place.` : `${data.sessions.held} of ${data.sessions.total} sessions have taken place.`}
          </p>
        </div>
        <Button onClick={() => approve(passed.map((p) => p.id))} disabled={busy || !passed.length}>
          {passed.length ? `Approve ${passed.length} who passed` : data.summary.completed ? 'Everyone who passed is approved' : 'Nobody has passed yet'}
        </Button>
      </div>

      {note && <p role="status" className="text-sm text-green-700 dark:text-green-400">{note}</p>}
      {fail && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{fail}</p>}

      <div className="flex gap-2 flex-wrap">
        {chips.map((c) => (
          <button key={c.key} onClick={() => setFilter(c.key)} aria-pressed={filter === c.key}
            className={clsx('px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer border', filter === c.key ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5')}>
            {c.text} <span className="opacity-70">{c.n}</span>
          </button>
        ))}
      </div>

      <section className="glass-card p-2 sm:p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">{data.delegates.length ? 'Nobody here.' : 'No delegates in this programme yet.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {rows.map((r) => {
              const pct = r.total ? Math.round((r.attended / r.total) * 100) : 0;
              return (
                <li key={r.id} className="flex items-center gap-3 px-2 py-3 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{r.firstName} {r.lastName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.company ?? r.email}</p>
                  </div>
                  <div className="w-full sm:w-56 order-3 sm:order-none">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>{r.attended} of {r.total} sessions</span>
                      <span>{r.rate === null ? '—' : data.sessions.finished ? `${r.rate}%` : `${r.rate}% so far`}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" aria-label={`${pct}% of all sessions attended`}>
                      <div className={clsx('h-full rounded-full', pct >= t ? 'bg-green-500' : 'bg-blue-500')} style={{ width: `${Math.min(100, pct)}%` }} />
                      <div className="absolute top-0 bottom-0 w-px bg-gray-500/60" style={{ left: `${t}%` }} title={`${t}% needed`} />
                    </div>
                  </div>
                  <span className={clsx('text-xs font-medium px-2 py-1 rounded-full shrink-0 w-28 text-center', STYLE[r.state])}>{label(r.state, t, data.sessions.finished)}</span>
                  <div className="w-24 text-right shrink-0">
                    {r.state === 'ELIGIBLE' && <Button size="sm" onClick={() => approve([r.id])} disabled={busy}>Approve</Button>}
                    {r.state === 'COMPLETED' && (
                      <button onClick={() => undo(r)} disabled={busy} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 cursor-pointer">
                        <Undo2 size={12} /> Undo
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
