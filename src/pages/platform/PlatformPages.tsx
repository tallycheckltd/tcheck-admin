import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { School, Users, Radio, LifeBuoy, Battery, Download, Plus, ShieldCheck } from 'lucide-react';
import { MetricList, fmt, type Metric } from '../../components/analytics/MetricList';

/**
 * P10 (A7.1/A7.2) — the watchtower. Numbers about tenants only; no page here shows a person.
 * The Super Admin's own area: tenant pages are refused by the API (server/src/middleware/platformGate.ts).
 */

const H = ({ title, sub }: { title: string; sub: string }) => (
  <div>
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
    <p className="text-gray-500 dark:text-gray-400 mt-1">{sub}</p>
  </div>
);
const table = 'w-full text-sm';
const th = 'text-left text-xs uppercase text-gray-500 p-3';
const td = 'p-3 border-t border-gray-100 dark:border-white/5 align-top';

interface Home { tenants: number; activeStudents: { seat: number; usage30d: number; definitions: { seat: string; usage: string } }; checkInsToday: number; openSupportTickets: number; beaconsNeedingAttention: number }
export function PlatformHomePage() {
  const { data } = useApi<Home>('/platform/home', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  return (
    <div className="space-y-6" data-testid="platform-home">
      <H title="Watchtower" sub="Fleet-wide health across every institution — counts only, never a person's record." />
      {!data ? <p className="text-sm text-gray-500">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard title="Tenants" value={data.tenants} icon={<School size={22} />} color="blue" size="compact" />
            <StatCard title="Active students (seat)" value={data.activeStudents.seat} icon={<Users size={22} />} color="purple" size="compact" />
            <StatCard title="Check-ins today" value={data.checkInsToday} icon={<Radio size={22} />} color="green" size="compact" />
            <StatCard title="Open support tickets" value={data.openSupportTickets} icon={<LifeBuoy size={22} />} color="orange" size="compact" />
            <StatCard title="Beacons needing attention" value={data.beaconsNeedingAttention} icon={<Battery size={22} />} color="red" size="compact" />
          </div>
          <p className="text-xs text-gray-500">Active student (seat): {data.activeStudents.definitions.seat}. Usage-based, last 30 days: {data.activeStudents.usage30d} — {data.activeStudents.definitions.usage}. Job health and app versions in the field are not recorded yet.</p>
        </>
      )}
    </div>
  );
}

