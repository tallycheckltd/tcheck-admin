import { useApi } from '../../hooks/useApi';
import { Badge } from '../ui/Badge';

type P = { id: string; firstName: string; lastName: string } | null;
interface Row {
  cohort: { id: string; name: string; year: number; status: string };
  programme: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  hods: NonNullable<P>[];
  cem: P; cemManager: P;
  lecturers: NonNullable<P>[];
  students: number;
}
const n = (p: P) => (p ? `${p.firstName} ${p.lastName}` : null);

/** P9 (D-11.8) — who is responsible for each programme/cohort: owning department + HOD, CEM, CEM
 * Manager, lecturers, active students, status. Read-only; edits happen where each thing is owned. */
export function ResponsibilityMatrix({ schoolId }: { schoolId?: string }) {
  const { data, loading } = useApi<{ rows: Row[] }>(`/academic/responsibility${schoolId ? `?schoolId=${schoolId}` : ''}`);
  if (loading && !data) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data?.rows.length) return <p className="text-sm text-slate-500">No cohorts yet.</p>;
  const gap = <span className="text-amber-600 dark:text-amber-400">None</span>;
  return (
    <div className="glass-card overflow-x-auto" data-testid="responsibility-matrix">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="p-3">Programme / cohort</th><th className="p-3">Department</th><th className="p-3">HOD</th><th className="p-3">CEM</th><th className="p-3">CEM Manager</th><th className="p-3">Lecturers</th><th className="p-3">Students</th><th className="p-3">Status</th></tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.cohort.id} className="border-t border-gray-100 dark:border-white/5 align-top">
              <td className="p-3"><p className="font-medium">{r.programme?.name ?? 'No programme'}</p><p className="text-xs text-slate-500">{r.cohort.name}</p></td>
              <td className="p-3">{r.department?.name ?? gap}</td>
              <td className="p-3">{r.hods.length ? r.hods.map(n).join(', ') : '—'}</td>
              <td className="p-3">{n(r.cem) ?? gap}</td>
              <td className="p-3">{n(r.cemManager) ?? '—'}</td>
              <td className="p-3">{r.lecturers.length ? r.lecturers.map(n).join(', ') : '—'}</td>
              <td className="p-3">{r.students}</td>
              <td className="p-3"><Badge color={r.cohort.status === 'ACTIVE' ? 'green' : r.cohort.status === 'PLANNED' ? 'blue' : 'gray'}>{r.cohort.status.toLowerCase()}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
