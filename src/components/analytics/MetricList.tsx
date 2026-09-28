import { Badge } from '../ui/Badge';

/** P11 — renders the aggregation layer's allow-listed metrics (numbers + group labels only). */
export interface Row { label: string; value: number | null; n: number | null; status: 'ok' | 'insufficient_data' }
export interface Metric { key: string; tier: 'T0' | 'T1' | 'T2'; label: string; unit: string; value: number | null; n: number | null; status: 'ok' | 'insufficient_data'; breakdown?: Row[] }

export const fmt = (v: number | null, unit: string) => (v === null ? '—' : unit === 'percent' ? `${v}%` : unit === 'seconds' ? `${v}s` : String(v));

export function MetricList({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-3" data-testid="metric-list">
      {metrics.map((m) => (
        <div key={m.key} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-sm" data-testid="metric">
          <div className="flex justify-between gap-2">
            <p className="font-medium">{m.label}</p>
            <Badge color={m.tier === 'T0' ? 'gray' : m.tier === 'T1' ? 'blue' : 'purple'}>{m.tier}</Badge>
          </div>
          {m.status === 'insufficient_data'
            ? <p className="text-gray-500 mt-1" data-testid="insufficient">Insufficient data (group smaller than the floor)</p>
            : <p className="text-xl font-bold mt-1">{fmt(m.value, m.unit)}{m.n !== null ? <span className="text-xs font-normal text-gray-500"> · n={m.n}</span> : null}</p>}
          {m.breakdown?.length ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              {m.breakdown.map((r, i) => <li key={i}>{r.label}: {r.status === 'insufficient_data' ? 'insufficient data' : fmt(r.value, m.unit === 'count' ? 'count' : m.unit)}</li>)}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
