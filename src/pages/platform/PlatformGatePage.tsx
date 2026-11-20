import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Power } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Panel, DataTable, ErrorLine, Tile } from '../visitors/gate/gateShared';
import { useGateLive, useAction, ago, ms, ALERT_KIND, CREDENTIAL, DOOR_STATE, JOB_KIND, inputCls } from '../visitors/gate/gateLib';
import { stamp } from '../visitors/visitorsApi';
import type { Overview, Health } from '../visitors/gate/GateOverviewPage';

/**
 * Super Admin → Gates (2026-11-20): every school's BioStar link — health first (offline and needing
 * attention at the top), connector and BioStar versions, backlog, failures, alerts and today's scans;
 * reader models across schools; alerts across schools; and one school's gate, read only. The kill
 * switch cuts a school's connector at once (reason required, audited). Fingerprints are counts only.
 */
interface SchoolRow {
  schoolId: string; school: string; code: string; health: 'OK' | 'ATTENTION' | 'OFFLINE' | 'DISABLED' | 'NOT_SET_UP'; enabled: boolean; online: boolean; lastSeenAt: string | null;
  connectorVersion: string | null; biostarVersion: string | null; connectorOutdated: boolean; backlog: number; oldestWaitingMs: number | null; failed24h: number; openAlerts: number;
  scansToday: number; refusalsToday: number; doorsNeedingAttention: number; fingerprints: number; biometricsEnabled: boolean; platformDisabledAt: string | null; platformDisabledReason: string | null;
}
const HEALTH: Record<SchoolRow['health'], ['green' | 'yellow' | 'red' | 'gray', string]> = { OK: ['green', 'OK'], ATTENTION: ['yellow', 'Needs attention'], OFFLINE: ['red', 'Offline'], DISABLED: ['gray', 'Switched off'], NOT_SET_UP: ['gray', 'Not set up'] };
const TABS = ['Schools', 'Readers', 'Alerts', 'Audit'] as const;

export function PlatformGatePage() {
  const { schoolId } = useParams();
  return schoolId ? <SchoolGate schoolId={schoolId} /> : <AllGates />;
}

