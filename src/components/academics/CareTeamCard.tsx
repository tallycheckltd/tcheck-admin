import { useApi } from '../../hooks/useApi';
import { HeartHandshake } from 'lucide-react';

type P = { id: string; firstName: string; lastName: string; email?: string } | null;
interface Card { cohort: { id: string; name: string; status: string }; programme: { id: string; name: string } | null; department: { id: string; name: string } | null; cem: P; manager: P; hods: NonNullable<P>[]; deans: NonNullable<P>[] }
const n = (p: P) => (p ? `${p.firstName} ${p.lastName}` : '—');

/** P9 (D-11.8) — "Who looks after this student": per active cohort, the programme, CEM, CEM Manager and HOD/Dean. */
export function CareTeamCard({ studentId }: { studentId: string }) {
  const { data, error } = useApi<{ cohorts: Card[] }>(`/academic/students/${studentId}/care-team`);
  if (error || !data) return null;
  return (
    <section className="glass-card p-5" data-testid="care-team-card">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><HeartHandshake size={18} className="text-blue-500" /> Who looks after this student</h2>
      {data.cohorts.length === 0 ? <p className="text-sm text-slate-500">Not in an active cohort.</p> : data.cohorts.map((c) => (
        <dl key={c.cohort.id} className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3 last:mb-0">
          <dt className="text-slate-500">Programme</dt><dd>{c.programme?.name ?? '—'}</dd>
          <dt className="text-slate-500">Cohort</dt><dd>{c.cohort.name}</dd>
          <dt className="text-slate-500">CEM</dt><dd>{n(c.cem)}</dd>
          <dt className="text-slate-500">CEM Manager</dt><dd>{n(c.manager)}</dd>
          <dt className="text-slate-500">HOD</dt><dd>{c.hods.length ? c.hods.map(n).join(', ') : '—'}</dd>
          <dt className="text-slate-500">Dean</dt><dd>{c.deans.length ? c.deans.map(n).join(', ') : '—'}</dd>
        </dl>
      ))}
    </section>
  );
}
