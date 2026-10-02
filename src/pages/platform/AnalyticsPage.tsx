import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell as CellFill, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Lock, TrendingDown, TrendingUp, Minus, Table2, LineChart as LineIcon, RefreshCw } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { fmt, type Metric } from '../../components/analytics/MetricList';
import { seriesColors, FUNNEL_DARK, FUNNEL_LIGHT, OTHER_COLOR } from '../../components/platform/vizPalette';

// ─── Types ────────────────────────────────────────────────────────────────────────────────────
interface RollupRow { key: string; label: string; unit: string; value: number | null; n: number; breakdown?: { label: string; value: number | null }[] }
interface TenantRow { tenantId: string; tenant: string; institution: string | null; status?: string; tiers?: { t0: boolean; t1: boolean; t2: boolean }; metrics?: Metric[] }
interface Overview { rollup: RollupRow[]; tenantsData: TenantRow[]; period: { from: string; to: string } }
interface TenantAgg { tenantId: string; tenant: string; tiers: { t0: boolean; t1: boolean; t2: boolean }; metrics: Metric[]; status?: string }
interface SeriesPoint { key: string; label: string; value: number | null; partial: boolean }
interface Series { granularity: string; series: Record<string, SeriesPoint[]> }
interface Group { institution: { id: string; name: string } | null; tenants: { id: string; name: string; deployment: string; tiers: { t1: boolean; t2: boolean } }[] }

type View = 'platform' | 'institution' | 'school' | 'compare';
type PeriodKey = '30d' | 'month' | 'lastMonth' | 'year' | '12m';
type CompareKey = 'previous' | 'lastYear' | 'off';
type Gran = 'month' | 'term' | 'year';

const PERIODS: [PeriodKey, string][] = [['30d', 'Last 30 days'], ['month', 'This month'], ['lastMonth', 'Last month'], ['year', 'This year'], ['12m', 'Last 12 months']];
function rangeOf(k: PeriodKey, now = new Date()) {
  const y = now.getFullYear(); const m = now.getMonth();
  switch (k) {
    case 'month': return { from: new Date(y, m, 1), to: now };
    case 'lastMonth': return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1, 0, 0, -1) };
    case 'year': return { from: new Date(y, 0, 1), to: now };
    case '12m': return { from: new Date(y - 1, m, now.getDate()), to: now };
    default: return { from: new Date(now.getTime() - 30 * 86_400_000), to: now };
  }
}
function compareOf(r: { from: Date; to: Date }, c: CompareKey) {
  if (c === 'off') return null;
  if (c === 'lastYear') return { from: new Date(r.from.getFullYear() - 1, r.from.getMonth(), r.from.getDate()), to: new Date(r.to.getFullYear() - 1, r.to.getMonth(), r.to.getDate(), 23, 59, 59) };
  const span = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - span), to: new Date(r.from.getTime() - 1) };
}
const qs = (r: { from: Date; to: Date }) => `from=${r.from.toISOString()}&to=${r.to.toISOString()}`;
const change = (a: number | null | undefined, b: number | null | undefined) => (a === null || a === undefined || b === null || b === undefined || b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10);
const valueOf = (ms: Metric[] | undefined, k: string) => ms?.find((m) => m.key === k)?.value ?? null;

// ─── Small pieces ────────────────────────────────────────────────────────────────────────────
function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-xs text-gray-400">no comparison</span>;
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
  return <span className="text-xs text-gray-700 dark:text-gray-200 inline-flex items-center gap-1"><Icon size={12} />{v > 0 ? '+' : ''}{v}%</span>;
}

function Spark({ points, color }: { points: SeriesPoint[] | undefined; color: string }) {
  const data = (points ?? []).map((p) => ({ label: p.label, v: p.value }));
  if (!data.some((d) => d.v !== null)) return <div className="h-10" />;
  return (
    <div className="h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip formatter={(v) => [String(v ?? '—'), '']} labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ''} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ label, value, unit, delta, spark, color }: { label: string; value: number | null; unit: string; delta: number | null; spark?: SeriesPoint[]; color: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(value, unit)}</p>
      <Delta v={delta} />
      <Spark points={spark} color={color} />
    </div>
  );
}

function Card({ title, sub, children, action }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3"><div><h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>{sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}</div>{action}</div>
      {children}
    </section>
  );
}

