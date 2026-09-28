import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { MetricList, type Metric } from '../../components/analytics/MetricList';

/** P11 (A8.5) — the aggregate-only view across an institution group, for a granted Dean / VC.
 * Headcount, attendance %, programmes, SLA breach rate per tenant; no drill-through to any record. */
export function GroupViewPage() {
  const { data: groups } = useApi<{ id: string; name: string }[]>('/institutions/group-views/mine');
  const [picked, setPicked] = useState('');
  const id = picked || groups?.[0]?.id || '';
  const { data } = useApi<{ institution: string; floor: number; tenantsData: ({ tenant: string; metrics: Metric[] } | { tenant: string; status: string })[] }>(id ? `/institutions/${id}/summary` : null);
  return (
    <div className="space-y-6" data-testid="group-view">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Institution group</h1>
        <p className="text-gray-500 mt-1">Aggregates across the tenants of your institution group — numbers only; groups under {data?.floor ?? 5} people show "insufficient data".</p>
      </div>
      {!groups?.length ? <p className="glass-card p-6 text-sm text-gray-500">No group view has been granted to you.</p> : (
        <>
          {groups.length > 1 && (
            <select aria-label="Group" className="rounded-lg border px-2 py-2 dark:bg-white/5" value={id} onChange={(e) => setPicked(e.target.value)}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          {(data?.tenantsData ?? []).map((t) => (
            <section key={t.tenant} className="glass-card p-4">
              <h2 className="font-semibold mb-2">{t.tenant}</h2>
              {'metrics' in t ? <MetricList metrics={t.metrics} /> : <p className="text-sm text-gray-500">This tenant's deployment could not be reached.</p>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
