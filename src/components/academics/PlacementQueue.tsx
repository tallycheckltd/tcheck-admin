import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { Cohort } from '../../types';

interface Request { id: string; reason: 'NO_ROSTER_MATCH' | 'DISPUTED'; note: string | null; createdAt: string; user: { id: string; firstName: string; lastName: string; email: string; studentId: string | null; status: string } }

/** P6 (D-21.4) — the admin placement queue: students with no roster match, or who said their
 * placement is wrong. The admin places them in a cohort (their department follows) or rejects. */
export function PlacementQueue({ schoolId }: { schoolId?: string }) {
  const q = schoolId ? `?schoolId=${schoolId}` : '';
  const { data: requests, refetch } = useApi<Request[]>(schoolId ? `/academic/placements${q}` : null);
  const { data: cohorts } = useApi<Cohort[]>(schoolId ? `/academic/cohorts${q}` : null);
  const { mutate: post } = useMutation('post');
  const [pick, setPick] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); refetch(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update'); } };
  const open = (cohorts ?? []).filter((c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED');

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-gray-400">Students never pick their faculty or programme — placement comes from the roster. These students signed up without a roster match, or said their placement was wrong.</p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500 border-b border-gray-200 dark:border-white/10"><th className="py-2 px-4">Student</th><th>Why</th><th>Place in</th><th className="text-right px-4">Actions</th></tr></thead>
          <tbody>
            {requests?.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-white/5 align-top" data-testid="placement-row">
                <td className="py-3 px-4"><p className="text-slate-900 dark:text-white">{r.user.firstName} {r.user.lastName}</p><p className="text-xs text-slate-500">{r.user.email}{r.user.studentId ? ` · ${r.user.studentId}` : ''}</p></td>
                <td className="py-3">
                  <Badge color={r.reason === 'DISPUTED' ? 'yellow' : 'blue'}>{r.reason === 'DISPUTED' ? 'Says placement is wrong' : 'Not on the roster'}</Badge>
                  {r.note && <p className="text-xs text-slate-500 mt-1">“{r.note}”</p>}
                </td>
                <td className="py-3">
                  <select aria-label={`Cohort for ${r.user.firstName} ${r.user.lastName}`} value={pick[r.id] ?? ''} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })} className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5">
                    <option value="">Choose a cohort…</option>
                    {open.map((c) => <option key={c.id} value={c.id}>{c.name}{c.major ? ` — ${c.major.name}` : ''}</option>)}
                  </select>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                  <Button size="sm" disabled={!pick[r.id]} onClick={() => void run(() => post(`/academic/placements/${r.id}/resolve${q}`, { cohortId: pick[r.id] }))}>Place</Button>
                  <Button size="sm" variant="ghost" onClick={() => void run(() => post(`/academic/placements/${r.id}/reject${q}`, { note: null }))}>Reject</Button>
                </td>
              </tr>
            ))}
            {!requests?.length && <tr><td colSpan={4} className="py-6 text-center text-slate-500">Nobody is waiting to be placed.</td></tr>}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
