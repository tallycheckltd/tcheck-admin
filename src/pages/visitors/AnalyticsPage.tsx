import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Users, MailCheck, DoorOpen, Clock, Loader2, TrendingUp, Building2, UserCheck, PieChart as PieIcon } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatCard } from '../../components/ui/StatCard';
import { duration, type VisitorAnalytics } from './visitorsApi';

/**
 * Visitors (2026-11-13) — visit counts by day and hour, average time on site, invited against
 * walk-in, top hosts and top companies (ICT Admin, School Admin).
 *
 * Charts (recharts): one hue (blue) wherever a chart shows a single measure, so the title names
 * the series and no legend is needed. The only two-series chart is invited against walk-in, where
 * blue and green were checked for colour-blind separation and each slice is also labelled with
 * its name and count, so colour is never the only cue. Every chart has a hover tooltip.
 */
const RANGES = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }] as const;
const BLUE = '#3B82F6';
const GREEN = '#0EA371'; // passes the colour-blind and contrast checks beside BLUE in light and dark
const AXIS = { fontSize: 11, fill: '#94a3b8' } as const;
const GRID = 'rgba(148,163,184,0.18)';

function Tip({ active, payload, label, unit = 'visits' }: { active?: boolean; payload?: { value?: number; payload?: { title?: string; name?: string } }[]; label?: string | number; unit?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900">
      <p className="text-slate-500 dark:text-slate-400">{p.payload?.title ?? p.payload?.name ?? label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{p.value} {p.value === 1 ? unit.replace(/s$/, '') : unit}</p>
    </div>
  );
}

function ChartCard({ icon, title, hint, children, className = '' }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass-card p-5 ${className}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
        <span className="text-blue-500">{icon}</span>{title}
        {hint && <span className="font-normal text-slate-500">{hint}</span>}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal bars, longest first, each with its name on the left and its count at the end. */
function RankBars({ rows, empty, label }: { rows: { name: string; count: number }[]; empty: string; label: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <div style={{ height: Math.max(120, rows.length * 34 + 10) }} role="img" aria-label={`${label}: ${rows.map((r) => `${r.name} ${r.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" width={176} tick={{ fontSize: 12, fill: '#64748b', width: 400 }} axisLine={false} tickLine={false}
            tickFormatter={(v: string) => (v.length > 24 ? `${v.slice(0, 23)}…` : v)} />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<Tip />} />
          <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
  const hourItems = hours.map((h) => ({ tick: `${String(h.hour).padStart(2, '0')}:00`, count: h.count, title: `${String(h.hour).padStart(2, '0')}:00–${String(h.hour + 1).padStart(2, '0')}:00` }));
  const split = [{ name: 'Invited', count: data?.invited ?? 0, color: BLUE }, { name: 'Walk-in', count: data?.walkIn ?? 0, color: GREEN }];

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

          <ChartCard icon={<TrendingUp size={16} />} title="Visits per day">
            <div className="h-56" role="img" aria-label={`Visits per day over the last ${days} days, ${data.total} in total`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dayItems} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BLUE} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="tick" tick={AXIS} axisLine={false} tickLine={false} interval={tickEvery - 1} tickMargin={8} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
                  <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={<Tip />} />
                  <Area type="monotone" dataKey="count" stroke={BLUE} strokeWidth={2} fill="url(#visitsFill)" dot={days <= 30 ? { r: 2.5, fill: BLUE, strokeWidth: 0 } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard className="lg:col-span-2" icon={<Clock size={16} />} title="Busiest hours" hint="(arrivals, 06:00–21:00)">
              <div className="h-56" role="img" aria-label="Arrivals by hour of the day">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourItems} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap={3}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="tick" tick={AXIS} axisLine={false} tickLine={false} interval={2} tickMargin={8} />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<Tip unit="arrivals" />} />
                    <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard icon={<PieIcon size={16} />} title="Invited and walk-in">
              <div className="relative h-40" role="img" aria-label={`${data.invited} invited, ${data.walkIn} walk-in`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={split} dataKey="count" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={split.every((x) => x.count > 0) ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
                      {split.map((x) => <Cell key={x.name} fill={x.color} />)}
                    </Pie>
                    <Tooltip content={<Tip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{data.total}</span>
                  <span className="text-[11px] text-slate-500">visits</span>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {split.map((x) => (
                  <li key={x.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />{x.name}</span>
                    <span className="tabular-nums font-medium text-slate-950 dark:text-white">{x.count} <span className="font-normal text-slate-500">({data.total ? Math.round((x.count / data.total) * 100) : 0}%)</span></span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard icon={<UserCheck size={16} />} title="Top hosts">
              <RankBars label="Top hosts" rows={data.topHosts} empty="No hosts recorded yet. Walk-ins only have a host when the guard types one." />
            </ChartCard>
            <ChartCard icon={<Building2 size={16} />} title="Top 10 companies">
              <RankBars label="Top 10 companies" rows={data.topCompanies ?? []} empty="No companies recorded yet. A company shows when it is on the invite or typed at the gate." />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