interface Tenant {
  id: string; name: string; code: string; attendanceMode: string; features: Record<string, boolean>; deployment: 'SHARED' | 'ISOLATED'; apiBaseUrl: string | null;
  tiers: { t1: boolean; t2: boolean; changedAt: string | null }; onboarding: { completedAt: string | null; windowOpen: boolean };
  integrations: { total: number; failed: number; providers: string[] }; accounts: number;
}
interface Group { institution: { id: string; name: string } | null; tenants: Tenant[] }
export function PlatformInstitutionsPage() {
  const { data, refetch } = useApi<{ groups: Group[] }>('/platform/institutions');
  const [wizard, setWizard] = useState(false);
  const setTiers = async (t: Tenant, tiers: { t1: boolean; t2: boolean }) => { await api.put(`/platform/tenants/${t.id}/tiers`, tiers); refetch(); };
  return (
    <div className="space-y-6" data-testid="platform-institutions">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <H title="Institutions" sub="Tenants grouped by institution: type, features, data tiers, deployment, onboarding, integration health." />
        <div className="flex gap-2">
          <Link to="/platform/schools"><Button variant="secondary">Edit tenant settings</Button></Link>
          <Button onClick={() => setWizard(true)} data-testid="new-institution"><Plus size={16} className="inline mr-1" />New institution</Button>
        </div>
      </div>
      {(data?.groups ?? []).map((g, i) => (
        <section key={g.institution?.id ?? `none-${i}`} className="glass-card overflow-x-auto">
          <h2 className="font-semibold p-4 pb-0">{g.institution?.name ?? 'No institution group'}</h2>
          <table className={table}>
            <thead><tr><th className={th}>Tenant</th><th className={th}>Type</th><th className={th}>Deployment</th><th className={th}>T1 / T2</th><th className={th}>Onboarding</th><th className={th}>Integrations</th><th className={th}>Accounts</th></tr></thead>
            <tbody>
              {g.tenants.map((t) => (
                <tr key={t.id} data-testid="tenant-row">
                  <td className={td}><p className="font-medium">{t.name}</p><p className="text-xs text-gray-500">{t.code}</p></td>
                  <td className={td}>{t.features?.execEdSuite ? <Badge color="purple">Executive Education</Badge> : t.attendanceMode === 'STAGE_BASED' ? 'Training pipeline' : 'Calendar-based'}</td>
                  <td className={td}>{t.deployment === 'ISOLATED' ? <Badge color="yellow">Isolated</Badge> : 'Shared'}</td>
                  <td className={td}>
                    <label className="mr-3"><input type="checkbox" checked={t.tiers.t1} onChange={(e) => setTiers(t, { t1: e.target.checked, t2: t.tiers.t2 })} aria-label={`T1 ${t.name}`} /> T1</label>
                    <label><input type="checkbox" checked={t.tiers.t2} onChange={(e) => setTiers(t, { t1: t.tiers.t1, t2: e.target.checked })} aria-label={`T2 ${t.name}`} /> T2</label>
                  </td>
                  <td className={td}>{t.onboarding.completedAt ? <Badge color="green">Complete</Badge> : t.onboarding.windowOpen ? <Badge color="blue">In progress</Badge> : <Badge color="gray">Window closed</Badge>}</td>
                  <td className={td}>{t.integrations.total ? `${t.integrations.providers.join(', ')}${t.integrations.failed ? ` · ${t.integrations.failed} failing` : ''}` : '—'}</td>
                  <td className={td}>{t.accounts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <TenantWizard open={wizard} groups={(data?.groups ?? []).map((g) => g.institution).filter(Boolean) as { id: string; name: string }[]} onClose={() => setWizard(false)} onDone={() => { setWizard(false); refetch(); }} />
    </div>
  );
}

const FEATURES: [string, string][] = [
  ['execEdSuite', 'Executive Education tenant'], ['onboardingJourney', 'Onboarding journey'], ['messaging', 'Messaging'], ['broadcasts', 'Broadcasts'],
  ['anonymousChat', 'Anonymous chat'], ['faceIdCheckIn', 'Face ID check-in'], ['biometricStrictMode', 'Strict biometric mode'], ['dwellTimeTracking', 'Dwell time'],
];
/** A7.4 — five steps: institution, type & features, data tiers, first School Admin (invite), done. */
function TenantWizard({ open, groups, onClose, onDone }: { open: boolean; groups: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ name: '', code: '', color: '#2563eb', group: '', newGroup: '', isolated: false, apiBaseUrl: '', attendanceMode: 'CALENDAR_BASED', features: {} as Record<string, boolean>, t1: false, t2: false, firstName: '', lastName: '', email: '' });
  const [result, setResult] = useState<{ invite?: { devLink?: string; emailed?: boolean } } | null>(null);
  const { mutate, loading, error } = useMutation<{ invite?: { devLink?: string; emailed?: boolean } }>('post');
  const submit = async () => {
    const r = await mutate('/platform/tenants', {
      name: f.name, code: f.code, color: f.color,
      institutionId: f.group && f.group !== '__new__' ? f.group : null, newInstitutionName: f.group === '__new__' ? f.newGroup : null,
      apiBaseUrl: f.isolated ? f.apiBaseUrl || null : null, attendanceMode: f.attendanceMode, features: f.features,
      analyticsTier1: f.t1, analyticsTier2: f.t2, admin: { firstName: f.firstName, lastName: f.lastName, email: f.email },
    });
    if (r) { setResult(r); setStep(5); }
  };
  const close = () => { setStep(1); setResult(null); if (step === 5) onDone(); else onClose(); };
  return (
    <Modal open={open} onClose={close} title={`New institution — step ${step} of 5`}>
      <div className="space-y-3 text-sm" data-testid="tenant-wizard">
        {step === 1 && (<>
          <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <label className="block">Institution group
            <select aria-label="Institution group" className="w-full rounded-lg border px-2 py-2 mt-1 dark:bg-white/5" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
              <option value="">None</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}<option value="__new__">New group…</option>
            </select>
          </label>
          {f.group === '__new__' && <Input label="New group name" value={f.newGroup} onChange={(e) => setF({ ...f, newGroup: e.target.value })} />}
          <label className="flex gap-2 items-center"><input type="checkbox" checked={f.isolated} onChange={(e) => setF({ ...f, isolated: e.target.checked })} /> Isolated deployment (own API)</label>
          {f.isolated && <Input label="API base URL" value={f.apiBaseUrl} onChange={(e) => setF({ ...f, apiBaseUrl: e.target.value })} />}
        </>)}
        {step === 2 && (<>
          <select aria-label="Type" className="w-full rounded-lg border px-2 py-2 dark:bg-white/5" value={f.attendanceMode} onChange={(e) => setF({ ...f, attendanceMode: e.target.value })}>
            <option value="CALENDAR_BASED">Calendar-based</option><option value="STAGE_BASED">Training pipeline</option>
          </select>
          {FEATURES.map(([k, label]) => (
            <label key={k} className="flex gap-2 items-center"><input type="checkbox" checked={!!f.features[k]} onChange={(e) => setF({ ...f, features: { ...f.features, [k]: e.target.checked } })} /> {label}</label>
          ))}
        </>)}
        {step === 3 && (<>
          <p className="text-gray-500">T0 (service & billing counts) is always on. T1 and T2 stay off until the contract allows them.</p>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={f.t1} onChange={(e) => setF({ ...f, t1: e.target.checked })} /> T1 — aggregate behaviour</label>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={f.t2} onChange={(e) => setF({ ...f, t2: e.target.checked })} /> T2 — sensitive splits (minimum group size applies)</label>
        </>)}
        {step === 4 && (<>
          <p className="text-gray-500">The first School Admin sets their own password from an invite link — no password here.</p>
          <Input label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          <Input label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          <Input label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </>)}
        {step === 5 && (
          <div data-testid="wizard-done">
            <p className="font-medium">Created. The tenant now appears in Onboarding with its checklist.</p>
            <p className="text-gray-500">{result?.invite?.emailed ? 'The invite was emailed.' : 'Email is not configured here — the invite link:'}</p>
            {result?.invite?.devLink && <code className="block break-all text-xs mt-1">{result.invite.devLink}</code>}
          </div>
        )}
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex justify-between">
          {step > 1 && step < 5 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
          {step < 4 && <Button disabled={step === 1 && (!f.name || !f.code)} onClick={() => setStep(step + 1)}>Next</Button>}
          {step === 4 && <Button data-testid="wizard-create" disabled={loading || !f.firstName || !f.lastName || !f.email} onClick={submit}>Create institution</Button>}
          {step === 5 && <Button onClick={close}>Done</Button>}
        </div>
      </div>
    </Modal>
  );
}

interface Billing { from: string; to: string; definitions: { seat: string; usage: string }; rows: { schoolId: string; name: string; code: string; institution: string | null; seat: number; usage: number }[] }
export function PlatformBillingPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const qs = `from=${from}&to=${to}T23:59:59`;
  const { data } = useApi<Billing>(`/platform/billing?${qs}`);
  const exportCsv = async () => {
    const token = localStorage.getItem('accessToken');
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
    const r = await fetch(`${base}/platform/billing?${qs}&format=csv`, { headers: { Authorization: `Bearer ${token}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = `billing-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-6" data-testid="platform-billing">
      <H title="Billing" sub="Active students per tenant for the period — both definitions; bill on the one pricing chooses." />
      <div className="flex gap-3 items-center text-sm flex-wrap">
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded-lg border px-2 py-1 dark:bg-white/5" /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded-lg border px-2 py-1 dark:bg-white/5" /></label>
        <Button variant="secondary" size="sm" onClick={exportCsv}><Download size={14} className="inline mr-1" />Export CSV</Button>
      </div>
      {data && <p className="text-xs text-gray-500">Seat: {data.definitions.seat}. Usage: {data.definitions.usage}.</p>}
      <div className="glass-card overflow-x-auto">
        <table className={table}>
          <thead><tr><th className={th}>Tenant</th><th className={th}>Institution group</th><th className={th}>Seat-based</th><th className={th}>Usage-based</th></tr></thead>
          <tbody>{(data?.rows ?? []).map((r) => <tr key={r.schoolId}><td className={td}>{r.name} <span className="text-xs text-gray-500">{r.code}</span></td><td className={td}>{r.institution ?? '—'}</td><td className={td}>{r.seat}</td><td className={td}>{r.usage}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

interface Fleet { lowBatteryAt: number; silentAfterHours: number; rows: { schoolId: string; name: string; code: string; beacons: { total: number; healthy: number; lowBattery: number; silent: number } }[] }
export function PlatformFleetPage() {
  const { data } = useApi<Fleet>('/platform/fleet');
  // P12 (A7.6) — the intelligence feed as counts per tenant (tenants keep beacon names to themselves).
  const { data: ins } = useApi<{ tenantsData: { tenantId: string; tenant: string; metrics: Metric[] }[] }>('/platform/fleet/insights');
  return (
    <div className="space-y-6" data-testid="platform-fleet">
      <H title="Fleet health" sub="Beacon fleet per tenant. Tenants keep their own Aura Health page; the platform sees aggregates and escalated tickets." />
      {data && <p className="text-xs text-gray-500">Low battery: ≤ {data.lowBatteryAt} %. Silent: not seen for {data.silentAfterHours} h (P12 refines this to class days).</p>}
      <div className="glass-card overflow-x-auto">
        <table className={table}>
          <thead><tr><th className={th}>Tenant</th><th className={th}>Beacons</th><th className={th}>Healthy</th><th className={th}>Low battery</th><th className={th}>Silent</th></tr></thead>
          <tbody>{(data?.rows ?? []).map((r) => <tr key={r.schoolId}><td className={td}>{r.name}</td><td className={td}>{r.beacons.total}</td><td className={td}>{r.beacons.healthy}</td><td className={td}>{r.beacons.lowBattery ? <Badge color="red">{r.beacons.lowBattery}</Badge> : 0}</td><td className={td}>{r.beacons.silent ? <Badge color="yellow">{r.beacons.silent}</Badge> : 0}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="glass-card overflow-x-auto" data-testid="fleet-insights">
        <h2 className="font-semibold p-4 pb-0">Outlook — battery swaps due, classes at risk, attendance during outages</h2>
        <table className={table}>
          <thead><tr><th className={th}>Tenant</th><th className={th}>Swaps due ≤ 30 days</th><th className={th}>Classes at risk (7 days)</th><th className={th}>Attendance during outages</th></tr></thead>
          <tbody>{(ins?.tenantsData ?? []).map((t) => <tr key={t.tenantId}><td className={td}>{t.tenant}</td>{t.metrics.map((m) => <td key={m.key} className={td}>{fmt(m.value, m.unit)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

interface Onb { rows: { schoolId: string; name: string; code: string; createdAt: string; completedAt: string | null; windowOpen: boolean; activation: { roster: number; claimed: number; firstCheckIn: number }; checklist: { key: string; label: string; done: boolean }[] }[] }
export function PlatformOnboardingPage() {
  const { data } = useApi<Onb>('/platform/onboarding');
  return (
    <div className="space-y-6" data-testid="platform-onboarding">
      <H title="Onboarding" sub="Each tenant's setup checklist and activation: roster → claimed → first check-in. Institution Setup is open to the platform only during the onboarding window." />
      <div className="glass-card overflow-x-auto">
        <table className={table}>
          <thead><tr><th className={th}>Tenant</th><th className={th}>Checklist</th><th className={th}>Roster → claimed → first check-in</th><th className={th}>Setup window</th></tr></thead>
          <tbody>{(data?.rows ?? []).map((r) => (
            <tr key={r.schoolId}>
              <td className={td}>{r.name}<p className="text-xs text-gray-500">since {r.createdAt.slice(0, 10)}</p></td>
              <td className={td}>{r.checklist.filter((c) => c.done).length}/{r.checklist.length}<p className="text-xs text-gray-500">{r.checklist.filter((c) => !c.done).map((c) => c.label).join(', ') || 'All done'}</p></td>
              <td className={td}>{r.activation.roster} → {r.activation.claimed} → {r.activation.firstCheckIn}</td>
              <td className={td}>{r.completedAt ? <Badge color="green">Complete</Badge> : r.windowOpen ? <Badge color="blue">Open</Badge> : <Badge color="gray">Closed</Badge>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

interface Grant { id: string; scope: 'ACCOUNT' | 'SETUP'; reason: string; hours: number; state: string; createdAt: string; expiresAt: string | null; school: { id: string; name: string } }
export function PlatformGrantsPage() {
  const { data, refetch } = useApi<Grant[]>('/platform/support-grants');
  const { data: schools } = useApi<{ id: string; name: string }[]>('/schools');
  const { mutate, loading, error } = useMutation('post');
  const [f, setF] = useState({ schoolId: '', scope: 'ACCOUNT', targetEmail: '', reason: '', hours: '24' });
  const request = async () => {
    const ok = await mutate('/platform/support-grants', { schoolId: f.schoolId, scope: f.scope, targetEmail: f.scope === 'ACCOUNT' ? f.targetEmail : undefined, reason: f.reason, hours: Number(f.hours) });
    if (ok) { setF({ ...f, targetEmail: '', reason: '' }); refetch(); }
  };
  return (
    <div className="space-y-6" data-testid="platform-grants">
      <H title="Support access" sub="Time-boxed access to one tenant, approved by its School Admin, audited action by action. Nothing opens until they approve; it ends on its own." />
      <section className="glass-card p-4 space-y-3 text-sm">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck size={16} /> Ask an institution for access</h2>
        <div className="grid md:grid-cols-5 gap-2">
          <select aria-label="Institution" className="rounded-lg border px-2 py-2 dark:bg-white/5" value={f.schoolId} onChange={(e) => setF({ ...f, schoolId: e.target.value })}>
            <option value="">Institution…</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select aria-label="Scope" className="rounded-lg border px-2 py-2 dark:bg-white/5" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
            <option value="ACCOUNT">One account</option><option value="SETUP">Institution Setup</option>
          </select>
          {f.scope === 'ACCOUNT' ? <input aria-label="Account email" placeholder="Account email" className="rounded-lg border px-2 py-2 dark:bg-white/5" value={f.targetEmail} onChange={(e) => setF({ ...f, targetEmail: e.target.value })} /> : <span />}
          <input aria-label="Reason" placeholder="Reason (ticket, what for)" className="rounded-lg border px-2 py-2 dark:bg-white/5" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <select aria-label="Hours" className="rounded-lg border px-2 py-2 dark:bg-white/5" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })}>
            {['1', '4', '24', '48', '72'].map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <Button size="sm" disabled={loading || !f.schoolId || f.reason.trim().length < 5 || (f.scope === 'ACCOUNT' && !f.targetEmail)} onClick={request}>Send request</Button>
      </section>
      <div className="glass-card overflow-x-auto">
        <table className={table}>
          <thead><tr><th className={th}>Institution</th><th className={th}>Scope</th><th className={th}>Reason</th><th className={th}>State</th><th className={th}>Ends</th><th className={th} /></tr></thead>
          <tbody>{(data ?? []).map((g) => (
            <tr key={g.id} data-testid="grant-row">
              <td className={td}>{g.school.name}</td><td className={td}>{g.scope === 'ACCOUNT' ? 'One account' : 'Setup'}</td><td className={td}>{g.reason}</td>
              <td className={td}><Badge color={g.state === 'ACTIVE' ? 'green' : g.state === 'PENDING' ? 'blue' : 'gray'}>{g.state.toLowerCase()}</Badge></td>
              <td className={td}>{g.expiresAt ? new Date(g.expiresAt).toLocaleString() : '—'}</td>
              <td className={td}>{g.state === 'ACTIVE' && <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/platform/support-grants/${g.id}/revoke`, {}); refetch(); }}>End now</Button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

interface Agg { tenantId: string; tenant: string; tiers?: { t0: boolean; t1: boolean; t2: boolean }; status?: string }
/** One tenant's metrics, loaded when its row is opened (the overview itself stays light). */
function TenantMetrics({ id }: { id: string }) {
  const { data, loading } = useApi<{ metrics?: Metric[]; status?: string }>(`/platform/analytics/tenants/${id}`);
  if (loading && !data) return <p className="text-sm text-gray-500 mt-3">Loading…</p>;
  if (!data?.metrics) return <p className="text-sm text-gray-500 mt-3">This tenant's deployment could not be reached.</p>;
  return <div className="mt-3"><MetricList metrics={data.metrics} /></div>;
}
/** P11 (A7.3) — tiered aggregates: platform-wide rollup, and each tenant's metrics for the tiers it shares. */
export function PlatformAnalyticsPage() {
  const { data, refetch } = useApi<{ rollup: { key: string; label: string; unit: string; value: number | null; n: number }[]; tenantsData: Agg[] }>('/platform/analytics');
  const [open, setOpen] = useState('');
  const snapshot = async () => { await api.post('/platform/benchmarks/snapshot', {}); refetch(); };
  return (
    <div className="space-y-6" data-testid="platform-analytics">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <H title="Analytics" sub="Tiered aggregates from the aggregation layer: T0 for every tenant, T1/T2 only where the tenant switched them on. Numbers about groups — never a person." />
        <Button variant="secondary" size="sm" onClick={snapshot}>Take benchmark snapshot</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="rollup">
        {(data?.rollup ?? []).map((r) => (
          <div key={r.key} className="glass-card p-3"><p className="text-xs text-gray-500">{r.label}</p><p className="text-xl font-bold">{fmt(r.value, r.unit)}</p><p className="text-xs text-gray-500">{r.n} tenants</p></div>
        ))}
      </div>
      {(data?.tenantsData ?? []).map((t) => (
        <section key={t.tenantId} className="glass-card p-4" data-testid="tenant-analytics">
          <button className="w-full flex justify-between items-center cursor-pointer" onClick={() => setOpen(open === t.tenantId ? '' : t.tenantId)}>
            <span className="font-semibold">{t.tenant}</span>
            <span className="text-xs text-gray-500">{t.status === 'unreachable' ? 'isolated deployment unreachable' : `T0${t.tiers?.t1 ? ' · T1' : ''}${t.tiers?.t2 ? ' · T2' : ''}`}</span>
          </button>
          {open === t.tenantId && t.status !== 'unreachable' && <TenantMetrics id={t.tenantId} />}
        </section>
      ))}
    </div>
  );
}