function Header({ title, intro, back }: { title: string; intro: string; back?: boolean }) {
  return (
    <div className="space-y-1">
      {back && <Link to="/platform/gate" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"><ArrowLeft size={14} /> All gates</Link>}
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">{intro}</p>
    </div>
  );
}

function AllGates() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Schools');
  const { data, refetch } = useApi<{ schools: SchoolRow[]; minConnectorVersion: string }>('/platform/biostar/schools', { refetchIntervalMs: 30_000, refetchWhenVisible: true });
  useGateLive(() => void refetch({ silent: true }), ['job', 'alert', 'door']);
  const { data: fleet } = useApi<{ connectorVersions: { value: string; count: number }[]; biostarVersions: { value: string; count: number }[]; readerModels: { value: string; count: number }[]; outdated: { school: string; version: string }[]; readers: { school: string | null; name: string; model: string | null; firmware: string | null; online: boolean; readsQr: boolean; readsFinger: boolean; readsFace: boolean; lastSeenAt: string | null }[] }>(tab === 'Readers' ? '/platform/biostar/fleet' : null);
  const { data: alerts } = useApi<{ alerts: { id: string; school: string; schoolId: string; kind: string; title: string; count: number; lastAt: string; resolvedAt: string | null }[] }>(tab === 'Alerts' ? '/platform/biostar/alerts?open=true' : null);
  const { data: audit } = useApi<{ entries: { id: string; at: string; school: string | null; action: string; actorRole: string; after: Record<string, unknown> | null }[] }>(tab === 'Audit' ? '/platform/biostar/audit' : null);
  const s = data?.schools ?? [];
  return (
    <div className="space-y-5">
      <Header title="Gates" intro="Every school's BioStar 2 link. Schools that are offline or need attention come first." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Schools with a link" value={s.filter((x) => x.health !== 'NOT_SET_UP').length} />
        <Tile label="Offline" value={s.filter((x) => x.health === 'OFFLINE').length} tone={s.some((x) => x.health === 'OFFLINE') ? 'bad' : 'default'} />
        <Tile label="Need attention" value={s.filter((x) => x.health === 'ATTENTION').length} tone={s.some((x) => x.health === 'ATTENTION') ? 'warn' : 'default'} />
        <Tile label="Scans today" value={s.reduce((n, x) => n + x.scansToday, 0)} />
        <Tile label="Open alerts" value={s.reduce((n, x) => n + x.openAlerts, 0)} />
      </div>
      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-white/10">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-blue-600 font-medium text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-600 dark:text-slate-400'}`}>{t}</button>)}
      </div>
      {tab === 'Schools' && (
        <Panel title={`${s.length} school(s)`} hint={data ? `Connector ${data.minConnectorVersion} or newer is required.` : undefined}>
          <DataTable head={['School', 'Health', 'Connector', 'BioStar', 'Backlog', 'Failed 24 h', 'Alerts', 'Today', 'Fingerprints']} empty={data && !s.length ? 'No school has a BioStar link yet.' : false}>
            {s.map((r) => {
              const [c, l] = HEALTH[r.health];
              return (
                <tr key={r.schoolId}>
                  <td className="px-5 py-2.5"><Link to={`/platform/gate/${r.schoolId}`} className="font-medium hover:underline">{r.school}</Link><span className="block text-xs text-slate-500">{r.code}</span></td>
                  <td className="px-5 py-2.5"><Badge color={c}>{l}</Badge><span className="block text-xs text-slate-500">seen {ago(r.lastSeenAt)}</span></td>
                  <td className="px-5 py-2.5 text-xs">{r.connectorVersion ?? '—'}{r.connectorOutdated && <span className="block text-amber-600">update needed</span>}</td>
                  <td className="px-5 py-2.5 text-xs">{r.biostarVersion ?? '—'}</td>
                  <td className="px-5 py-2.5 text-xs tabular-nums">{r.backlog}{r.oldestWaitingMs ? ` (oldest ${ms(r.oldestWaitingMs)})` : ''}</td>
                  <td className={`px-5 py-2.5 text-xs tabular-nums ${r.failed24h ? 'text-rose-600' : ''}`}>{r.failed24h}</td>
                  <td className="px-5 py-2.5 text-xs tabular-nums">{r.openAlerts}</td>
                  <td className="px-5 py-2.5 text-xs tabular-nums">{r.scansToday} in · {r.refusalsToday} refused</td>
                  <td className="px-5 py-2.5 text-xs tabular-nums">{r.biometricsEnabled ? r.fingerprints : 'off'}</td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>
      )}
      {tab === 'Readers' && fleet && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Connector versions"><ul className="text-sm">{fleet.connectorVersions.map((v) => <li key={v.value} className="flex justify-between py-1"><span>{v.value}</span><span className="tabular-nums">{v.count}</span></li>)}</ul>{!!fleet.outdated.length && <p className="mt-2 text-xs text-amber-600">To update: {fleet.outdated.map((o) => `${o.school} (${o.version})`).join(', ')}</p>}</Panel>
          <Panel title="BioStar versions"><ul className="text-sm">{fleet.biostarVersions.map((v) => <li key={v.value} className="flex justify-between py-1"><span>{v.value}</span><span className="tabular-nums">{v.count}</span></li>)}</ul></Panel>
          <Panel title="Reader models"><ul className="text-sm">{fleet.readerModels.map((v) => <li key={v.value} className="flex justify-between py-1"><span>{v.value}</span><span className="tabular-nums">{v.count}</span></li>)}</ul></Panel>
          <Panel title="Every reader" className="lg:col-span-3">
            <DataTable head={['School', 'Reader', 'Model', 'Firmware', 'Reads', 'Status']}>
              {fleet.readers.map((r, i) => <tr key={i}><td className="px-5 py-2 text-xs">{r.school}</td><td className="px-5 py-2">{r.name}</td><td className="px-5 py-2 text-xs">{r.model ?? '—'}</td><td className="px-5 py-2 text-xs">{r.firmware ?? '—'}</td><td className="px-5 py-2 text-xs">{[r.readsQr && 'QR', r.readsFinger && 'finger', r.readsFace && 'face'].filter(Boolean).join(', ') || '—'}</td><td className="px-5 py-2">{r.online ? <Badge color="green">Online</Badge> : <Badge color="red">Offline</Badge>}</td></tr>)}
            </DataTable>
          </Panel>
        </div>
      )}
      {tab === 'Alerts' && (
        <Panel title="Open alerts across schools">
          <DataTable head={['School', 'Kind', 'What', 'Last']} empty={alerts && !alerts.alerts.length ? 'No open alerts.' : false}>
            {alerts?.alerts.map((a) => <tr key={a.id}><td className="px-5 py-2"><Link to={`/platform/gate/${a.schoolId}`} className="hover:underline">{a.school}</Link></td><td className="px-5 py-2"><Badge color="yellow">{ALERT_KIND[a.kind] ?? a.kind}</Badge></td><td className="px-5 py-2 text-xs">{a.title}{a.count > 1 ? ` (${a.count}×)` : ''}</td><td className="px-5 py-2 text-xs">{ago(a.lastAt)}</td></tr>)}
          </DataTable>
        </Panel>
      )}
      {tab === 'Audit' && (
        <Panel title="Gate changes across schools" hint="Kill switch, connector tokens and gate settings.">
          <DataTable head={['When', 'School', 'What', 'By']} empty={audit && !audit.entries.length ? 'Nothing yet.' : false}>
            {audit?.entries.map((e) => <tr key={e.id}><td className="px-5 py-2 text-xs">{stamp(e.at)}</td><td className="px-5 py-2 text-xs">{e.school}</td><td className="px-5 py-2 text-xs">{e.action.replace(/^(gate|biostar)\./, '').replace(/([A-Z])/g, ' $1').toLowerCase()}{typeof e.after?.reason === 'string' ? `: ${e.after.reason}` : ''}</td><td className="px-5 py-2 text-xs">{e.actorRole.toLowerCase().replace(/_/g, ' ')}</td></tr>)}
          </DataTable>
        </Panel>
      )}
    </div>
  );
}

interface Detail {
  school: { id: string; name: string; institutionName: string | null };
  overview: Overview; health: Health;
  doors: { doors: { id: string; name: string; state: string; online: boolean; readers: { id: string; name: string; model: string | null; online: boolean }[]; today: { in: number; out: number; refused: number } }[] };
  jobs: { jobs: { id: string; kind: string; status: string; createdAt: string; tookMs: number | null; lastError: string | null }[] };
  events: { events: { id: string; at: string; result: string; credentialType: string | null; door: string | null; direction: string | null }[] };
  alerts: { alerts: { id: string; kind: string; title: string; lastAt: string; resolvedAt: string | null }[] };
}

function SchoolGate({ schoolId }: { schoolId: string }) {
  const { data, refetch, loading } = useApi<Detail>(`/platform/biostar/schools/${schoolId}`, { refetchIntervalMs: 30_000 });
  const { busy, error, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const disabled = !!data?.overview.connector.platformDisabledAt;
  const name = data ? (data.school.institutionName ? `${data.school.institutionName} · ${data.school.name}` : data.school.name) : 'School';
  return (
    <div className="space-y-5">
      <Header back title={name} intro="This school's gate, read only. People are not named here; fingerprints are counted, never shown." />
      <ErrorLine error={error} />
      {loading && !data && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Connector" value={data.overview.connector.online ? 'Online' : 'Offline'} sub={`v${data.overview.connector.version ?? '?'} · ${ago(data.overview.connector.lastSeenAt)}`} tone={data.overview.connector.online ? 'good' : 'bad'} />
            <Tile label="Time to reach BioStar" value={ms(data.health.sync.medianMs)} sub={`p95 ${ms(data.health.sync.p95Ms)}`} />
            <Tile label="Today" value={data.overview.today.entries} sub={`${data.overview.today.exits} out · ${data.overview.today.refusals} refused`} />
            <Tile label="Fingerprints" value={data.overview.fingerprints} sub={`${data.overview.peopleWithAccess} people with access now`} />
          </div>
          <Panel title="Kill switch" hint={disabled ? `Switched off: ${data.overview.connector.platformDisabledReason}` : 'Cuts this school\'s connector at once and stops all gate jobs. ICT must generate a new token afterwards.'}
            actions={disabled
              ? <Button size="sm" disabled={busy === 'on'} onClick={() => void run('on', async () => { await api.post(`/platform/biostar/schools/${schoolId}/enable`); await refetch({ silent: true }); })}>Switch back on</Button>
              : <Button size="sm" variant="danger" onClick={() => setConfirm(true)}><Power size={14} /> Switch off</Button>}>
            <p className="text-xs text-slate-500">Codes already in BioStar keep working until their day ends; BioStar removes them by itself.</p>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Doors">
              <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                {data.doors.doors.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{d.name} <span className="text-xs text-slate-500">{d.readers.length} reader(s)</span></span><span className="flex items-center gap-2 text-xs"><Badge color={(DOOR_STATE[d.state] ?? DOOR_STATE.UNKNOWN!)[0]}>{(DOOR_STATE[d.state] ?? DOOR_STATE.UNKNOWN!)[1]}</Badge>{d.today.in} in · {d.today.refused} refused</span></li>)}
                {!data.doors.doors.length && <li className="py-2 text-slate-500">No doors reported.</li>}
              </ul>
            </Panel>
            <Panel title="Open alerts">
              <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                {data.alerts.alerts.filter((a) => !a.resolvedAt).map((a) => <li key={a.id} className="py-2"><Badge color="yellow">{ALERT_KIND[a.kind] ?? a.kind}</Badge> <span className="text-xs text-slate-500">{ago(a.lastAt)}</span></li>)}
                {!data.alerts.alerts.some((a) => !a.resolvedAt) && <li className="py-2 text-slate-500">None.</li>}
              </ul>
            </Panel>
            <Panel title="Recent scans">
              <DataTable head={['Time', 'How', 'Door', 'Result']}>
                {data.events.events.slice(0, 15).map((e) => <tr key={e.id}><td className="px-5 py-2 text-xs">{stamp(e.at)}</td><td className="px-5 py-2 text-xs">{CREDENTIAL[e.credentialType ?? 'UNKNOWN']}</td><td className="px-5 py-2 text-xs">{e.door ?? '—'}</td><td className="px-5 py-2">{e.result === 'GRANTED' ? <Badge color="green">Granted</Badge> : <Badge color="red">Refused</Badge>}</td></tr>)}
              </DataTable>
            </Panel>
            <Panel title="Recent sync jobs">
              <DataTable head={['Queued', 'What', 'Status', 'Took']}>
                {data.jobs.jobs.slice(0, 15).map((j) => <tr key={j.id}><td className="px-5 py-2 text-xs">{stamp(j.createdAt)}</td><td className="px-5 py-2 text-xs">{JOB_KIND[j.kind] ?? j.kind}</td><td className="px-5 py-2 text-xs">{j.status.toLowerCase()}{j.lastError ? `: ${j.lastError}` : ''}</td><td className="px-5 py-2 text-xs">{ms(j.tookMs)}</td></tr>)}
              </DataTable>
            </Panel>
          </div>
        </>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Switch off ${name}'s gate link`}>
        <form className="space-y-4 text-sm" onSubmit={(e) => { e.preventDefault(); void run('off', async () => { await api.post(`/platform/biostar/schools/${schoolId}/disable`, { reason }); setConfirm(false); await refetch({ silent: true }); }); }}>
          <p>The connector's token stops working now and every waiting job is cancelled. The school's ICT is shown your reason.</p>
          <label className="block">Reason<input id="kill-reason" className={`${inputCls} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 5 || busy === 'off'}>Switch off</Button></div>
        </form>
      </Modal>
    </div>
  );
}
