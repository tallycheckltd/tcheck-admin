import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, ChevronRight, Building2, Eye, ArrowLeft, Trash2, Mail, ShieldAlert } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ColorPickerField } from '../../components/ui/ColorPickerField';
import { MetricList, type Metric } from '../../components/analytics/MetricList';
import { SchoolSettingsFields } from '../../components/platform/TenantSettingsFields';
import { defaultFeatures, defaultSettings, type SchoolSettingsValue } from '../../components/platform/tenantSettings';
import type { School, User } from '../../types';
import { GrantRequestForm, GrantsTable, type PlatformGrant } from '../../components/support/PlatformGrants';

interface Tenant {
  id: string; name: string; code: string; color?: string; attendanceMode: string; features: Record<string, boolean>; deployment: 'SHARED' | 'ISOLATED'; apiBaseUrl: string | null;
  tiers: { t1: boolean; t2: boolean; changedAt: string | null }; onboarding: { completedAt: string | null; windowOpen: boolean };
  integrations: { total: number; failed: number; providers: string[] }; accounts: number;
}
interface Group { institution: { id: string; name: string } | null; tenants: Tenant[] }
type Person = { id: string; firstName: string; lastName: string; role?: string; school?: { name: string } | null };

const table = 'w-full text-sm';
const th = 'text-left text-xs uppercase text-gray-500 p-3';
const td = 'p-3 border-t border-gray-100 dark:border-white/5 align-top';
const typeOf = (t: Pick<Tenant, 'features' | 'attendanceMode'>) => (t.features?.execEdSuite ? 'Executive Education' : t.attendanceMode === 'STAGE_BASED' ? 'Training pipeline' : 'Calendar-based');

/**
 * UAT §2 (2026-09-29) — one Institutions area (Institutions + the old Schools editor merged). Every
 * tenant sits under an institution: a real group, or — for a single-campus school — itself, until a
 * second campus is added (which creates the group). Click a tenant for its page (Overview, Settings,
 * Admins, Access, Analytics). One create wizard. T1/T2 are changed on the tenant page, behind a confirm.
 */
