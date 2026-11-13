import { useState } from 'react';
import { BarChart3, Users, MailCheck, DoorOpen, Clock, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatCard } from '../../components/ui/StatCard';
import { duration, type VisitorAnalytics } from './visitorsApi';

/**
 * Visitors (2026-11-13) — visit counts by day and hour, average time on site, top hosts and
 * invited against walk-in (ICT Admin, School Admin). Single-series bars in one hue: the title
 * names the series, each bar shows its value on hover/focus, and the counts are also listed.
 */
const RANGES = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }] as const;

function Bars({ items, label }: { items: { key: string; tick: string; count: number; title: string }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div role="list" aria-label={label} className="flex h-44 items-end gap-[2px] border-b border-slate-200 dark:border-white/10">
      {items.map((i) => (
        <div key={i.key} role="listitem" tabIndex={0} aria-label={`${i.title}: ${i.count}`} className="group relative flex h-full flex-1 flex-col justify-end focus:outline-none">
          <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-white dark:text-slate-900">
            {i.title}: <strong>{i.count}</strong>
          </span>
          <div
            className="w-full rounded-t-[4px] bg-blue-500 transition-colors group-hover:bg-blue-600 group-focus:bg-blue-600 dark:bg-blue-400 dark:group-hover:bg-blue-300"
            style={{ height: i.count ? `${Math.max(3, (i.count / max) * 100)}%` : '0%' }}
          />
        </div>
      ))}
    </div>
  );
}

function Ticks({ ticks }: { ticks: string[] }) {
  return (
    <div className="mt-1.5 flex gap-[2px] text-[10px] text-slate-500 tabular-nums">
      {ticks.map((t, idx) => <span key={idx} className="flex-1 text-center truncate">{t}</span>)}
    </div>
  );
}

export function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  // Rounded to the minute so the request URL (and so the fetch) stays stable between renders.
  const [now] = useState(() => { const d = new Date(); d.setSeconds(0, 0); return d; });
  const from = new Date(now.getTime() - days * 86_400_000);
  const { data, loading } = useApi<VisitorAnalytics>(`/visitors/analytics?from=${from.toISOString()}&to=${now.toISOString()}`);

  // Every day in the range, zero-filled, so a quiet day shows as a gap rather than disappearing.
  const counts = new Map((data?.perDay ?? []).map((d) => [d.day, d.count]));
  const dayItems = Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + (i + 1) * 86_400_000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key, tick: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), count: counts.get(key) ?? 0, title: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) };
  });
  const tickEvery = days <= 7 ? 1 : days <= 30 ? 5 : 15;
  const hours = (data?.perHour ?? []).filter((h) => h.hour >= 6 && h.hour <= 21);
  const topHostMax = Math.max(1, ...(data?.topHosts ?? []).map((h) => h.count));
  const topCompanyMax = Math.max(1, ...(data?.topCompanies ?? []).map((c) => c.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Visitor analytics</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">How many people visit, when, for how long and who they come to see.</p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Date range">
          {RANGES.map((r) => <Button key={r.days} size="sm" role="tab" aria-selected={days === r.days} variant={days === r.days ? 'primary' : 'secondary'} onClick={() => setDays(r.days)}>{r.label}</Button>)}
        </div>
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : !data || data.total === 0 ? (
        <EmptyState icon={BarChart3} title="No visits in this period" description="Once guards start checking visitors in, the numbers appear here." />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard size="compact" title="Visits" value={data.total} icon={<DoorOpen size={18} />} color="blue" />
            <StatCard size="compact" title="Invited" value={data.invited} icon={<MailCheck size={18} />} color="green" />
            <StatCard size="compact" title="Walk-in" value={data.walkIn} icon={<Users size={18} />} color="purple" />
            <StatCard size="compact" title="Average time on site" value={data.averageMinutesOnSite === null ? '—' : duration(data.averageMinutesOnSite)} icon={<Clock size={18} />} color="cyan" />
          </div>

          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Visits per day</h2>
            <div className="mt-6"><Bars label="Visits per day" items={dayItems} /></div>
            <Ticks ticks={dayItems.map((d, i) => (i % tickEvery === 0 ? d.tick : ''))} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Busiest hours <span className="font-normal text-slate-500">(arrivals, 06:00–21:00)</span></h2>
              <div className="mt-6"><Bars label="Arrivals by hour" items={hours.map((h) => ({ key: String(h.hour), tick: String(h.hour), count: h.count, title: `${String(h.hour).padStart(2, '0')}:00–${String(h.hour + 1).padStart(2, '0')}:00` }))} /></div>
              <Ticks ticks={hours.map((h) => (h.hour % 3 === 0 ? `${String(h.hour).padStart(2, '0')}:00` : ''))} />
            </div>

            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Top hosts</h2>
              {data.topHosts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No hosts recorded yet. Walk-ins only have a host when the guard types one.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    {data.topHosts.map((h) => (
                      <tr key={h.name}>
                        <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-300 truncate max-w-[12rem]">{h.name}</td>
                        <td className="py-1.5 w-1/2">
                          <div className="h-2 rounded-r-[4px] bg-blue-500 dark:bg-blue-400" style={{ width: `${(h.count / topHostMax) * 100}%` }} />
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums font-medium text-slate-950 dark:text-white">{h.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Top 10 companies</h2>
              {(data.topCompanies ?? []).length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No companies recorded yet. A company shows here when it is on the visitor's invite or typed at the gate.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    {(data.topCompanies ?? []).map((c) => (
                      <tr key={c.name}>
                        <td className="py-1.5 pr-3 text-slate-700 dark:text-slate-300 truncate max-w-[12rem]">{c.name}</td>
                        <td className="py-1.5 w-1/2">
                          <div className="h-2 rounded-r-[4px] bg-blue-500 dark:bg-blue-400" style={{ width: `${(c.count / topCompanyMax) * 100}%` }} />
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums font-medium text-slate-950 dark:text-white">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
