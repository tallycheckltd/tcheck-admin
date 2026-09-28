import { useApi } from '../../hooks/useApi';
import { fmt } from './MetricList';

interface Bench { key: string; label: string; unit: string; own: number | null; participants: number | null; mean: number | null; median: number | null; p25: number | null; p75: number | null; takenAt: string | null }

/** P11 (A7.3) — "you vs the regional average", offered to institutions that share T1. */
export function BenchmarksCard() {
  const { data } = useApi<{ benchmarks: Bench[] }>('/analytics/benchmarks');
  if (!data?.benchmarks.some((b) => b.participants)) return null;
  return (
    <section className="glass-card p-5" data-testid="benchmarks">
      <h2 className="text-lg font-semibold mb-2">You vs the regional average</h2>
      <ul className="text-sm space-y-1">
        {data.benchmarks.filter((b) => b.participants).map((b) => (
          <li key={b.key}>{b.label}: <b>{fmt(b.own, b.unit)}</b> — median {fmt(b.median, b.unit)} (middle half {fmt(b.p25, b.unit)}–{fmt(b.p75, b.unit)}, {b.participants} institutions)</li>
        ))}
      </ul>
    </section>
  );
}