export function PlatformInstitutionsPage() {
  const { data, refetch } = useApi<{ groups: Group[] }>('/platform/institutions');
  const [wizard, setWizard] = useState<{ open: boolean; presetGroup?: string; branchOf?: Tenant }>({ open: false });
  const [access, setAccess] = useState<{ id: string; name: string } | null>(null);
  const groups = (data?.groups ?? []).map((g) => g.institution).filter(Boolean) as { id: string; name: string }[];

  return (
    <div className="space-y-6" data-testid="platform-institutions">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Institutions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Each institution and its campuses / schools. Click one to see and change everything about it.</p>
        </div>
        <Button onClick={() => setWizard({ open: true })} data-testid="new-institution"><Plus size={16} className="inline mr-1" />New institution</Button>
      </div>

      {(data?.groups ?? []).map((g) => {
        const solo = !g.institution;
        const title = g.institution?.name ?? g.tenants[0]?.name ?? '';
        return (
          <section key={g.institution?.id ?? g.tenants[0]?.id} className="glass-card overflow-x-auto">
            <header className="flex items-center justify-between gap-3 p-4 pb-0 flex-wrap">
              <h2 className="font-semibold flex items-center gap-2"><Building2 size={16} className="text-blue-500" /> {title}
                <span className="text-xs font-normal text-gray-500">{g.tenants.length} {g.tenants.length === 1 ? 'campus' : 'campuses'}</span>
              </h2>
              <div className="flex gap-2">
                {g.institution && <Button size="sm" variant="secondary" onClick={() => setAccess(g.institution!)}><Eye size={14} className="mr-1.5" />Group view access</Button>}
                <Button size="sm" variant="secondary" onClick={() => setWizard(solo ? { open: true, branchOf: g.tenants[0] } : { open: true, presetGroup: g.institution!.id })}><Plus size={14} className="mr-1" />Add campus / school</Button>
              </div>
            </header>
            <table className={table}>
              <thead><tr><th className={th}>Campus / school</th><th className={th}>Type</th><th className={th}>Deployment</th><th className={th}>Data shared</th><th className={th}>Onboarding</th><th className={th}>Integrations</th><th className={th}>Accounts</th><th className={th} /></tr></thead>
              <tbody>
                {g.tenants.map((t) => (
                  <tr key={t.id} data-testid="tenant-row" className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className={td}><Link to={`/platform/institutions/${t.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{t.name}</Link><p className="text-xs text-gray-500">{t.code}</p></td>
                    <td className={td}>{t.features?.execEdSuite ? <Badge color="purple">Executive Education</Badge> : typeOf(t)}</td>
                    <td className={td}>{t.deployment === 'ISOLATED' ? <Badge color="yellow">Isolated — not connected</Badge> : 'Shared'}</td>
                    <td className={td}>{t.tiers.t1 || t.tiers.t2 ? [t.tiers.t1 && 'T1', t.tiers.t2 && 'T2'].filter(Boolean).join(' + ') : <span className="text-gray-400">T0 only</span>}</td>
                    <td className={td}>{t.onboarding.completedAt ? <Badge color="green">Complete</Badge> : t.onboarding.windowOpen ? <Badge color="blue">In progress</Badge> : <Badge color="gray">Window closed</Badge>}</td>
                    <td className={td}>{t.integrations.total ? `${t.integrations.providers.join(', ')}${t.integrations.failed ? ` · ${t.integrations.failed} failing` : ''}` : '—'}</td>
                    <td className={td}>{t.accounts}</td>
                    <td className={td}><Link to={`/platform/institutions/${t.id}`} aria-label={`Open ${t.name}`}><ChevronRight size={16} className="text-gray-400" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      {wizard.open && (
        // Mounted per opening, so each run starts blank.
        <TenantWizard open groups={groups} presetGroup={wizard.presetGroup} branchOf={wizard.branchOf}
          onClose={() => setWizard({ open: false })} onDone={() => { setWizard({ open: false }); refetch(); }} />
      )}
      {access && <GroupAccessModal group={access} onClose={() => setAccess(null)} />}
    </div>
  );
}

/** UAT F28 — who may see the aggregate-only group view (VC / DVC / Dean of a tenant in the group). */
function GroupAccessModal({ group, onClose }: { group: { id: string; name: string }; onClose: () => void }) {
  const { data: grants, refetch } = useApi<{ id: string; createdAt: string; user: Person | null }[]>(`/institutions/${group.id}/grants`);
  const { data: candidates } = useApi<Person[]>(`/institutions/${group.id}/grant-candidates`);
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const held = new Set((grants ?? []).map((g) => g.user?.id));
  const grant = async () => { setError(''); try { await api.post(`/institutions/${group.id}/grants`, { userId }); setUserId(''); refetch(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not grant'); } };
  const revoke = async (id: string) => { await api.delete(`/institutions/grants/${id}`); refetch(); };
  return (
    <Modal open onClose={onClose} title={`Group view — ${group.name}`}>
      <div className="space-y-4 text-sm">
        <p className="text-gray-500">An aggregate-only view across this institution's campuses: headcount, attendance %, programme counts, response targets. Numbers only — groups under 5 show "insufficient data", and nobody can drill into a person.</p>
        <div>
          <p className="font-medium mb-1.5">Who can see it</p>
          {!grants?.length ? <p className="text-gray-500">Nobody yet.</p> : (
            <ul className="space-y-1.5">{grants.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
                <span>{g.user ? `${g.user.firstName} ${g.user.lastName}` : 'Unknown'} <span className="text-xs text-gray-500">{g.user?.role} · {g.user?.school?.name}</span></span>
                <button onClick={() => void revoke(g.id)} className="text-xs text-rose-600 hover:underline cursor-pointer">Remove</button>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="flex gap-2">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Person" className="flex-1 rounded-lg border px-2 py-2 dark:bg-white/5">
            <option value="">Give access to…</option>
            {(candidates ?? []).filter((c) => !held.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.role} · {c.school?.name}</option>)}
          </select>
          <Button disabled={!userId} onClick={() => void grant()}>Grant</Button>
        </div>
        {!candidates?.length && <p className="text-xs text-gray-500">No VC, DVC or Dean accounts in this institution's campuses yet.</p>}
        {error && <p className="text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}

const FEATURES: [string, string][] = [
  ['execEdSuite', 'Executive Education tenant'], ['onboardingJourney', 'Onboarding journey'], ['messaging', 'Messaging'], ['broadcasts', 'Announcements'],
  ['anonymousChat', 'Anonymous chat'], ['faceIdCheckIn', 'Face ID check-in'], ['biometricStrictMode', 'Strict biometric mode'], ['dwellTimeTracking', 'Dwell time'],
  ['profileCompletionPrompt', '"Tell us about you" profile prompt'],
];
type ExtraAdmin = { firstName: string; lastName: string; email: string };

/**
 * The one create wizard (UAT §2 — the P10 wizard plus what only the old one had): institution (name,
 * code, colour, group, deployment) → type, features and attendance → data tiers → School Admins (the
 * first by invite, more optional) → done. `presetGroup` / `branchOf` = "Add campus / school": a
 * single-campus school gets its own group created on the spot and the new campus joins it.
 */
function TenantWizard({ open, groups, presetGroup, branchOf, onClose, onDone }: { open: boolean; groups: { id: string; name: string }[]; presetGroup?: string; branchOf?: Tenant; onClose: () => void; onDone: () => void }) {
  const blank = () => ({ name: '', code: '', color: '#2563eb', group: presetGroup ?? '', newGroup: '', isolated: false, apiBaseUrl: '', attendanceMode: 'CALENDAR_BASED', features: { profileCompletionPrompt: true } as Record<string, boolean>, late: 10, veryLate: 20, t1: false, t2: false, firstName: '', lastName: '', email: '' });
  const [step, setStep] = useState(1);
  const [f, setF] = useState(blank);
  const [extra, setExtra] = useState<ExtraAdmin[]>([]);
  const [result, setResult] = useState<{ invite?: { devLink?: string; emailed?: boolean }; school?: { id: string }; extras?: number } | null>(null);
  const { mutate, loading, error } = useMutation<{ invite?: { devLink?: string; emailed?: boolean }; school?: { id: string } }>('post');
  const [extraError, setExtraError] = useState('');

  const submit = async () => {
    setExtraError('');
    let institutionId: string | null = f.group && f.group !== '__new__' ? f.group : null;
    let newInstitutionName: string | null = f.group === '__new__' ? f.newGroup : null;
    // "Add campus" on a single-campus school: its group is created now, named after it.
    if (branchOf) {
      try {
        const g = await api.post<{ id: string }>('/institutions', { name: branchOf.name });
        await api.put(`/institutions/schools/${branchOf.id}`, { institutionId: g.id });
        institutionId = g.id; newInstitutionName = null;
      } catch (e) { setExtraError(e instanceof Error ? e.message : 'Could not create the group'); return; }
    }
    const r = await mutate('/platform/tenants', {
      name: f.name, code: f.code, color: f.color, institutionId, newInstitutionName,
      apiBaseUrl: f.isolated ? f.apiBaseUrl || null : null, attendanceMode: f.attendanceMode, features: f.features,
      analyticsTier1: f.t1, analyticsTier2: f.t2, admin: { firstName: f.firstName, lastName: f.lastName, email: f.email },
    });
    if (!r?.school) return;
    // Attendance thresholds, then any extra School Admins (each gets an invite).
    let extras = 0;
    try {
      await api.put(`/schools/${r.school.id}`, { lateThresholdMinutes: f.late, extremelyLateThresholdMinutes: f.veryLate });
      for (const a of extra.filter((x) => x.firstName.trim() && x.lastName.trim() && x.email.trim())) {
        await api.post('/users/school-admin', { ...a, schoolId: r.school.id });
        extras++;
      }
    } catch (e) { setExtraError(`Created — but: ${e instanceof Error ? e.message : 'a follow-up step failed'}. Finish it on the tenant page.`); }
    setResult({ ...r, extras });
    setStep(5);
  };
  const close = () => { if (step === 5) onDone(); else onClose(); };
  const title = branchOf ? `Add a campus to ${branchOf.name}` : presetGroup ? `Add a campus to ${groups.find((g) => g.id === presetGroup)?.name ?? 'this institution'}` : 'New institution';
  return (
    <Modal open={open} onClose={close} title={`${title} — step ${step} of 5`}>
      <div className="space-y-3 text-sm" data-testid="tenant-wizard">
        {step === 1 && (<>
          <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <ColorPickerField label="Brand colour" value={f.color} onChange={(v: string) => setF({ ...f, color: v })} />
          {!branchOf && !presetGroup && (
            <label className="block">Institution
              <select aria-label="Institution group" className="w-full rounded-lg border px-2 py-2 mt-1 dark:bg-white/5" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
                <option value="">Its own (single campus)</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}<option value="__new__">New institution with several campuses…</option>
              </select>
            </label>
          )}
          {f.group === '__new__' && <Input label="Institution name" value={f.newGroup} onChange={(e) => setF({ ...f, newGroup: e.target.value })} />}
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
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className="text-xs text-gray-500">Late after (min)<input type="number" min={0} value={f.late} onChange={(e) => setF({ ...f, late: Number(e.target.value) })} className="w-full rounded-lg border px-2 py-1.5 mt-1 dark:bg-white/5" /></label>
            <label className="text-xs text-gray-500">Very late after (min)<input type="number" min={0} value={f.veryLate} onChange={(e) => setF({ ...f, veryLate: Number(e.target.value) })} className="w-full rounded-lg border px-2 py-1.5 mt-1 dark:bg-white/5" /></label>
          </div>
        </>)}
        {step === 3 && (<>
          <p className="text-gray-500">T0 (service & billing counts) is always on. T1 and T2 stay off until the contract allows them.</p>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={f.t1} onChange={(e) => setF({ ...f, t1: e.target.checked })} /> T1 — aggregate behaviour</label>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={f.t2} onChange={(e) => setF({ ...f, t2: e.target.checked })} /> T2 — sensitive splits (minimum group size applies)</label>
        </>)}
        {step === 4 && (<>
          <p className="text-gray-500">The first School Admin sets their own password from an invite link — no password here. Lecturers and staff are the School Admin's to add.</p>
          <Input label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          <Input label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          <Input label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          {extra.map((a, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input placeholder="First name" value={a.firstName} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, firstName: e.target.value } : x)))} className="rounded-lg border px-2 py-1.5 dark:bg-white/5" />
              <input placeholder="Last name" value={a.lastName} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, lastName: e.target.value } : x)))} className="rounded-lg border px-2 py-1.5 dark:bg-white/5" />
              <input placeholder="Email" value={a.email} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} className="rounded-lg border px-2 py-1.5 dark:bg-white/5" />
            </div>
          ))}
          <button type="button" onClick={() => setExtra([...extra, { firstName: '', lastName: '', email: '' }])} className="text-xs text-blue-600 hover:underline cursor-pointer">+ Another School Admin</button>
        </>)}
        {step === 5 && (
          <div data-testid="wizard-done">
            <p className="font-medium">Created. It now appears in Onboarding with its checklist.</p>
            <p className="text-gray-500">{result?.invite?.emailed ? 'The invite was emailed.' : 'Email is not configured here — the invite link:'}</p>
            {result?.invite?.devLink && <code className="block break-all text-xs mt-1">{result.invite.devLink}</code>}
            {!!result?.extras && <p className="text-gray-500 mt-1">{result.extras} more School Admin invite{result.extras === 1 ? '' : 's'} sent.</p>}
          </div>
        )}
        {(error || extraError) && <p className="text-red-600">{error || extraError}</p>}
        <div className="flex justify-between">
          {step > 1 && step < 5 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
          {step < 4 && <Button disabled={step === 1 && (!f.name || !f.code || (f.group === '__new__' && !f.newGroup.trim()))} onClick={() => setStep(step + 1)}>Next</Button>}
          {step === 4 && <Button data-testid="wizard-create" disabled={loading || !f.firstName || !f.lastName || !f.email} onClick={() => void submit()}>Create</Button>}
          {step === 5 && <Button onClick={close}>Done</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ─── The tenant page ─────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'settings' | 'admins' | 'access' | 'analytics';

/** UAT §2 — everything about one campus / school: Overview, Settings, Admins, Access, Analytics. */
export function PlatformTenantPage() {
  const { id } = useParams<{ id: string }>();
  const { data, refetch } = useApi<{ groups: Group[] }>('/platform/institutions');
  const [tab, setTab] = useState<Tab>('overview');
  const group = data?.groups.find((g) => g.tenants.some((t) => t.id === id));
  const tenant = group?.tenants.find((t) => t.id === id);
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!tenant || !group) return <p className="glass-card p-6 text-sm text-gray-500">Not found. <Link to="/platform/institutions" className="text-blue-600">Back to Institutions</Link></p>;
  const tabs: [Tab, string][] = [['overview', 'Overview'], ['settings', 'Settings'], ['admins', 'School Admins'], ['access', 'Support access'], ['analytics', 'Analytics']];
  return (
    <div className="space-y-6" data-testid="platform-tenant">
      <Link to="/platform/institutions" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline"><ArrowLeft size={14} /> Institutions</Link>
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">{group.institution?.name ?? tenant.name}</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tenant.name} <span className="text-base font-normal text-gray-400">{tenant.code}</span></h1>
      </div>
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5 text-sm w-fit flex-wrap" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer ${tab === k ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{l}</button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab tenant={tenant} onChanged={refetch} />}
      {tab === 'settings' && <SettingsTab tenantId={tenant.id} groups={data.groups.map((g) => g.institution).filter(Boolean) as { id: string; name: string }[]} onChanged={refetch} />}
      {tab === 'admins' && <AdminsTab tenantId={tenant.id} />}
      {tab === 'access' && <AccessTab tenantId={tenant.id} />}
      {tab === 'analytics' && <AnalyticsTab tenantId={tenant.id} isolated={tenant.deployment === 'ISOLATED'} />}
    </div>
  );
}

function OverviewTab({ tenant: t, onChanged }: { tenant: Tenant; onChanged: () => void }) {
  const [pending, setPending] = useState<{ t1: boolean; t2: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2 border-t border-gray-100 dark:border-white/5 first:border-t-0"><span className="text-gray-500">{label}</span><span className="text-right">{children}</span></div>
  );
  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try { await api.put(`/platform/tenants/${t.id}/tiers`, pending); setPending(null); onChanged(); } finally { setBusy(false); }
  };
  const turningOn = pending && ((pending.t1 && !t.tiers.t1) || (pending.t2 && !t.tiers.t2));
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="glass-card p-5 text-sm">
        <Row label="Type">{typeOf(t)}</Row>
        <Row label="Deployment">{t.deployment === 'ISOLATED' ? <span>Isolated <span className="text-xs text-gray-500 break-all">{t.apiBaseUrl}</span></span> : 'Shared'}</Row>
        <Row label="Onboarding">{t.onboarding.completedAt ? 'Complete' : t.onboarding.windowOpen ? 'In progress' : 'Window closed'}</Row>
        <Row label="Integrations">{t.integrations.total ? `${t.integrations.providers.join(', ')}${t.integrations.failed ? ` · ${t.integrations.failed} failing` : ' · healthy'}` : 'None'}</Row>
        <Row label="Accounts">{t.accounts}</Row>
      </div>
      <div className="glass-card p-5 text-sm space-y-3">
        <p className="font-semibold">Data shared with the platform</p>
        <p className="text-gray-500">T0 (service and billing counts) is always on. T1 and T2 only as the contract allows.</p>
        {([['t1', 'T1 — aggregate behaviour (attendance rates, check-in methods, punctuality…)'], ['t2', 'T2 — sensitive splits (gender, nationality, NPS, at-risk; groups under 5 hidden)']] as const).map(([k, label]) => (
          <label key={k} className="flex gap-2 items-start">
            <input type="checkbox" checked={(pending ?? t.tiers)[k]} onChange={(e) => setPending({ ...(pending ?? { t1: t.tiers.t1, t2: t.tiers.t2 }), [k]: e.target.checked })} aria-label={k.toUpperCase()} />
            <span>{label}</span>
          </label>
        ))}
        {t.tiers.changedAt && <p className="text-xs text-gray-500">Last changed {new Date(t.tiers.changedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </div>
      {pending && (
        // UAT F2 — the switches used to save to production on click; now they ask first.
        <Modal open onClose={() => setPending(null)} title="Change what this school shares?">
          <div className="space-y-3 text-sm">
            <p>{turningOn ? <><ShieldAlert size={14} className="inline mr-1 text-amber-500" />This shares {t.name}'s {pending.t2 && !t.tiers.t2 ? 'sensitive splits (T2)' : 'aggregate behaviour (T1)'} with the platform. Only do this if their contract allows it.</> : `This stops sharing with the platform. ${t.name}'s next benchmark snapshot will leave them out.`}</p>
            <p className="text-gray-500">From T1 {t.tiers.t1 ? 'on' : 'off'} / T2 {t.tiers.t2 ? 'on' : 'off'} → T1 {pending.t1 ? 'on' : 'off'} / T2 {pending.t2 ? 'on' : 'off'}. Recorded with your name and the time.</p>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button><Button disabled={busy} onClick={() => void apply()}>Confirm</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettingsTab({ tenantId, groups, onChanged }: { tenantId: string; groups: { id: string; name: string }[]; onChanged: () => void }) {
  const { data: school, refetch } = useApi<TenantSchool>(`/schools/${tenantId}`);
  if (!school) return <p className="text-sm text-gray-500">Loading…</p>;
  // Keyed on the saved row, so the form starts from the latest values after each save.
  return <SettingsForm key={school.updatedAt ?? school.id} school={school} groups={groups} onSaved={() => { refetch(); onChanged(); }} />;
}

type TenantSchool = School & { institutionId?: string | null; updatedAt?: string };
function SettingsForm({ school, groups, onSaved }: { school: TenantSchool; groups: { id: string; name: string }[]; onSaved: () => void }) {
  const navigate = useNavigate();
  const tenantId = school.id;
  const [basics, setBasics] = useState({ name: school.name, code: school.code, color: school.color ?? '#2563eb', group: school.institutionId ?? '' });
  const [settings, setSettings] = useState<SchoolSettingsValue>(() => ({
    ...defaultSettings,
    allowManualLecturerOverride: school.allowManualLecturerOverride ?? true,
    features: { ...defaultFeatures, ...(school.features ?? {}) },
    lateThresholdMinutes: school.lateThresholdMinutes ?? 10,
    extremelyLateThresholdMinutes: school.extremelyLateThresholdMinutes ?? 20,
    attendanceMode: school.attendanceMode ?? 'CALENDAR_BASED',
    apiBaseUrl: school.apiBaseUrl ?? '',
  }));
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const { mutate: put, loading } = useMutation('put');
  const save = async () => {
    setError(''); setSaved('');
    const ok = await put(`/schools/${tenantId}`, { name: basics.name, code: basics.code, color: basics.color, ...settings, apiBaseUrl: settings.apiBaseUrl || null });
    if (!ok) { setError('Could not save'); return; }
    if ((school.institutionId ?? '') !== basics.group) await api.put(`/institutions/schools/${tenantId}`, { institutionId: basics.group || null });
    setSaved('Saved.'); onSaved();
  };
  const remove = async () => { await api.delete(`/schools/${tenantId}`); navigate('/platform/institutions'); };
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="glass-card p-5 space-y-3">
        <Input label="Name" value={basics.name} onChange={(e) => setBasics({ ...basics, name: e.target.value })} />
        <Input label="Code" value={basics.code} onChange={(e) => setBasics({ ...basics, code: e.target.value })} />
        <ColorPickerField label="Brand colour" value={basics.color} onChange={(v: string) => setBasics({ ...basics, color: v })} />
        <label className="block text-sm">Institution
          <select value={basics.group} onChange={(e) => setBasics({ ...basics, group: e.target.value })} className="w-full rounded-lg border px-2 py-2 mt-1 dark:bg-white/5">
            <option value="">Its own (single campus)</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      </div>
      <SchoolSettingsFields value={settings} onChange={setSettings} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">{saved}</p>}
      <Button disabled={loading} onClick={() => void save()}>Save settings</Button>
      <div className="glass-card p-5 border border-rose-200 dark:border-rose-500/20 space-y-2">
        <p className="font-semibold text-rose-600 flex items-center gap-2"><Trash2 size={14} /> Delete this school</p>
        <p className="text-sm text-gray-500">Permanently deletes the school and everything in it — people, courses, attendance, messages. This cannot be undone. Type its code ({school.code}) to confirm.</p>
        <div className="flex gap-2"><input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm dark:bg-white/5" placeholder={school.code} />
          <Button variant="danger" disabled={confirmDelete !== school.code} onClick={() => void remove()}>Delete permanently</Button></div>
      </div>
    </div>
  );
}

function AdminsTab({ tenantId }: { tenantId: string }) {
  const { data: admins, refetch } = useApi<User[]>(`/users?role=SCHOOL_ADMIN&schoolId=${tenantId}`);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [notice, setNotice] = useState('');
  const add = async () => {
    setNotice('');
    try { await api.post('/users/school-admin', { ...form, schoolId: tenantId }); setForm({ firstName: '', lastName: '', email: '' }); setNotice('Invited.'); refetch(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not invite'); }
  };
  const reinvite = async (u: User) => { try { await api.post(`/users/${u.id}/invite`, {}); setNotice(`Invite re-sent to ${u.email}.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not re-send'); } };
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="glass-card overflow-x-auto">
        <table className={table}>
          <thead><tr><th className={th}>School Admin</th><th className={th}>Email</th><th className={th}>Status</th><th className={th} /></tr></thead>
          <tbody>{(admins ?? []).map((u) => (
            <tr key={u.id}><td className={td}>{u.firstName} {u.lastName}</td><td className={td}>{u.email}</td><td className={td}>{u.status}</td>
              <td className={td}><button onClick={() => void reinvite(u)} className="text-xs text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-1"><Mail size={12} />Re-send invite</button></td></tr>
          ))}</tbody>
        </table>
        {admins && !admins.length && <p className="p-4 text-sm text-gray-500">No School Admin yet.</p>}
      </div>
      <div className="glass-card p-5 space-y-2">
        <p className="font-semibold text-sm">Add a School Admin</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <Button size="sm" disabled={!form.firstName || !form.lastName || !form.email} onClick={() => void add()}>Send invite</Button>
        {notice && <p className="text-xs text-gray-600 dark:text-gray-300">{notice}</p>}
      </div>
    </div>
  );
}

function AccessTab({ tenantId }: { tenantId: string }) {
  const { data, refetch } = useApi<PlatformGrant[]>('/platform/support-grants');
  return (
    <div className="space-y-4 max-w-4xl">
      <GrantRequestForm schoolId={tenantId} onDone={refetch} />
      <GrantsTable grants={(data ?? []).filter((g) => g.school?.id === tenantId)} onChanged={refetch} />
    </div>
  );
}

function AnalyticsTab({ tenantId, isolated }: { tenantId: string; isolated: boolean }) {
  const { data, loading } = useApi<{ metrics?: Metric[]; status?: string }>(`/platform/analytics/tenants/${tenantId}`);
  if (loading && !data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!data?.metrics) return <p className="glass-card p-6 text-sm text-gray-500">{isolated ? 'Isolated deployment — not connected to the platform yet.' : "This school's numbers could not be loaded."}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Last 30 days. The full charts for this school are on <Link to={`/platform/analytics?school=${tenantId}`} className="text-blue-600 hover:underline">Analytics</Link>.</p>
      <MetricList metrics={data.metrics} />
    </div>
  );
}
