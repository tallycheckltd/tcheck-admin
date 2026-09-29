import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  School, Users, Radio, LifeBuoy, Battery, Download, Plus, ShieldCheck, Building2, Search, ChevronDown,
  Activity, Wifi, AlertTriangle, CheckCircle2, Clock, Layers, BarChart3, Camera, KeyRound, ArrowRight, Server,
} from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { GlassCard } from '../../components/ui/GlassCard';
import { Card, Tile } from '../../components/insights/InsightsUi';
import { MetricList, fmt, type Metric } from '../../components/analytics/MetricList';
import {
  PageHeader, Switch, Avatar, Segmented, Status, StackBar, Stepper, Placeholder, Skeleton, Figure, SummaryStrip,
  inputCls, labelCls, thCls, tdCls,
} from '../../components/platform/PlatformUi';

/**
 * P10 (A7.1/A7.2) — the Watchtower. Numbers about tenants only; no page here shows a person.
 * The Super Admin's own area: tenant pages are refused by the API (server/src/middleware/platformGate.ts).
 * 2026-09-29: redesigned in the dashboard's card/tile idiom (components/platform/PlatformUi.tsx).
 */

const n = (v: number) => v.toLocaleString();
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

// ── Home ────────────────────────────────────────────────────────────────────────────────────────
interface Home { tenants: number; activeStudents: { seat: number; usage30d: number; definitions: { seat: string; usage: string } }; checkInsToday: number; openSupportTickets: number; beaconsNeedingAttention: number }
export function PlatformHomePage() {
  const { user } = useAuth();
  const { data } = useApi<Home>('/platform/home', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const { data: inst } = useApi<{ groups: Group[] }>('/platform/institutions');
  const { data: onb } = useApi<Onb>('/platform/onboarding');
  const tenants = useMemo(() => (inst?.groups ?? []).flatMap((g) => g.tenants), [inst]);
  const failing = tenants.filter((t) => t.integrations.failed > 0);
  const onboarding = (onb?.rows ?? []).filter((r) => !r.completedAt);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const attention = [
    data?.beaconsNeedingAttention ? { to: '/platform/fleet', icon: <Battery size={16} />, text: `${data.beaconsNeedingAttention} beacon${data.beaconsNeedingAttention === 1 ? '' : 's'} need attention`, tone: 'bad' as const } : null,
    data?.openSupportTickets ? { to: '/platform/support', icon: <LifeBuoy size={16} />, text: `${data.openSupportTickets} open support ticket${data.openSupportTickets === 1 ? '' : 's'}`, tone: 'warn' as const } : null,
    failing.length ? { to: '/platform/institutions', icon: <AlertTriangle size={16} />, text: `${failing.length} tenant${failing.length === 1 ? ' has' : 's have'} a failing integration`, tone: 'warn' as const } : null,
    onboarding.length ? { to: '/platform/onboarding', icon: <Clock size={16} />, text: `${onboarding.length} tenant${onboarding.length === 1 ? ' is' : 's are'} still onboarding`, tone: 'info' as const } : null,
  ].filter(Boolean) as { to: string; icon: ReactNode; text: string; tone: 'bad' | 'warn' | 'info' }[];
  const types = {
    exec: tenants.filter((t) => t.features?.execEdSuite).length,
    pipeline: tenants.filter((t) => !t.features?.execEdSuite && t.attendanceMode === 'STAGE_BASED').length,
    calendar: tenants.filter((t) => !t.features?.execEdSuite && t.attendanceMode !== 'STAGE_BASED').length,
    isolated: tenants.filter((t) => t.deployment === 'ISOLATED').length,
  };
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-home">
      <PageHeader
        title={`${greet}${user?.firstName ? `, ${user.firstName}` : ''}`}
        subtitle="Fleet-wide health across every institution — counts only, never a person's record."
        actions={<>
          <Link to="/platform/institutions"><Button variant="secondary"><Building2 size={16} className="inline mr-1.5" />Institutions</Button></Link>
          <Link to="/platform/billing"><Button variant="secondary"><Download size={16} className="inline mr-1.5" />Billing</Button></Link>
        </>}
      />
      {!data ? <Skeleton rows={2} /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Link to="/platform/institutions" className="block"><Tile label="Tenants" value={n(data.tenants)} icon={<School size={18} />} color="blue" basis={inst ? `${inst.groups.length} institution group${inst.groups.length === 1 ? '' : 's'}` : undefined} hint="Institutions" /></Link>
            <Link to="/platform/billing" className="block"><Tile label="Active students" value={n(data.activeStudents.seat)} icon={<Users size={18} />} color="purple" basis={`${n(data.activeStudents.usage30d)} used the app in 30 days`} hint="Billing" /></Link>
            <Tile label="Check-ins today" value={n(data.checkInsToday)} icon={<Radio size={18} />} color="green" basis="Across all tenants" />
            <Link to="/platform/support" className="block"><Tile label="Open support tickets" value={n(data.openSupportTickets)} icon={<LifeBuoy size={18} />} color="amber" hint="Support" /></Link>
            <Link to="/platform/fleet" className="block"><Tile label="Beacons needing attention" value={n(data.beaconsNeedingAttention)} icon={<Battery size={18} />} color="red" hint="Fleet" /></Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="Needs attention" subtitle="Everything that wants a look today, in one place." className="lg:col-span-2" accent={attention.length ? 'attention' : undefined}>
              {attention.length === 0 ? (
                <Placeholder icon={<CheckCircle2 size={20} />} title="All clear">No beacon, support, integration or onboarding item needs attention right now.</Placeholder>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-white/5 -mx-5">
                  {attention.map((a) => (
                    <li key={a.to}>
                      <Link to={a.to} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                        <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          a.tone === 'bad' ? 'bg-rose-500/10 text-rose-600' : a.tone === 'warn' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600')}>{a.icon}</span>
                        <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{a.text}</span>
                        <ArrowRight size={16} className="text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Tenant mix" subtitle="What kinds of institutions are on the platform.">
              <div className="space-y-3">
                {[
                  { label: 'Calendar-based', v: types.calendar, cls: 'bg-blue-500' },
                  { label: 'Executive Education', v: types.exec, cls: 'bg-purple-500' },
                  { label: 'Training pipeline', v: types.pipeline, cls: 'bg-cyan-500' },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-sm"><span className="text-slate-700 dark:text-slate-300">{r.label}</span><span className="tabular-nums font-medium text-slate-900 dark:text-white">{r.v}</span></div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div className={clsx('h-1.5 rounded-full', r.cls)} style={{ width: `${pct(r.v, tenants.length)}%` }} /></div>
                  </div>
                ))}
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1"><Server size={12} className="inline mr-1" />{types.isolated} on an isolated deployment (own API), {tenants.length - types.isolated} shared.</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { to: '/platform/institutions', icon: <Plus size={18} />, title: 'New institution', text: 'Five-step wizard, first School Admin by invite.' },
              { to: '/platform/grants', icon: <KeyRound size={18} />, title: 'Support access', text: 'Ask an institution for time-boxed access.' },
              { to: '/platform/analytics', icon: <BarChart3 size={18} />, title: 'Analytics', text: 'Tiered aggregates and benchmarks.' },
              { to: '/platform/onboarding', icon: <Layers size={18} />, title: 'Onboarding', text: 'Checklists and activation per tenant.' },
            ].map((q) => (
              <Link key={q.to + q.title} to={q.to} className="block group">
                <GlassCard className="!p-5 h-full transition-shadow group-hover:shadow-lg">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400">{q.icon}</span>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{q.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{q.text}</p>
                </GlassCard>
              </Link>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Active student (seat): {data.activeStudents.definitions.seat}. Usage-based: {data.activeStudents.definitions.usage}.</p>
        </>
      )}
    </div>
  );
}

// ── Institutions ─────────────────────────────────────────────────────────────────────────────────
interface Tenant {
  id: string; name: string; code: string; attendanceMode: string; features: Record<string, boolean>; deployment: 'SHARED' | 'ISOLATED'; apiBaseUrl: string | null;
  tiers: { t1: boolean; t2: boolean; changedAt: string | null }; onboarding: { completedAt: string | null; windowOpen: boolean };
  integrations: { total: number; failed: number; providers: string[] }; accounts: number;
}
interface Group { institution: { id: string; name: string } | null; tenants: Tenant[] }
type TenantFilter = 'all' | 'exec' | 'calendar' | 'pipeline' | 'isolated' | 'attention';
const kind = (t: Tenant) => (t.features?.execEdSuite ? 'exec' : t.attendanceMode === 'STAGE_BASED' ? 'pipeline' : 'calendar');
const needsAttention = (t: Tenant) => t.integrations.failed > 0 || (!t.onboarding.completedAt && !t.onboarding.windowOpen);

export function PlatformInstitutionsPage() {
  const { data, refetch } = useApi<{ groups: Group[] }>('/platform/institutions');
  const [wizard, setWizard] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<TenantFilter>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const setTiers = async (t: Tenant, tiers: { t1: boolean; t2: boolean }) => { await api.put(`/platform/tenants/${t.id}/tiers`, tiers); refetch(); };
  const all = (data?.groups ?? []).flatMap((g) => g.tenants);
  const match = (t: Tenant) => (!q || `${t.name} ${t.code}`.toLowerCase().includes(q.toLowerCase()))
    && (filter === 'all' || (filter === 'isolated' ? t.deployment === 'ISOLATED' : filter === 'attention' ? needsAttention(t) : kind(t) === filter));
  // One "No institution group" bucket (the API returns ungrouped tenants one per row), named groups A–Z first.
  const merged = useMemo(() => {
    const named = (data?.groups ?? []).filter((g) => g.institution).sort((x, y) => x.institution!.name.localeCompare(y.institution!.name));
    const loose = (data?.groups ?? []).filter((g) => !g.institution).flatMap((g) => g.tenants);
    return loose.length ? [...named, { institution: null, tenants: loose }] : named;
  }, [data]);
  const groups = merged.map((g) => ({ ...g, tenants: g.tenants.filter(match) })).filter((g) => g.tenants.length);
  const count = (f: TenantFilter) => all.filter((t) => (f === 'all' ? true : f === 'isolated' ? t.deployment === 'ISOLATED' : f === 'attention' ? needsAttention(t) : kind(t) === f)).length;
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-institutions">
      <PageHeader
        title="Institutions"
        subtitle="Tenants grouped by institution: type, deployment, data tiers, onboarding and integration health."
        actions={<>
          <Link to="/platform/schools"><Button variant="secondary">Edit tenant settings</Button></Link>
          <Button onClick={() => setWizard(true)} data-testid="new-institution"><Plus size={16} className="inline mr-1" />New institution</Button>
        </>}
      />
      <SummaryStrip>
        <Figure label="Institution groups" value={data ? data.groups.filter((g) => g.institution).length : '—'} />
        <Figure label="Tenants" value={data ? all.length : '—'} />
        <Figure label="Executive Education" value={data ? count('exec') : '—'} />
        <Figure label="Isolated deployments" value={data ? count('isolated') : '—'} />
        <Figure label="Accounts" value={data ? n(all.reduce((a, t) => a + t.accounts, 0)) : '—'} />
        <Figure label="Need attention" value={data ? count('attention') : '—'} tone={count('attention') ? 'warn' : undefined} />
      </SummaryStrip>
      <GlassCard className="!p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[14rem]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search tenants" placeholder="Search by name or code…" value={q} onChange={(e) => setQ(e.target.value)} className={clsx(inputCls, 'pl-9')} />
          </div>
          <Segmented label="Filter tenants" value={filter} onChange={setFilter} options={[
            { key: 'all', label: 'All', count: count('all') }, { key: 'calendar', label: 'Calendar', count: count('calendar') },
            { key: 'exec', label: 'Exec Ed', count: count('exec') }, { key: 'pipeline', label: 'Pipeline', count: count('pipeline') },
            { key: 'isolated', label: 'Isolated', count: count('isolated') }, { key: 'attention', label: 'Needs attention', count: count('attention') },
          ]} />
        </div>
      </GlassCard>
      {!data ? <GlassCard><Skeleton rows={4} /></GlassCard> : groups.length === 0 ? (
        <GlassCard><Placeholder icon={<Search size={20} />} title="No tenant matches">Try another name, code or filter.</Placeholder></GlassCard>
      ) : groups.map((g, i) => {
        const key = g.institution?.id ?? `none-${i}`;
        const isCollapsed = collapsed[key];
        return (
          <GlassCard key={key} className="!p-0 overflow-hidden">
            <button type="button" onClick={() => setCollapsed({ ...collapsed, [key]: !isCollapsed })} className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer text-left">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400"><Building2 size={18} /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-slate-900 dark:text-white">{g.institution?.name ?? 'No institution group'}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{g.tenants.length} tenant{g.tenants.length === 1 ? '' : 's'} · {n(g.tenants.reduce((a, t) => a + t.accounts, 0))} accounts</span>
              </span>
              <ChevronDown size={18} className={clsx('text-slate-400 transition-transform', isCollapsed && '-rotate-90')} />
            </button>
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/60 dark:bg-white/[0.02]"><tr><th className={thCls}>Tenant</th><th className={thCls}>Type</th><th className={thCls}>Deployment</th><th className={thCls}>Data tiers</th><th className={thCls}>Onboarding</th><th className={thCls}>Integrations</th><th className={clsx(thCls, 'text-right')}>Accounts</th></tr></thead>
                  <tbody>
                    {g.tenants.map((t) => (
                      <tr key={t.id} data-testid="tenant-row" className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                        <td className={tdCls}>
                          <div className="flex items-center gap-3 min-w-[12rem]">
                            <Avatar name={t.name} />
                            <div className="min-w-0"><p className="font-medium text-slate-900 dark:text-white truncate">{t.name}</p><p className="text-xs text-slate-500 font-mono">{t.code}</p></div>
                          </div>
                        </td>
                        <td className={tdCls}>{t.features?.execEdSuite ? <Badge color="purple">Executive Education</Badge> : t.attendanceMode === 'STAGE_BASED' ? <Badge color="blue">Training pipeline</Badge> : <Badge color="gray">Calendar-based</Badge>}</td>
                        <td className={tdCls}>{t.deployment === 'ISOLATED' ? <span title={t.apiBaseUrl ?? undefined}><Badge color="yellow">Isolated</Badge></span> : <span className="text-slate-500">Shared</span>}</td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs font-medium"><Switch label={`T1 ${t.name}`} checked={t.tiers.t1} onChange={(v) => setTiers(t, { t1: v, t2: t.tiers.t2 })} /> T1</label>
                            <label className="flex items-center gap-2 text-xs font-medium"><Switch label={`T2 ${t.name}`} checked={t.tiers.t2} onChange={(v) => setTiers(t, { t1: t.tiers.t1, t2: v })} /> T2</label>
                          </div>
                        </td>
                        <td className={tdCls}>{t.onboarding.completedAt ? <Status tone="ok">Complete</Status> : t.onboarding.windowOpen ? <Status tone="info">In progress</Status> : <Status tone="warn">Window closed</Status>}</td>
                        <td className={tdCls}>{t.integrations.total
                          ? <div className="space-y-0.5"><p className="text-xs">{t.integrations.providers.join(', ')}</p>{t.integrations.failed ? <Status tone="bad">{t.integrations.failed} failing</Status> : <Status tone="ok">Healthy</Status>}</div>
                          : <span className="text-slate-400">—</span>}</td>
                        <td className={clsx(tdCls, 'text-right tabular-nums font-medium')}>{n(t.accounts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        );
      })}
      <TenantWizard open={wizard} groups={(data?.groups ?? []).map((g) => g.institution).filter(Boolean) as { id: string; name: string }[]} onClose={() => setWizard(false)} onDone={() => { setWizard(false); refetch(); }} />
    </div>
  );
}

const FEATURES: [string, string, string][] = [
  ['execEdSuite', 'Executive Education tenant', 'CEMs, delegates, programme welcome, networking'],
  ['onboardingJourney', 'Onboarding journey', 'Guided first-week steps for students'],
  ['messaging', 'Messaging', 'Direct messages between staff and students'],
  ['broadcasts', 'Broadcasts', 'Announcements to cohorts and courses'],
  ['anonymousChat', 'Anonymous chat', 'Campus and course chat rooms'],
  ['faceIdCheckIn', 'Face ID check-in', 'Biometric confirmation at check-in'],
  ['biometricStrictMode', 'Strict biometric mode', 'No selfie fallback; device binding instead'],
  ['dwellTimeTracking', 'Dwell time', 'Require time in the room before check-in'],
];
const STEPS = ['Institution', 'Type & features', 'Data tiers', 'First admin', 'Done'];
/** A7.4 — five steps: institution, type & features, data tiers, first School Admin (invite), done. */
function TenantWizard({ open, groups, onClose, onDone }: { open: boolean; groups: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const blank = { name: '', code: '', color: '#2563eb', group: '', newGroup: '', isolated: false, apiBaseUrl: '', attendanceMode: 'CALENDAR_BASED', features: {} as Record<string, boolean>, t1: false, t2: false, firstName: '', lastName: '', email: '' };
  const [f, setF] = useState(blank);
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
  const close = () => { const wasDone = step === 5; setStep(1); setResult(null); setF(blank); if (wasDone) onDone(); else onClose(); };
  const groupName = f.group === '__new__' ? f.newGroup : groups.find((g) => g.id === f.group)?.name;
  const optionCard = (on: boolean) => clsx('flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors', on ? 'border-blue-500 bg-blue-500/5' : 'border-gray-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20');
  return (
    <Modal open={open} onClose={close} title="New institution">
      <div className="space-y-5 text-sm" data-testid="tenant-wizard">
        <Stepper steps={STEPS} current={step} />
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Strathmore Business School" /></div>
              <Input label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="SBS" />
            </div>
            <div>
              <label htmlFor="wiz-group" className={labelCls}>Institution group</label>
              <select id="wiz-group" aria-label="Institution group" className={inputCls} value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
                <option value="">None</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}<option value="__new__">New group…</option>
              </select>
            </div>
            {f.group === '__new__' && <Input label="New group name" value={f.newGroup} onChange={(e) => setF({ ...f, newGroup: e.target.value })} />}
            <div className="flex items-center gap-3">
              <label htmlFor="wiz-color" className="text-xs font-medium text-slate-600 dark:text-slate-400">Brand colour</label>
              <input id="wiz-color" type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-8 w-12 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent cursor-pointer" />
            </div>
            <label className={optionCard(f.isolated)}>
              <input type="checkbox" className="mt-0.5" checked={f.isolated} onChange={(e) => setF({ ...f, isolated: e.target.checked })} />
              <span><span className="block font-medium text-slate-900 dark:text-white">Isolated deployment (own API)</span><span className="block text-xs text-slate-500">The tenant runs on its own backend; the platform reads aggregates over its API.</span></span>
            </label>
            {f.isolated && <Input label="API base URL" value={f.apiBaseUrl} onChange={(e) => setF({ ...f, apiBaseUrl: e.target.value })} placeholder="https://…/api" />}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label htmlFor="wiz-type" className={labelCls}>Type</label>
              <select id="wiz-type" aria-label="Type" className={inputCls} value={f.attendanceMode} onChange={(e) => setF({ ...f, attendanceMode: e.target.value })}>
                <option value="CALENDAR_BASED">Calendar-based (terms and timetable)</option><option value="STAGE_BASED">Training pipeline (programmes and modules)</option>
              </select>
            </div>
            <p className={labelCls}>Features</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURES.map(([k, label, help]) => (
                <label key={k} className={optionCard(!!f.features[k])}>
                  <input type="checkbox" className="mt-0.5" checked={!!f.features[k]} onChange={(e) => setF({ ...f, features: { ...f.features, [k]: e.target.checked } })} />
                  <span><span className="block font-medium text-slate-900 dark:text-white">{label}</span><span className="block text-xs text-slate-500">{help}</span></span>
                </label>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-slate-500 dark:text-slate-400">T0 (service and billing counts) is always on. T1 and T2 stay off until the contract allows them.</p>
            <label className={optionCard(f.t1)}>
              <input type="checkbox" className="mt-0.5" checked={f.t1} onChange={(e) => setF({ ...f, t1: e.target.checked })} />
              <span><span className="block font-medium text-slate-900 dark:text-white">T1 — aggregate behaviour</span><span className="block text-xs text-slate-500">Attendance, punctuality, check-out completion — shared into benchmarks.</span></span>
            </label>
            <label className={optionCard(f.t2)}>
              <input type="checkbox" className="mt-0.5" checked={f.t2} onChange={(e) => setF({ ...f, t2: e.target.checked })} />
              <span><span className="block font-medium text-slate-900 dark:text-white">T2 — sensitive splits (minimum group size applies)</span><span className="block text-xs text-slate-500">Gender and nationality breakdowns; small groups are withheld.</span></span>
            </label>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-slate-500 dark:text-slate-400">The first School Admin sets their own password from an invite link — no password here.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
              <Input label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
            </div>
            <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Review</p>
              <p><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ backgroundColor: f.color }} />{f.name} <span className="font-mono">({f.code})</span>{groupName ? ` · ${groupName}` : ''}{f.isolated ? ' · isolated' : ''}</p>
              <p>{f.attendanceMode === 'STAGE_BASED' ? 'Training pipeline' : 'Calendar-based'}{Object.entries(f.features).filter(([, v]) => v).length ? ` · ${FEATURES.filter(([k]) => f.features[k]).map(([, l]) => l).join(', ')}` : ''}</p>
              <p>Data tiers: T0{f.t1 ? ', T1' : ''}{f.t2 ? ', T2' : ''}</p>
            </div>
          </div>
        )}
        {step === 5 && (
          <div data-testid="wizard-done" className="text-center py-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={24} /></div>
            <p className="font-semibold text-slate-900 dark:text-white mt-3">Created. The tenant now appears in Onboarding with its checklist.</p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{result?.invite?.emailed ? 'The invite was emailed to the first School Admin.' : 'Email is not configured here — the invite link:'}</p>
            {result?.invite?.devLink && <code className="block break-all text-xs mt-2 rounded-lg bg-slate-50 dark:bg-white/5 p-2 text-left">{result.invite.devLink}</code>}
          </div>
        )}
        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
        <div className="flex justify-between pt-1">
          {step > 1 && step < 5 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
          {step < 4 && <Button disabled={step === 1 && (!f.name || !f.code || (f.group === '__new__' && !f.newGroup))} onClick={() => setStep(step + 1)}>Next</Button>}
          {step === 4 && <Button data-testid="wizard-create" disabled={loading || !f.firstName || !f.lastName || !f.email} onClick={submit}>{loading ? 'Creating…' : 'Create institution'}</Button>}
          {step === 5 && <Button onClick={close}>Done</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ── Billing ──────────────────────────────────────────────────────────────────────────────────────
interface Billing { from: string; to: string; definitions: { seat: string; usage: string }; rows: { schoolId: string; name: string; code: string; institution: string | null; seat: number; usage: number }[] }
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
export function PlatformBillingPage() {
  const now = new Date();
  const periods = [
    { key: 'this', label: 'This month', range: () => [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)] },
    { key: 'last', label: 'Last month', range: () => [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))] },
    { key: 'q', label: 'Last 90 days', range: () => [ymd(new Date(now.getTime() - 89 * 86_400_000)), ymd(now)] },
  ] as const;
  const [[from, to], setRange] = useState<string[]>(periods[0].range() as unknown as string[]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'seat' | 'usage' | 'name'>('seat');
  const qs = `from=${from}&to=${to}T23:59:59`;
  const { data } = useApi<Billing>(`/platform/billing?${qs}`);
  const exportCsv = async () => {
    const token = localStorage.getItem('accessToken');
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
    const r = await fetch(`${base}/platform/billing?${qs}&format=csv`, { headers: { Authorization: `Bearer ${token}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = `billing-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const rows = (data?.rows ?? []).filter((r) => !q || `${r.name} ${r.code} ${r.institution ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b[sort] - a[sort]));
  const seatTotal = (data?.rows ?? []).reduce((a, r) => a + r.seat, 0);
  const usageTotal = (data?.rows ?? []).reduce((a, r) => a + r.usage, 0);
  const maxSeat = Math.max(1, ...(data?.rows ?? []).map((r) => r.seat));
  const active = periods.find((p) => { const [f, t] = p.range(); return f === from && t === to; })?.key ?? '';
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-billing">
      <PageHeader title="Billing" subtitle="Active students per tenant for the period — both definitions; bill on the one pricing chooses."
        actions={<Button variant="secondary" onClick={exportCsv}><Download size={16} className="inline mr-1.5" />Export CSV</Button>} />
      <GlassCard className="!p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Period" value={active as 'this'} onChange={(k) => { const p = periods.find((x) => x.key === k); if (p) setRange(p.range() as unknown as string[]); }} options={periods.map((p) => ({ key: p.key as 'this', label: p.label }))} />
          <input aria-label="From" type="date" value={from} max={to} onChange={(e) => e.target.value && setRange([e.target.value, to])} className={clsx(inputCls, '!w-auto')} />
          <input aria-label="To" type="date" value={to} min={from} onChange={(e) => e.target.value && setRange([from, e.target.value])} className={clsx(inputCls, '!w-auto')} />
          <div className="relative flex-1 min-w-[12rem]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search tenants" placeholder="Search tenants…" value={q} onChange={(e) => setQ(e.target.value)} className={clsx(inputCls, 'pl-9')} />
          </div>
        </div>
      </GlassCard>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label="Seat-based total" value={data ? n(seatTotal) : '—'} icon={<Users size={18} />} color="purple" basis={data?.definitions.seat} />
        <Tile label="Usage-based total" value={data ? n(usageTotal) : '—'} icon={<Activity size={18} />} color="green" basis={data?.definitions.usage} />
        <Tile label="Billable tenants" value={data ? n(data.rows.filter((r) => r.seat > 0).length) : '—'} icon={<School size={18} />} color="blue" basis={data ? `of ${data.rows.length} tenants` : undefined} />
      </div>
      <Card title="Per tenant" subtitle={`${from} → ${to}`} action={
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={clsx(inputCls, '!w-auto !py-1.5')}>
          <option value="seat">Sort: seat-based</option><option value="usage">Sort: usage-based</option><option value="name">Sort: name</option>
        </select>}>
        {!data ? <Skeleton rows={4} /> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead><tr><th className={thCls}>Tenant</th><th className={thCls}>Institution group</th><th className={clsx(thCls, 'text-right')}>Seat-based</th><th className={thCls}>Share</th><th className={clsx(thCls, 'text-right')}>Usage-based</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.schoolId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                  <td className={tdCls}><div className="flex items-center gap-3"><Avatar name={r.name} /><div><p className="font-medium text-slate-900 dark:text-white">{r.name}</p><p className="text-xs text-slate-500 font-mono">{r.code}</p></div></div></td>
                  <td className={tdCls}>{r.institution ?? <span className="text-slate-400">—</span>}</td>
                  <td className={clsx(tdCls, 'text-right tabular-nums font-semibold text-slate-900 dark:text-white')}>{n(r.seat)}</td>
                  <td className={clsx(tdCls, 'w-40')}><div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${pct(r.seat, maxSeat)}%` }} /></div></td>
                  <td className={clsx(tdCls, 'text-right tabular-nums')}>{n(r.usage)}</td>
                </tr>
              ))}</tbody>
            </table>
            {rows.length === 0 && <Placeholder icon={<Search size={20} />} title="No tenant matches" />}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Fleet ────────────────────────────────────────────────────────────────────────────────────────
interface Fleet { lowBatteryAt: number; silentAfterHours: number; rows: { schoolId: string; name: string; code: string; beacons: { total: number; healthy: number; lowBattery: number; silent: number } }[] }
export function PlatformFleetPage() {
  const { data } = useApi<Fleet>('/platform/fleet');
  // P12 (A7.6) — the intelligence feed as counts per tenant (tenants keep beacon names to themselves).
  const { data: ins } = useApi<{ tenantsData: { tenantId: string; tenant: string; metrics: Metric[] }[] }>('/platform/fleet/insights');
  const tot = (data?.rows ?? []).reduce((a, r) => ({ total: a.total + r.beacons.total, healthy: a.healthy + r.beacons.healthy, low: a.low + r.beacons.lowBattery, silent: a.silent + r.beacons.silent }), { total: 0, healthy: 0, low: 0, silent: 0 });
  const rows = [...(data?.rows ?? [])].sort((a, b) => (b.beacons.lowBattery + b.beacons.silent) - (a.beacons.lowBattery + a.beacons.silent) || b.beacons.total - a.beacons.total);
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-fleet">
      <PageHeader title="Fleet health" subtitle="Beacon fleet per tenant. Tenants keep their own Aura Health page; the platform sees aggregates and escalated tickets." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Beacons" value={data ? n(tot.total) : '—'} icon={<Wifi size={18} />} color="blue" basis={data ? `${data.rows.length} tenants` : undefined} />
        <Tile label="Healthy" value={data ? `${pct(tot.healthy, tot.total)}%` : '—'} icon={<CheckCircle2 size={18} />} color="green" basis={data ? `${n(tot.healthy)} of ${n(tot.total)}` : undefined} />
        <Tile label="Low battery" value={data ? n(tot.low) : '—'} icon={<Battery size={18} />} color="red" basis={data ? `≤ ${data.lowBatteryAt}% battery` : undefined} />
        <Tile label="Silent" value={data ? n(tot.silent) : '—'} icon={<AlertTriangle size={18} />} color="amber" basis={data ? `Not seen for ${data.silentAfterHours} h on class days` : undefined} />
      </div>
      <Card title="Per tenant" subtitle="Tenants with the most problems first.">
        {!data ? <Skeleton rows={4} /> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead><tr><th className={thCls}>Tenant</th><th className={thCls}>Health</th><th className={clsx(thCls, 'text-right')}>Beacons</th><th className={clsx(thCls, 'text-right')}>Healthy</th><th className={clsx(thCls, 'text-right')}>Low battery</th><th className={clsx(thCls, 'text-right')}>Silent</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.schoolId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                  <td className={tdCls}><div className="flex items-center gap-3"><Avatar name={r.name} /><span className="font-medium text-slate-900 dark:text-white">{r.name}</span></div></td>
                  <td className={clsx(tdCls, 'w-48')}><StackBar label={r.name} parts={[{ name: 'healthy', value: r.beacons.healthy, className: 'bg-emerald-500' }, { name: 'low battery', value: r.beacons.lowBattery, className: 'bg-rose-500' }, { name: 'silent', value: r.beacons.silent, className: 'bg-amber-500' }]} /></td>
                  <td className={clsx(tdCls, 'text-right tabular-nums')}>{r.beacons.total}</td>
                  <td className={clsx(tdCls, 'text-right tabular-nums')}>{r.beacons.healthy}</td>
                  <td className={clsx(tdCls, 'text-right')}>{r.beacons.lowBattery ? <Badge color="red">{r.beacons.lowBattery}</Badge> : <span className="text-slate-400">0</span>}</td>
                  <td className={clsx(tdCls, 'text-right')}>{r.beacons.silent ? <Badge color="yellow">{r.beacons.silent}</Badge> : <span className="text-slate-400">0</span>}</td>
                </tr>
              ))}</tbody>
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

// ── Onboarding ───────────────────────────────────────────────────────────────────────────────────
interface Onb { rows: { schoolId: string; name: string; code: string; createdAt: string; completedAt: string | null; windowOpen: boolean; activation: { roster: number; claimed: number; firstCheckIn: number }; checklist: { key: string; label: string; done: boolean }[] }[] }
export function PlatformOnboardingPage() {
  const { data } = useApi<Onb>('/platform/onboarding');
  const [filter, setFilter] = useState<'open' | 'all' | 'complete'>('all');
  const all = data?.rows ?? [];
  const rows = all.filter((r) => filter === 'all' || (filter === 'complete' ? !!r.completedAt : !r.completedAt));
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-onboarding">
      <PageHeader title="Onboarding" subtitle="Each tenant's setup checklist and activation: roster → claimed → first check-in. Institution Setup is open to the platform only during the onboarding window." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label="In progress" value={data ? n(all.filter((r) => !r.completedAt && r.windowOpen).length) : '—'} icon={<Clock size={18} />} color="blue" basis="Setup window open" />
        <Tile label="Complete" value={data ? n(all.filter((r) => r.completedAt).length) : '—'} icon={<CheckCircle2 size={18} />} color="green" />
        <Tile label="Window closed, not complete" value={data ? n(all.filter((r) => !r.completedAt && !r.windowOpen).length) : '—'} icon={<AlertTriangle size={18} />} color="amber" basis="Setup needs a support grant now" />
      </div>
      <Card title="Tenants" action={<Segmented label="Show" value={filter} onChange={setFilter} options={[{ key: 'all', label: 'All', count: all.length }, { key: 'open', label: 'Not complete', count: all.filter((r) => !r.completedAt).length }, { key: 'complete', label: 'Complete', count: all.filter((r) => r.completedAt).length }]} />}>
        {!data ? <Skeleton rows={4} /> : rows.length === 0 ? <Placeholder icon={<CheckCircle2 size={20} />} title="Nothing here" /> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead><tr><th className={thCls}>Tenant</th><th className={thCls}>Checklist</th><th className={thCls}>Roster → claimed → first check-in</th><th className={thCls}>Setup window</th></tr></thead>
              <tbody>{rows.map((r) => {
                const done = r.checklist.filter((c) => c.done).length;
                const a = r.activation;
                return (
                  <tr key={r.schoolId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                    <td className={tdCls}><div className="flex items-center gap-3"><Avatar name={r.name} /><div><p className="font-medium text-slate-900 dark:text-white">{r.name}</p><p className="text-xs text-slate-500">since {r.createdAt.slice(0, 10)}</p></div></div></td>
                    <td className={clsx(tdCls, 'min-w-[14rem]')}>
                      <div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/10"><div className={clsx('h-1.5 rounded-full', done === r.checklist.length ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct(done, r.checklist.length)}%` }} /></div><span className="text-xs tabular-nums font-medium">{done}/{r.checklist.length}</span></div>
                      <div className="flex flex-wrap gap-1 mt-1.5">{r.checklist.filter((c) => !c.done).slice(0, 4).map((c) => <span key={c.key} className="text-[11px] rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-slate-600 dark:text-slate-400">{c.label}</span>)}{done === r.checklist.length && <span className="text-xs text-slate-500">All done</span>}</div>
                    </td>
                    <td className={clsx(tdCls, 'min-w-[14rem]')}>
                      <div className="flex items-end gap-1.5 h-9" role="img" aria-label={`${a.roster} on roster, ${a.claimed} claimed, ${a.firstCheckIn} checked in`}>
                        {[{ v: a.roster, c: 'bg-slate-300 dark:bg-white/20', l: 'Roster' }, { v: a.claimed, c: 'bg-blue-500', l: 'Claimed' }, { v: a.firstCheckIn, c: 'bg-emerald-500', l: 'Checked in' }].map((s) => (
                          <div key={s.l} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className={clsx('w-full rounded-sm', s.c)} style={{ height: `${Math.max(3, pct(s.v, Math.max(1, a.roster)) * 0.28)}px` }} />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs tabular-nums text-slate-600 dark:text-slate-400 mt-1">{a.roster} → {a.claimed} → {a.firstCheckIn}</p>
                    </td>
                    <td className={tdCls}>{r.completedAt ? <Status tone="ok">Complete</Status> : r.windowOpen ? <Status tone="info">Open</Status> : <Status tone="warn">Closed</Status>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Support access (grants) ──────────────────────────────────────────────────────────────────────
interface Grant { id: string; scope: 'ACCOUNT' | 'SETUP'; reason: string; hours: number; state: string; createdAt: string; expiresAt: string | null; school: { id: string; name: string } }
export function PlatformGrantsPage() {
  const { data, refetch } = useApi<Grant[]>('/platform/support-grants');
  const { data: schools } = useApi<{ id: string; name: string }[]>('/schools');
  const { mutate, loading, error } = useMutation('post');
  const [f, setF] = useState({ schoolId: '', scope: 'ACCOUNT', targetEmail: '', reason: '', hours: '24' });
  const [tab, setTab] = useState<'live' | 'past'>('live');
  const request = async () => {
    const ok = await mutate('/platform/support-grants', { schoolId: f.schoolId, scope: f.scope, targetEmail: f.scope === 'ACCOUNT' ? f.targetEmail : undefined, reason: f.reason, hours: Number(f.hours) });
    if (ok) { setF({ ...f, targetEmail: '', reason: '' }); refetch(); }
  };
  const live = (data ?? []).filter((g) => g.state === 'ACTIVE' || g.state === 'PENDING');
  const past = (data ?? []).filter((g) => !(g.state === 'ACTIVE' || g.state === 'PENDING'));
  const list = tab === 'live' ? live : past;
  const tone = (s: string) => (s === 'ACTIVE' ? 'ok' : s === 'PENDING' ? 'info' : 'muted') as 'ok' | 'info' | 'muted';
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-grants">
      <PageHeader title="Support access" subtitle="Time-boxed access to one tenant, approved by its School Admin, audited action by action. Nothing opens until they approve; it ends on its own." />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card title="Ask an institution for access" subtitle="The School Admin sees the request on their Support page." className="lg:col-span-3">
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label htmlFor="g-school" className={labelCls}>Institution</label>
                <select id="g-school" aria-label="Institution" className={inputCls} value={f.schoolId} onChange={(e) => setF({ ...f, schoolId: e.target.value })}>
                  <option value="">Choose…</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div><label htmlFor="g-scope" className={labelCls}>Scope</label>
                <select id="g-scope" aria-label="Scope" className={inputCls} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
                  <option value="ACCOUNT">One account</option><option value="SETUP">Institution Setup</option>
                </select></div>
            </div>
            {f.scope === 'ACCOUNT' && <div><label htmlFor="g-email" className={labelCls}>Account email</label><input id="g-email" aria-label="Account email" type="email" placeholder="person@institution.ac.ke" className={inputCls} value={f.targetEmail} onChange={(e) => setF({ ...f, targetEmail: e.target.value })} /></div>}
            <div><label htmlFor="g-reason" className={labelCls}>Reason</label><input id="g-reason" aria-label="Reason" placeholder="Ticket number and what it's for" className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
            <div>
              <p className={labelCls}>Duration</p>
              <Segmented label="Hours" value={f.hours} onChange={(h) => setF({ ...f, hours: h })} options={['1', '4', '24', '48', '72'].map((h) => ({ key: h, label: `${h} h` }))} />
            </div>
            {error && <p className="text-rose-600" role="alert">{error}</p>}
            <Button disabled={loading || !f.schoolId || f.reason.trim().length < 5 || (f.scope === 'ACCOUNT' && !f.targetEmail)} onClick={request}><ShieldCheck size={16} className="inline mr-1.5" />Send request</Button>
          </div>
        </Card>
        <Card title="How it works" className="lg:col-span-2">
          <ol className="space-y-3 text-sm">
            {[
              ['Request', 'Say which institution, what (one account or Setup) and why.'],
              ['Approval', 'Their School Admin approves or declines on their Support page.'],
              ['Access', 'Only while active, only that scope — every action is audited.'],
              ['Ends', 'On its own when the time is up, or when you end it here.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span><span><span className="font-medium text-slate-900 dark:text-white">{t}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{d}</span></span></li>
            ))}
          </ol>
        </Card>
      </div>
      <Card title="Requests" action={<Segmented label="Requests" value={tab} onChange={setTab} options={[{ key: 'live', label: 'Active & pending', count: live.length }, { key: 'past', label: 'Past', count: past.length }]} />}>
        {!data ? <Skeleton rows={3} /> : list.length === 0 ? <Placeholder icon={<KeyRound size={20} />} title={tab === 'live' ? 'No active or pending access' : 'No past requests'} /> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead><tr><th className={thCls}>Institution</th><th className={thCls}>Scope</th><th className={thCls}>Reason</th><th className={thCls}>State</th><th className={thCls}>Ends</th><th className={thCls} /></tr></thead>
              <tbody>{list.map((g) => (
                <tr key={g.id} data-testid="grant-row" className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                  <td className={tdCls}><div className="flex items-center gap-3"><Avatar name={g.school.name} /><span className="font-medium text-slate-900 dark:text-white">{g.school.name}</span></div></td>
                  <td className={tdCls}>{g.scope === 'ACCOUNT' ? 'One account' : 'Institution Setup'}</td>
                  <td className={clsx(tdCls, 'max-w-xs')}><span className="line-clamp-2">{g.reason}</span></td>
                  <td className={tdCls}><Status tone={tone(g.state)}>{g.state.toLowerCase()}</Status></td>
                  <td className={clsx(tdCls, 'whitespace-nowrap text-xs')}>{g.expiresAt ? new Date(g.expiresAt).toLocaleString() : `${g.hours} h once approved`}</td>
                  <td className={clsx(tdCls, 'text-right')}>{g.state === 'ACTIVE' && <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/platform/support-grants/${g.id}/revoke`, {}); refetch(); }}>End now</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────────────────────────
interface Agg { tenantId: string; tenant: string; tiers?: { t0: boolean; t1: boolean; t2: boolean }; status?: string }
/** One tenant's metrics, loaded when its row is opened (the overview itself stays light). */
function TenantMetrics({ id }: { id: string }) {
  const { data, loading } = useApi<{ metrics?: Metric[]; status?: string }>(`/platform/analytics/tenants/${id}`);
  if (loading && !data) return <div className="mt-3"><Skeleton rows={2} /></div>;
  if (!data?.metrics) return <p className="text-sm text-slate-500 mt-3">This tenant's deployment could not be reached.</p>;
  return <div className="mt-4"><MetricList metrics={data.metrics} /></div>;
}
const tierPill = (on: boolean | undefined, t: string) => (
  <span className={clsx('text-[11px] font-semibold rounded-full px-2 py-0.5', on ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-white/5 text-slate-400 line-through')}>{t}</span>
);
/** P11 (A7.3) — tiered aggregates: platform-wide rollup, and each tenant's metrics for the tiers it shares. */
export function PlatformAnalyticsPage() {
  const { data, refetch } = useApi<{ rollup: { key: string; label: string; unit: string; value: number | null; n: number }[]; tenantsData: Agg[] }>('/platform/analytics');
  const [open, setOpen] = useState('');
  const [q, setQ] = useState('');
  const [snapping, setSnapping] = useState(false);
  const snapshot = async () => { setSnapping(true); try { await api.post('/platform/benchmarks/snapshot', {}); refetch(); } finally { setSnapping(false); } };
  const tenants = (data?.tenantsData ?? []).filter((t) => !q || t.tenant.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6 max-w-7xl" data-testid="platform-analytics">
      <PageHeader title="Analytics" subtitle="Tiered aggregates from the aggregation layer: T0 for every tenant, T1/T2 only where the tenant switched them on. Numbers about groups — never a person."
        actions={<Button variant="secondary" onClick={snapshot} disabled={snapping}><Camera size={16} className="inline mr-1.5" />{snapping ? 'Taking snapshot…' : 'Take benchmark snapshot'}</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="rollup">
        {!data ? <div className="col-span-full"><Skeleton rows={1} /></div> : data.rollup.map((r) => (
          <div key={r.key}><Tile label={r.label} value={fmt(r.value, r.unit)} icon={<BarChart3 size={18} />} color="blue" basis={`${r.n} tenant${r.n === 1 ? '' : 's'}`} /></div>
        ))}
      </div>
      <Card title="Tenants" subtitle="Open a tenant to load its metrics." action={
        <div className="relative w-56"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search tenants" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className={clsx(inputCls, 'pl-8 !py-1.5')} /></div>}>
        <div className="divide-y divide-gray-100 dark:divide-white/5 -mx-5">
          {tenants.map((t) => (
            <section key={t.tenantId} className="px-5 py-3" data-testid="tenant-analytics">
              <button className="w-full flex justify-between items-center gap-3 cursor-pointer text-left" onClick={() => setOpen(open === t.tenantId ? '' : t.tenantId)} aria-expanded={open === t.tenantId}>
                <span className="flex items-center gap-3 min-w-0"><Avatar name={t.tenant} /><span className="font-medium text-slate-900 dark:text-white truncate">{t.tenant}</span></span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {t.status === 'unreachable' ? <Status tone="warn">isolated deployment unreachable</Status> : <>{tierPill(true, 'T0')}{tierPill(t.tiers?.t1, 'T1')}{tierPill(t.tiers?.t2, 'T2')}</>}
                  <ChevronDown size={16} className={clsx('text-slate-400 transition-transform ml-1', open === t.tenantId && 'rotate-180')} />
                </span>
              </button>
              {open === t.tenantId && t.status !== 'unreachable' && <TenantMetrics id={t.tenantId} />}
            </section>
          ))}
          {data && tenants.length === 0 && <Placeholder icon={<Search size={20} />} title="No tenant matches" />}
        </div>
      </Card>
    </div>
  );
}