/** One series over time — a bar per period; the running period is marked. */
function PeriodBars({ points, color, unit }: { points: SeriesPoint[]; color: string; unit: string }) {
  const data = points.map((p) => ({ label: p.partial ? `${p.label} (so far)` : p.label, v: p.value }));
  if (!data.length) return <p className="text-sm text-gray-500">No history yet — it builds up month by month.</p>;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.15} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip cursor={{ fillOpacity: 0.08 }} formatter={(v) => [fmt((v as number) ?? null, unit), '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Group counts (a mix) as horizontal bars with the value and share written beside each. */
function Mix({ rows, color }: { rows: { label: string; value: number | null }[]; color: string }) {
  const total = rows.reduce((n, r) => n + (r.value ?? 0), 0);
  if (!rows.length || !total) return <p className="text-sm text-gray-500">Nothing to show for this period.</p>;
  const sorted = [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <ul className="space-y-2">
      {sorted.map((r) => {
        const share = Math.round(((r.value ?? 0) / total) * 1000) / 10;
        return (
          <li key={r.label} className="text-sm">
            <div className="flex justify-between"><span className="text-gray-700 dark:text-gray-200">{r.label}</span><span className="tabular-nums text-gray-900 dark:text-white">{(r.value ?? 0).toLocaleString()} · {share}%</span></div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 mt-1"><div className="h-2 rounded-full" style={{ width: `${share}%`, background: color }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

function Funnel({ steps, dark }: { steps: { label: string; value: number | null }[]; dark: boolean }) {
  const top = steps[0]?.value ?? 0;
  if (!top) return <p className="text-sm text-gray-500">No roster yet.</p>;
  const colors = dark ? FUNNEL_DARK : FUNNEL_LIGHT;
  return (
    <ul className="space-y-2.5">
      {steps.map((s, i) => {
        const pct = Math.round(((s.value ?? 0) / top) * 1000) / 10;
        return (
          <li key={s.label} className="text-sm">
            <div className="flex justify-between"><span className="text-gray-700 dark:text-gray-200">{s.label}</span><span className="tabular-nums font-medium text-gray-900 dark:text-white">{(s.value ?? 0).toLocaleString()}{i ? ` · ${pct}%` : ''}</span></div>
            <div className="h-3 rounded-md bg-gray-100 dark:bg-white/10 mt-1"><div className="h-3 rounded-md" style={{ width: `${pct}%`, background: colors[Math.min(i, colors.length - 1)] }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

function Locked({ tier, what }: { tier: 'T1' | 'T2'; what: string }) {
  return (
    <div className="glass-card p-5 border border-dashed border-gray-300 dark:border-white/15 flex items-start gap-3">
      <Lock size={16} className="text-gray-400 mt-0.5" />
      <div><p className="font-medium text-gray-700 dark:text-gray-200">{what}</p><p className="text-sm text-gray-500">{tier} not shared by this school — switch it on from the school's page once the contract allows.</p></div>
    </div>
  );
}

// ─── The page ────────────────────────────────────────────────────────────────────────────────

/**
 * UAT §9 (2026-09-29) — Analytics rebuilt around charts. One control bar (view, what, period, compare
 * to); Platform (headline cards with change and trend, growth, check-ins by institution, adoption
 * funnel, phone OS and check-in method mixes, a ranking), Institution and School (tabs: Adoption,
 * Attendance, Experience, Operations; growth by month / term / year; locked cards where a tier is not
 * shared) and Compare (2–6 schools: rates over time, this period side by side with the typical range,
 * and a table). Numbers about groups only — never a person.
 */
export function PlatformAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const { dark } = useTheme();
  const colors = seriesColors(dark);
  const [view, setView] = useState<View>(params.get('school') ? 'school' : 'platform');
  const [schoolId, setSchoolId] = useState(params.get('school') ?? '');
  const [institutionId, setInstitutionId] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d');
  const [compareKey, setCompareKey] = useState<CompareKey>('previous');
  const [gran, setGran] = useState<Gran>('month');
  const range = useMemo(() => rangeOf(periodKey), [periodKey]);
  const prev = useMemo(() => compareOf(range, compareKey), [range, compareKey]);
  const { data: groupsData } = useApi<{ groups: Group[] }>('/platform/institutions');
  const groups = useMemo(() => groupsData?.groups ?? [], [groupsData]);
  const shared = useMemo(() => groups.flatMap((g) => g.tenants).filter((t) => t.deployment !== 'ISOLATED'), [groups]);
  // Until something is picked, the first shared school / the first real institution.
  const activeSchool = schoolId || shared[0]?.id || '';
  const activeInstitution = institutionId || groups.find((x) => x.institution)?.institution?.id || '';
  const pickSchool = (id: string) => { setSchoolId(id); setParams(id ? { school: id } : {}); };

  const select = 'rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 text-sm bg-white dark:bg-white/5';
  return (
    <div className="space-y-6" data-testid="platform-analytics">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">How every institution is doing — numbers about groups, never a person. T0 for every school; T1 / T2 only where the school shares them.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={async () => { await api.post('/platform/snapshots/run', {}); window.location.reload(); }}><RefreshCw size={13} className="mr-1.5" />Record this month now</Button>
      </div>

      <div className="glass-card p-3 flex flex-wrap items-center gap-2 sticky top-2 z-30">
        <div role="tablist" className="inline-flex rounded-lg bg-gray-100 dark:bg-white/5 p-1 text-sm">
          {([['platform', 'Platform'], ['institution', 'Institution'], ['school', 'School'], ['compare', 'Compare']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`px-3 py-1 rounded-md cursor-pointer ${view === k ? 'bg-white dark:bg-white/15 shadow-sm font-medium text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>{l}</button>
          ))}
        </div>
        {view === 'school' && (
          <select aria-label="School" className={select} value={activeSchool} onChange={(e) => pickSchool(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g.institution?.id ?? g.tenants[0]?.id} label={g.institution?.name ?? g.tenants[0]?.name}>
                {g.tenants.map((t) => <option key={t.id} value={t.id} disabled={t.deployment === 'ISOLATED'}>{t.name}{t.deployment === 'ISOLATED' ? ' (not connected)' : ''}</option>)}
              </optgroup>
            ))}
          </select>
        )}
        {view === 'institution' && (
          <select aria-label="Institution" className={select} value={activeInstitution} onChange={(e) => setInstitutionId(e.target.value)}>
            {groups.filter((g) => g.institution).map((g) => <option key={g.institution!.id} value={g.institution!.id}>{g.institution!.name}</option>)}
          </select>
        )}
        <select aria-label="Period" className={select} value={periodKey} onChange={(e) => setPeriodKey(e.target.value as PeriodKey)}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select aria-label="Compare to" className={select} value={compareKey} onChange={(e) => setCompareKey(e.target.value as CompareKey)}>
          <option value="previous">vs previous period</option><option value="lastYear">vs same period last year</option><option value="off">No comparison</option>
        </select>
        <select aria-label="Growth by" className={select} value={gran} onChange={(e) => setGran(e.target.value as Gran)}>
          <option value="month">Growth by month</option>{view === 'school' && <option value="term">Growth by term</option>}<option value="year">Growth by year</option>
        </select>
      </div>

      {view === 'platform' && <PlatformView range={range} prev={prev} gran={gran === 'term' ? 'month' : gran} colors={colors} dark={dark} onOpen={(id) => { pickSchool(id); setView('school'); }} />}
      {view === 'institution' && activeInstitution && <InstitutionView id={activeInstitution} name={groups.find((g) => g.institution?.id === activeInstitution)?.institution?.name ?? ''} range={range} prev={prev} gran={gran === 'term' ? 'month' : gran} colors={colors} dark={dark} />}
      {view === 'institution' && !groups.some((g) => g.institution) && <p className="glass-card p-6 text-sm text-gray-500">No institution has more than one campus yet — use the School view.</p>}
      {view === 'school' && activeSchool && <SchoolView id={activeSchool} range={range} prev={prev} gran={gran} colors={colors} dark={dark} />}
      {view === 'compare' && <CompareView all={shared} selected={compareIds} setSelected={setCompareIds} range={range} colors={colors} dark={dark} />}
    </div>
  );
}

// ─── Platform ────────────────────────────────────────────────────────────────────────────────
function PlatformView({ range, prev, gran, colors, dark, onOpen }: { range: { from: Date; to: Date }; prev: { from: Date; to: Date } | null; gran: 'month' | 'year'; colors: readonly string[]; dark: boolean; onOpen: (id: string) => void }) {
  const { data } = useApi<Overview>(`/platform/analytics?${qs(range)}`);
  const { data: before } = useApi<Overview>(prev ? `/platform/analytics?${qs(prev)}` : null);
  const { data: spark } = useApi<Series>('/platform/analytics/series?scope=platform&metrics=t0.students_active,t0.check_ins,t0.classes_held,t1.attendance_rate,t0.activation&granularity=month');
  const { data: growth } = useApi<Series>(`/platform/analytics/series?scope=platform&metrics=t0.check_ins,t0.students_active&granularity=${gran}`);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 't0.check_ins', dir: -1 });
  const roll = (d: Overview | null | undefined, k: string) => d?.rollup.find((r) => r.key === k) ?? null;
  const cards: [string, string, string][] = [['t0.students_active', 'Active students', 'count'], ['t0.check_ins', 'Check-ins', 'count'], ['t0.classes_held', 'Classes held', 'count'], ['t1.attendance_rate', 'Attendance rate (T1 sharers)', 'percent'], ['t0.activation', 'Activation (first check-in / roster)', 'percent']];

  // Check-ins per institution (one request). The eight biggest keep a colour slot in name order —
  // colour follows the institution, not its rank; the rest fold into "Other".
  const { data: byInst } = useApi<{ periods: { key: string; label: string; partial: boolean }[]; owners: { name: string; total: number; values: number[] }[] }>(`/platform/analytics/series/by-institution?metric=t0.check_ins&granularity=${gran}`);
  const stacked = useMemo(() => {
    const owners = byInst?.owners ?? [];
    const shown = owners.slice(0, 8).sort((a, b) => a.name.localeCompare(b.name));
    const rest = owners.slice(8);
    return {
      names: [...shown.map((o) => o.name), ...(rest.length ? ['Other'] : [])],
      rows: (byInst?.periods ?? []).map((p, i) => {
        const row: Record<string, number | string> = { label: p.partial ? `${p.label} (so far)` : p.label };
        for (const o of shown) row[o.name] = o.values[i] ?? 0;
        if (rest.length) row.Other = rest.reduce((n, o) => n + (o.values[i] ?? 0), 0);
        return row;
      }),
    };
  }, [byInst]);

  const tenants = (data?.tenantsData ?? []).filter((t) => t.metrics);
  const sorted = [...tenants].sort((a, b) => ((valueOf(a.metrics, sort.key) ?? -1) - (valueOf(b.metrics, sort.key) ?? -1)) * sort.dir);
  const th = (k: string, l: string) => <th className="p-2 text-left text-xs uppercase text-gray-500"><button className="cursor-pointer" onClick={() => setSort({ key: k, dir: sort.key === k ? (-sort.dir as 1 | -1) : -1 })}>{l}{sort.key === k ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}</button></th>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(([k, l, u]) => <Kpi key={k} label={l} unit={u} value={roll(data, k)?.value ?? null} delta={change(roll(data, k)?.value, roll(before, k)?.value)} spark={spark?.series[k]} color={colors[0]!} />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Check-ins" sub={`By ${gran}. Recorded monthly; the running month is "so far".`}><PeriodBars points={growth?.series['t0.check_ins'] ?? []} color={colors[0]!} unit="count" /></Card>
        <Card title="Active students" sub={`Approved accounts at the end of each ${gran}.`}><PeriodBars points={growth?.series['t0.students_active'] ?? []} color={colors[0]!} unit="count" /></Card>
      </div>
      <Card title="Check-ins by institution" sub="Who drives the growth. Hover a bar for the numbers.">
        {!stacked.rows.length ? <p className="text-sm text-gray-500">No history yet.</p> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stacked.rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fillOpacity: 0.08 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {stacked.names.map((n, i) => <Bar key={n} dataKey={n} stackId="a" fill={n === 'Other' ? (dark ? OTHER_COLOR.dark : OTHER_COLOR.light) : colors[i]!} stroke={dark ? '#1a1a19' : '#fcfcfb'} strokeWidth={1} maxBarSize={40} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Adoption" sub="Roster → signed in → first check-in, every school."><Funnel steps={roll(data, 't0.activation')?.breakdown ?? []} dark={dark} /></Card>
        <Card title="Check-ins by phone" sub="Phone OS at check-in."><Mix rows={roll(data, 't0.device_os_mix')?.breakdown ?? []} color={colors[0]!} /></Card>
        <Card title="How students check in" sub="Schools sharing T1."><Mix rows={roll(data, 't1.check_in_methods')?.breakdown ?? []} color={colors[0]!} /></Card>
      </div>
      <Card title="Schools" sub="Click a school to open it. Sort by any column.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="p-2 text-left text-xs uppercase text-gray-500">School</th>{th('t0.students_active', 'Students')}{th('t0.check_ins', 'Check-ins')}{th('t0.activation', 'Activation')}{th('t1.attendance_rate', 'Attendance')}{th('t1.check_out_completion', 'Check-out')}</tr></thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.tenantId} className="border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => onOpen(t.tenantId)}>
                  <td className="p-2"><span className="font-medium text-blue-600 dark:text-blue-400">{t.tenant}</span>{t.institution && <span className="text-xs text-gray-500"> · {t.institution}</span>}</td>
                  <td className="p-2 tabular-nums">{fmt(valueOf(t.metrics, 't0.students_active'), 'count')}</td>
                  <td className="p-2 tabular-nums">{fmt(valueOf(t.metrics, 't0.check_ins'), 'count')}</td>
                  <td className="p-2 tabular-nums">{fmt(valueOf(t.metrics, 't0.activation'), 'percent')}</td>
                  <td className="p-2 tabular-nums">{t.tiers?.t1 ? fmt(valueOf(t.metrics, 't1.attendance_rate'), 'percent') : <span className="text-gray-400">not shared</span>}</td>
                  <td className="p-2 tabular-nums">{t.tiers?.t1 ? fmt(valueOf(t.metrics, 't1.check_out_completion'), 'percent') : <span className="text-gray-400">not shared</span>}</td>
                </tr>
              ))}
              {(data?.tenantsData ?? []).filter((t) => t.status).map((t) => <tr key={t.tenantId} className="border-t border-gray-100 dark:border-white/5"><td className="p-2">{t.tenant}</td><td className="p-2 text-gray-500" colSpan={5}>Isolated — not connected yet</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── One school (and an institution = its campuses added up) ─────────────────────────────────
const SECTIONS: { key: string; label: string; tier: 'T0' | 'T1' | 'T2'; metrics: string[] }[] = [
  { key: 'adoption', label: 'Adoption', tier: 'T0', metrics: ['t0.students_active', 't0.staff', 't0.activation', 't0.device_os_mix'] },
  { key: 'attendance', label: 'Attendance', tier: 'T1', metrics: ['t1.attendance_rate', 't1.attendance_by_programme', 't1.punctuality', 't1.check_in_methods', 't1.verification_methods', 't1.check_out_completion', 't1.offline_queue_use', 't1.dwell_time', 't1.fraud_rate'] },
  { key: 'experience', label: 'Experience', tier: 'T2', metrics: ['t2.nps', 't2.gender_participation', 't2.nationality_participation', 't2.attrition_non_reenrolment', 't2.attrition_at_risk'] },
  { key: 'operations', label: 'Operations', tier: 'T0', metrics: ['t0.courses', 't0.classes_held', 't0.rooms', 't0.check_ins', 't0.support_tickets', 't0.org_scale', 't1.escalations', 't1.facility_tickets'] },
];

function MetricBlock({ m, before, color }: { m: Metric; before?: Metric; color: string }) {
  const isFunnel = m.key === 't0.activation';
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-4">
      <div className="flex justify-between gap-2"><p className="text-sm text-gray-600 dark:text-gray-300">{m.label}</p><Badge color={m.tier === 'T2' ? 'purple' : m.tier === 'T1' ? 'blue' : 'gray'}>{m.tier}</Badge></div>
      {m.status === 'insufficient_data' ? <p className="text-sm text-gray-500 mt-1">Insufficient data (groups under the minimum size).</p> : (
        <>
          {!m.breakdown?.length || isFunnel ? <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(m.value, m.unit)}</p> : null}
          {!m.breakdown?.length || isFunnel ? <Delta v={change(m.value, before?.value)} /> : null}
          {m.breakdown?.length ? (isFunnel ? <div className="mt-2"><Funnel steps={m.breakdown} dark={false} /></div> : <div className="mt-2"><Mix rows={m.breakdown.map((r) => ({ label: r.label, value: r.status === 'ok' ? r.value : null }))} color={color} /></div>) : null}
        </>
      )}
    </div>
  );
}

function SectionsView({ metrics, before, tiers, colors, growthScope, gran }: { metrics: Metric[]; before?: Metric[]; tiers: { t1: boolean; t2: boolean }; colors: readonly string[]; growthScope: string; gran: Gran }) {
  const [tab, setTab] = useState('adoption');
  const [growthKey, setGrowthKey] = useState('t0.check_ins');
  const { data: growth } = useApi<Series>(`/platform/analytics/series?${growthScope}&metrics=${growthKey}&granularity=${gran}`);
  const section = SECTIONS.find((s) => s.key === tab)!;
  const locked = (section.tier === 'T1' && !tiers.t1) || (section.tier === 'T2' && !tiers.t2);
  const shown = section.metrics.map((k) => metrics.find((m) => m.key === k)).filter(Boolean) as Metric[];
  const growthOptions = [['t0.check_ins', 'Check-ins'], ['t0.students_active', 'Active students'], ['t0.classes_held', 'Classes held'], ...(tiers.t1 ? [['t1.attendance_rate', 'Attendance rate'], ['t1.check_out_completion', 'Check-out completion']] : [])];
  const unit = metrics.find((m) => m.key === growthKey)?.unit ?? 'count';
  return (
    <div className="space-y-4">
      <Card title="Growth" sub={gran === 'term' ? "By the school's own terms." : `By ${gran}.`}
        action={<select aria-label="Measure" className="rounded-lg border px-2 py-1 text-sm dark:bg-white/5" value={growthKey} onChange={(e) => setGrowthKey(e.target.value)}>{growthOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}>
        <PeriodBars points={growth?.series[growthKey] ?? []} color={colors[0]!} unit={unit} />
      </Card>
      <div role="tablist" className="inline-flex rounded-lg bg-gray-100 dark:bg-white/5 p-1 text-sm">
        {SECTIONS.map((s) => <button key={s.key} role="tab" aria-selected={tab === s.key} onClick={() => setTab(s.key)} className={`px-3 py-1 rounded-md cursor-pointer ${tab === s.key ? 'bg-white dark:bg-white/15 shadow-sm font-medium' : 'text-gray-500'}`}>{s.label}</button>)}
      </div>
      {locked ? <Locked tier={section.tier as 'T1' | 'T2'} what={section.label} /> : (
        <div className="grid md:grid-cols-2 gap-3">
          {shown.map((m) => <MetricBlock key={m.key} m={m} before={before?.find((b) => b.key === m.key)} color={colors[0]!} />)}
          {section.key === 'operations' && !tiers.t1 && <Locked tier="T1" what="Escalations and facility tickets" />}
          {!shown.length && <p className="text-sm text-gray-500">Nothing recorded for this period.</p>}
        </div>
      )}
    </div>
  );
}

function SchoolView({ id, range, prev, gran, colors }: { id: string; range: { from: Date; to: Date }; prev: { from: Date; to: Date } | null; gran: Gran; colors: readonly string[]; dark: boolean }) {
  const { data, loading } = useApi<TenantAgg>(`/platform/analytics/tenants/${id}?${qs(range)}`);
  const { data: before } = useApi<TenantAgg>(prev ? `/platform/analytics/tenants/${id}?${qs(prev)}` : null);
  if (loading && !data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!data?.metrics) return <p className="glass-card p-6 text-sm text-gray-500">{data?.status === 'unreachable' ? 'Isolated — not connected yet.' : 'No data.'}</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500"><strong className="text-gray-900 dark:text-white">{data.tenant}</strong> · shares T0{data.tiers.t1 ? ' · T1' : ''}{data.tiers.t2 ? ' · T2' : ''}</p>
      <SectionsView metrics={data.metrics} before={before?.metrics} tiers={data.tiers} colors={colors} growthScope={`scope=school&id=${id}`} gran={gran} />
    </div>
  );
}

/** An institution: its campuses' numbers added up (rates averaged), with a per-campus split. */
function InstitutionView({ id, name, range, prev, gran, colors }: { id: string; name: string; range: { from: Date; to: Date }; prev: { from: Date; to: Date } | null; gran: 'month' | 'year'; colors: readonly string[]; dark: boolean }) {
  const { data } = useApi<{ tenantsData: TenantAgg[] }>(`/platform/analytics/institutions/${id}?${qs(range)}`);
  const { data: before } = useApi<{ tenantsData: TenantAgg[] }>(prev ? `/platform/analytics/institutions/${id}?${qs(prev)}` : null);
  const [split, setSplit] = useState(false);
  const combine = (ts: TenantAgg[] | undefined) => {
    const ok = (ts ?? []).filter((t) => t.metrics);
    const keys = [...new Set(ok.flatMap((t) => t.metrics.map((m) => m.key)))];
    return keys.map((k) => {
      const ms = ok.map((t) => t.metrics.find((m) => m.key === k)).filter(Boolean) as Metric[];
      const first = ms[0]!;
      const isRate = ['percent', 'seconds', 'score', 'ratio'].includes(first.unit);
      const vals = ms.map((m) => m.value).filter((v): v is number => v !== null);
      const value = !vals.length ? null : isRate ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : vals.reduce((a, b) => a + b, 0);
      const labels = [...new Set(ms.flatMap((m) => (m.breakdown ?? []).map((r) => r.label)))];
      const breakdown = labels.length && !isRate ? labels.map((l) => ({ label: l, value: ms.reduce((n, m) => n + (m.breakdown?.find((r) => r.label === l)?.value ?? 0), 0), n: null, status: 'ok' as const })) : undefined;
      return { ...first, value, breakdown } as Metric;
    });
  };
  const ok = (data?.tenantsData ?? []).filter((t) => t.metrics);
  const tiers = { t1: ok.length > 0 && ok.every((t) => t.tiers.t1), t2: ok.length > 0 && ok.every((t) => t.tiers.t2) };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500"><strong className="text-gray-900 dark:text-white">{name}</strong> · {ok.length} campus{ok.length === 1 ? '' : 'es'} added up{!tiers.t1 && ok.some((t) => t.tiers.t1) ? ' · T1 only where every campus shares it' : ''}</p>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Split by campus</label>
      </div>
      {split ? (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="p-2 text-left text-xs uppercase text-gray-500">Campus</th><th className="p-2 text-left text-xs uppercase text-gray-500">Students</th><th className="p-2 text-left text-xs uppercase text-gray-500">Check-ins</th><th className="p-2 text-left text-xs uppercase text-gray-500">Activation</th><th className="p-2 text-left text-xs uppercase text-gray-500">Attendance</th></tr></thead>
            <tbody>{ok.map((t) => (
              <tr key={t.tenantId} className="border-t border-gray-100 dark:border-white/5"><td className="p-2">{t.tenant}</td><td className="p-2">{fmt(valueOf(t.metrics, 't0.students_active'), 'count')}</td><td className="p-2">{fmt(valueOf(t.metrics, 't0.check_ins'), 'count')}</td><td className="p-2">{fmt(valueOf(t.metrics, 't0.activation'), 'percent')}</td><td className="p-2">{t.tiers.t1 ? fmt(valueOf(t.metrics, 't1.attendance_rate'), 'percent') : 'not shared'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <SectionsView metrics={combine(data?.tenantsData)} before={combine(before?.tenantsData)} tiers={tiers} colors={colors} growthScope={`scope=institution&id=${id}`} gran={gran} />}
    </div>
  );
}

// ─── Compare ─────────────────────────────────────────────────────────────────────────────────
const COMPARE_METRICS: [string, string, string][] = [
  ['t0.activation', 'Activation', 'percent'], ['t1.attendance_rate', 'Attendance rate', 'percent'],
  ['t1.check_out_completion', 'Check-out completion', 'percent'], ['perStudent', 'Check-ins per student', 'ratio'],
];

function CompareView({ all, selected, setSelected, range, colors }: { all: { id: string; name: string; tiers: { t1: boolean } }[]; selected: string[]; setSelected: (ids: string[]) => void; range: { from: Date; to: Date }; colors: readonly string[]; dark: boolean }) {
  const [asTable, setAsTable] = useState(false);
  const { data: bench } = useApi<{ benchmarks: { key: string; p25: number; p75: number; median: number; participants: number }[] }>('/platform/benchmarks/latest');
  const [aggs, setAggs] = useState<Record<string, TenantAgg>>({});
  const [series, setSeries] = useState<Record<string, Series>>({});
  const selKey = selected.join(',');
  useEffect(() => {
    let live = true;
    void Promise.all(selected.map(async (id) => [id,
      await api.get<TenantAgg>(`/platform/analytics/tenants/${id}?${qs(range)}`),
      await api.get<Series>(`/platform/analytics/series?scope=school&id=${id}&metrics=t0.activation,t1.attendance_rate,t1.check_out_completion,t0.check_ins,t0.students_active&granularity=month`),
    ] as const)).then((rows) => {
      if (!live) return;
      setAggs(Object.fromEntries(rows.map(([id, a]) => [id, a])));
      setSeries(Object.fromEntries(rows.map(([id, , s]) => [id, s])));
    }).catch(() => {});
    return () => { live = false; };
  }, [selKey, range.from.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed on the selection and period
  // A school keeps its slot for as long as it's selected (colour follows the entity, not its rank).
  const slotOf = (id: string) => selected.indexOf(id);
  const name = (id: string) => all.find((s) => s.id === id)?.name ?? id;
  const current = (id: string, k: string) => {
    const a = aggs[id];
    if (!a?.metrics) return null;
    if (k === 'perStudent') { const c = valueOf(a.metrics, 't0.check_ins'); const s = valueOf(a.metrics, 't0.students_active'); return c !== null && s ? Math.round((c / s) * 10) / 10 : null; }
    return valueOf(a.metrics, k);
  };
  const lineData = (k: string) => {
    const periods = [...new Set(selected.flatMap((id) => (series[id]?.series[k === 'perStudent' ? 't0.check_ins' : k] ?? []).map((p) => p.key)))].sort();
    return periods.map((p) => {
      const row: Record<string, string | number | null> = { label: p };
      for (const id of selected) {
        const s = series[id]?.series;
        if (k === 'perStudent') { const c = s?.['t0.check_ins']?.find((x) => x.key === p)?.value; const st = s?.['t0.students_active']?.find((x) => x.key === p)?.value; row[name(id)] = c !== undefined && c !== null && st ? Math.round((c / st) * 10) / 10 : null; }
        else row[name(id)] = s?.[k]?.find((x) => x.key === p)?.value ?? null;
      }
      return row;
    });
  };
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : selected.length < 6 ? [...selected, id] : selected);
  return (
    <div className="space-y-4">
      <Card title="Schools to compare" sub="Pick 2–6. Rates and per-student figures, not raw counts — a 5-student school next to Daystar is otherwise meaningless.">
        <div className="flex flex-wrap gap-2">
          {all.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button key={s.id} onClick={() => toggle(s.id)} aria-pressed={on} className={`text-sm rounded-full px-3 py-1 border cursor-pointer inline-flex items-center gap-1.5 ${on ? 'border-transparent bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300'}`}>
                {on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[slotOf(s.id)] }} />}{s.name}
              </button>
            );
          })}
        </div>
      </Card>
      {selected.length < 2 ? <p className="glass-card p-6 text-sm text-gray-500 text-center">Pick at least two schools.</p> : (
        <>
          <div className="flex justify-end"><Button size="sm" variant="secondary" onClick={() => setAsTable(!asTable)}>{asTable ? <><LineIcon size={13} className="mr-1.5" />Charts</> : <><Table2 size={13} className="mr-1.5" />Table</>}</Button></div>
          {asTable ? (
            <div className="glass-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><th className="p-2 text-left text-xs uppercase text-gray-500">School</th>{COMPARE_METRICS.map(([, l]) => <th key={l} className="p-2 text-left text-xs uppercase text-gray-500">{l}</th>)}</tr></thead>
                <tbody>{selected.map((id) => <tr key={id} className="border-t border-gray-100 dark:border-white/5"><td className="p-2 font-medium">{name(id)}</td>{COMPARE_METRICS.map(([k, , u]) => <td key={k} className="p-2 tabular-nums">{fmt(current(id, k), u)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {COMPARE_METRICS.map(([k, l, u]) => {
                const b = bench?.benchmarks.find((x) => x.key === k);
                const bars = selected.map((id) => ({ name: name(id), v: current(id, k), fill: colors[slotOf(id)]! }));
                return (
                  <Card key={k} title={l} sub={b ? `Shaded: the typical range (p25–p75) across ${b.participants} sharing schools.` : 'This period, then month by month.'}>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
                          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={u === 'percent' ? [0, 100] : [0, 'auto']} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} tickLine={false} axisLine={false} />
                          {b && <ReferenceArea x1={b.p25} x2={b.p75} fillOpacity={0.12} />}
                          <Tooltip cursor={{ fillOpacity: 0.08 }} formatter={(v) => [fmt((v as number) ?? null, u), l]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Bar dataKey="v" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                            {bars.map((x) => <CellFill key={x.name} fill={x.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-40 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData(k)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid vertical={false} strokeOpacity={0.15} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {selected.map((id) => <Line key={id} type="monotone" dataKey={name(id)} stroke={colors[slotOf(id)]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

