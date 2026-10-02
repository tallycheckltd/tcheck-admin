import { useApi } from '../../hooks/useApi';
import { clsx } from 'clsx';
import { Wifi, CheckCircle2, Battery, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, Tile } from '../../components/insights/InsightsUi';
import { PageHeader, Avatar, Status, StackBar, Placeholder, Skeleton, thCls, tdCls } from '../../components/platform/PlatformUi';
import { fmt, type Metric } from '../../components/analytics/MetricList';

/**
 * P10 (A7.1/A7.2) — the watchtower. Numbers about tenants only; no page here shows a person.
 * The Super Admin's own area: tenant pages are refused by the API (server/src/middleware/platformGate.ts).
 */


// UAT §1 — Home lives in HomePage.tsx.
export { PlatformHomePage } from './HomePage';

// UAT §2 — Institutions (grouped list, tenant page, wizard) live in InstitutionsArea.tsx.
export { PlatformInstitutionsPage, PlatformTenantPage } from './InstitutionsArea';

// UAT §6 — Billing lives in BillingPage.tsx.
export { PlatformBillingPage } from './BillingPage';

interface Fleet { lowBatteryAt: number; silentRule: string; rows: { schoolId: string; name: string; code: string; isolated?: boolean; beacons: { total: number; healthy: number; lowBattery: number; silent: number; neverSeen?: number; lastSeenAt?: string | null } }[] }
export function PlatformFleetPage() {
  const { data } = useApi<Fleet>('/platform/fleet');
  // P12 (A7.6) — the intelligence feed as counts per tenant (tenants keep beacon names to themselves).
  const { data: ins } = useApi<{ tenantsData: { tenantId: string; tenant: string; metrics: Metric[] }[] }>('/platform/fleet/insights');
  const connected = (data?.rows ?? []).filter((r) => !r.isolated);
  const tot = connected.reduce((a, r) => ({ total: a.total + r.beacons.total, healthy: a.healthy + r.beacons.healthy, low: a.low + r.beacons.lowBattery, silent: a.silent + r.beacons.silent, never: a.never + (r.beacons.neverSeen ?? 0) }), { total: 0, healthy: 0, low: 0, silent: 0, never: 0 });
  const problems = (r: Fleet['rows'][number]) => r.beacons.lowBattery + r.beacons.silent + (r.beacons.neverSeen ?? 0);
  const rows = [...(data?.rows ?? [])].sort((a, b) => Number(!!a.isolated) - Number(!!b.isolated) || problems(b) - problems(a) || b.beacons.total - a.beacons.total);
  const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-fleet">
      <PageHeader title="Fleet health" subtitle="Beacon fleet per tenant. Tenants keep their own Aura Health page; the platform sees aggregates and escalated tickets." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile label="Beacons" value={data ? tot.total.toLocaleString() : '—'} icon={<Wifi size={18} />} color="blue" basis={data ? `${connected.length} connected tenants` : undefined} />
        <Tile label="Healthy" value={data ? `${pctOf(tot.healthy, tot.total)}%` : '—'} icon={<CheckCircle2 size={18} />} color="green" basis={data ? `${tot.healthy} of ${tot.total}` : undefined} />
        <Tile label="Low battery" value={data ? String(tot.low) : '—'} icon={<Battery size={18} />} color="red" basis={data ? `≤ ${data.lowBatteryAt}% battery` : undefined} />
        <Tile label="Silent today" value={data ? String(tot.silent) : '—'} icon={<AlertTriangle size={18} />} color="amber" basis="A class ran in the room; no phone saw it" />
        <Tile label="Never seen" value={data ? String(tot.never) : '—'} icon={<Clock size={18} />} color="purple" basis="Paired but no reading yet" />
      </div>
      {data && <p className="text-xs text-slate-500 dark:text-slate-400">Silent: a class ran in the beacon&apos;s room today and no phone saw it (a beacon in an unused room is never &quot;silent&quot;).</p>}
      <Card title="Per tenant" subtitle="Tenants with the most problems first; isolated deployments last.">
        {!data ? <Skeleton rows={4} /> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead><tr><th className={thCls}>Tenant</th><th className={thCls}>Health</th><th className={clsx(thCls, 'text-right')}>Beacons</th><th className={clsx(thCls, 'text-right')}>Healthy</th><th className={clsx(thCls, 'text-right')}>Low battery</th><th className={clsx(thCls, 'text-right')}>Silent</th><th className={clsx(thCls, 'text-right')}>Never seen</th><th className={thCls}>Last seen</th></tr></thead>
              <tbody>{rows.map((r) => {
                const b = r.beacons;
                return (
                  <tr key={r.schoolId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                    <td className={tdCls}><div className="flex items-center gap-3"><Avatar name={r.name} /><div><p className="font-medium text-slate-900 dark:text-white">{r.name}</p><p className="text-xs text-slate-500 font-mono">{r.code}</p></div></div></td>
                    {r.isolated ? <td className={tdCls} colSpan={7}><Status tone="muted">Isolated deployment — not connected</Status></td> : (
                      <>
                        <td className={clsx(tdCls, 'w-48')}>{b.total ? (
                          <div className="flex items-center gap-2"><StackBar label={r.name} parts={[{ name: 'healthy', value: b.healthy, className: 'bg-emerald-500' }, { name: 'low battery', value: b.lowBattery, className: 'bg-rose-500' }, { name: 'silent', value: b.silent, className: 'bg-amber-500' }, { name: 'never seen', value: b.neverSeen ?? 0, className: 'bg-purple-400' }]} /><span className="text-xs tabular-nums w-9 text-right">{pctOf(b.healthy, b.total)}%</span></div>
                        ) : <span className="text-slate-400">No beacons</span>}</td>
                        <td className={clsx(tdCls, 'text-right tabular-nums')}>{b.total || '—'}</td>
                        <td className={clsx(tdCls, 'text-right tabular-nums')}>{b.total ? b.healthy : '—'}</td>
                        <td className={clsx(tdCls, 'text-right')}>{b.lowBattery ? <Badge color="red">{b.lowBattery}</Badge> : <span className="text-slate-400">{b.total ? 0 : '—'}</span>}</td>
                        <td className={clsx(tdCls, 'text-right')}>{b.silent ? <Badge color="yellow">{b.silent}</Badge> : <span className="text-slate-400">{b.total ? 0 : '—'}</span>}</td>
                        <td className={clsx(tdCls, 'text-right tabular-nums')}>{b.neverSeen ? b.neverSeen : <span className="text-slate-400">{b.total ? 0 : '—'}</span>}</td>
                        <td className={clsx(tdCls, 'text-xs whitespace-nowrap')}>{b.lastSeenAt ? new Date(b.lastSeenAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                      </>
                    )}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Outlook" subtitle="Battery swaps due, classes at risk and attendance during outages.">
        <div className="overflow-x-auto -mx-5" data-testid="fleet-insights">
          <table className="w-full">
            <thead><tr><th className={thCls}>Tenant</th><th className={clsx(thCls, 'text-right')}>Swaps due ≤ 30 days</th><th className={clsx(thCls, 'text-right')}>Classes at risk (7 days)</th><th className={clsx(thCls, 'text-right')}>Attendance during outages</th></tr></thead>
            <tbody>{(ins?.tenantsData ?? []).map((t) => <tr key={t.tenantId}><td className={tdCls}><span className="font-medium text-slate-900 dark:text-white">{t.tenant}</span></td>{t.metrics.map((m) => <td key={m.key} className={clsx(tdCls, 'text-right tabular-nums')}>{fmt(m.value, m.unit)}</td>)}</tr>)}</tbody>
          </table>
          {ins && ins.tenantsData.length === 0 && <Placeholder icon={<CheckCircle2 size={20} />} title="Nothing on the horizon" />}
        </div>
      </Card>
    </div>
  );
}

// UAT §5 — the Onboarding page lives in OnboardingPage.tsx.
export { PlatformOnboardingPage } from './OnboardingPage';

// UAT F6 — Support access lives in SupportAccessPages.tsx.
export { PlatformGrantsPage, PlatformSupportSessionPage } from './SupportAccessPages';

// UAT §9 — Analytics lives in AnalyticsPage.tsx.
export { PlatformAnalyticsPage } from './AnalyticsPage';
