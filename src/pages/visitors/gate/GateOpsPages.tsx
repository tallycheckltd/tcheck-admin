import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TablePager } from '../../../components/ui/TablePager';
import { GateShell, Panel, DataTable, ErrorLine, Tile } from './gateShared';
import { useGateLive, useAction, ago, ms, ALERT_KIND, JOB_KIND, CREDENTIAL, REASON, inputCls, selectCls } from './gateLib';
import { stamp } from '../visitorsApi';

/**
 * Gate access (2026-11-20) — the operational pages: Suspicious activity, Sync jobs, BioStar check,
 * Reports and audit.
 */

// ─── Suspicious activity ────────────────────────────────────────────────────────────────────────

interface Alert { id: string; kind: string; title: string; count: number; createdAt: string; lastAt: string; resolvedAt: string | null; emailedAt: string | null; note: string | null; person: string | null; personKind: string | null; identityId: string | null; reader: string | null; tablet: string | null; detail: Record<string, unknown> | null }

export function GateAlertsPage() {
  const [open, setOpen] = useState<'true' | 'false' | ''>('true');
  const [kind, setKind] = useState('');
  const qs = new URLSearchParams({ ...(open ? { open } : {}), ...(kind ? { kind } : {}) }).toString();
  const { data, refetch } = useApi<{ alerts: Alert[]; open: number }>(`/visitors/alerts?${qs}`);
  useGateLive(() => void refetch({ silent: true }), ['alert']);
  const { busy, error, run } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const resolve = (a: Alert) => run(a.id, async () => { await api.post(`/visitors/alerts/${a.id}/resolve`, { note: notes[a.id] || undefined }); await refetch({ silent: true }); });
  return (
    <GateShell title="Suspicious activity" intro="Signs that a pass may have been shared, and flap barriers that need a look. BioStar already refused the scan; these make it visible. ICT Admins get an email for the first few of each kind a day.">
      <ErrorLine error={error} />
      <div className="flex flex-wrap gap-2">
        <select id="al-open" aria-label="Show" className={selectCls} value={open} onChange={(e) => setOpen(e.target.value as 'true')}><option value="true">Open</option><option value="false">Resolved</option><option value="">All</option></select>
        <select id="al-kind" aria-label="Kind" className={selectCls} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Every kind</option>{Object.entries(ALERT_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      {data && !data.alerts.length && <Panel title="Nothing here"><p className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck size={16} className="text-emerald-500" />No {open === 'true' ? 'open ' : ''}alerts.</p></Panel>}
      <div className="space-y-3">
        {data?.alerts.map((a) => (
          <section key={a.id} className={`glass-card p-4 ${a.resolvedAt ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2"><Badge color={a.resolvedAt ? 'gray' : a.kind === 'DOOR_FORCED' || a.kind === 'TWO_READERS' ? 'red' : 'yellow'}>{ALERT_KIND[a.kind] ?? a.kind}</Badge>{a.count > 1 && <span className="text-xs text-slate-500">{a.count} times</span>}</p>
                <p className="mt-1 font-medium text-slate-950 dark:text-white">{a.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  First {stamp(a.createdAt)} · last {ago(a.lastAt)}{a.reader ? ` · ${a.reader}` : ''}{a.tablet ? ` · ${a.tablet}` : ''}{a.emailedAt ? ' · ICT emailed' : ''}
                  {a.identityId && <> · <Link to={`/visitors/gate/people/${a.identityId}`} className="text-blue-600 hover:underline dark:text-blue-400">{a.person}</Link></>}
                </p>
                {a.resolvedAt && <p className="mt-1 text-xs text-slate-500">Resolved {stamp(a.resolvedAt)}{a.note ? `: ${a.note}` : ''}</p>}
              </div>
              {!a.resolvedAt && (
                <form className="flex w-full gap-2 sm:w-auto" onSubmit={(e) => { e.preventDefault(); void resolve(a); }}>
                  <input id={`note-${a.id}`} aria-label="Note" className={inputCls} placeholder="What you found (optional)" value={notes[a.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} />
                  <Button size="sm" variant="secondary" disabled={busy === a.id}>Resolve</Button>
                </form>
              )}
            </div>
          </section>
        ))}
      </div>
    </GateShell>
  );
}

// ─── Sync jobs ──────────────────────────────────────────────────────────────────────────────────

interface Job { id: string; kind: string; status: string; attempts: number; lastError: string | null; createdAt: string; claimedAt: string | null; doneAt: string | null; tookMs: number | null; person: string | null; personKind: string | null; identityId: string | null; reason: string | null; door: string | null; summary: string | null; steps: { step: string; ok: boolean }[] | null }

export function GateJobsPage() {
  const [params] = useSearchParams();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [kind, setKind] = useState('');
  const qs = new URLSearchParams({ page: String(page + 1), pageSize: String(size), ...(status ? { status } : {}), ...(kind ? { kind } : {}) }).toString();
  const { data, refetch } = useApi<{ total: number; jobs: Job[] }>(`/visitors/biostar/jobs?${qs}`);
  useGateLive(() => void refetch({ silent: true }), ['job']);
  const { busy, error, run } = useAction();
  const retry = (j: Job) => run(j.id, async () => { await api.post(`/visitors/biostar/jobs/${j.id}/retry`); await refetch({ silent: true }); });
  return (
    <GateShell title="Sync jobs" intro="Every change Tcheck sends to BioStar through the connector, and how long BioStar took. Failed jobs retry on their own (up to 8 times); a barrier-open or fingerprint request is never retried later.">
      <ErrorLine error={error} />
      <Panel title={data ? `${data.total} job(s)` : 'Jobs'}>
        <div className="mb-4 flex flex-wrap gap-2">
          <select id="job-status" aria-label="Status" className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">Any status</option><option value="PENDING">Waiting</option><option value="CLAIMED">Running</option><option value="DONE">Done</option><option value="FAILED">Failed</option></select>
          <select id="job-kind" aria-label="Kind" className={selectCls} value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}><option value="">Every kind</option>{['SYNC_IDENTITY', 'OPEN_DOOR', 'ENROLL_FINGERPRINT', 'DELETE_BIOMETRIC', 'RECONCILE', 'SELF_TEST', 'REVOKE'].map((k) => <option key={k} value={k}>{JOB_KIND[k]}</option>)}</select>
        </div>
        <DataTable head={['Queued', 'What', 'For', 'Status', 'Took', '']} empty={data && !data.jobs.length ? 'No jobs.' : false}>
          {data?.jobs.map((j) => (
            <tr key={j.id}>
              <td className="px-5 py-2.5 text-xs tabular-nums">{stamp(j.createdAt)}</td>
              <td className="px-5 py-2.5 text-xs">{JOB_KIND[j.kind] ?? j.kind}{j.summary ? <span className="block text-slate-500">{j.summary}</span> : null}{j.reason ? <span className="block text-slate-500">{j.reason.toLowerCase().replace(/_/g, ' ')}</span> : null}</td>
              <td className="px-5 py-2.5 text-xs">{j.identityId ? <Link to={`/visitors/gate/people/${j.identityId}`} className="hover:underline">{j.person}</Link> : j.door ?? '—'}</td>
              <td className="px-5 py-2.5">{j.status === 'DONE' ? <Badge color="green">Done</Badge> : j.status === 'FAILED' ? <Badge color="red">Failed</Badge> : j.status === 'CLAIMED' ? <Badge color="blue">Running</Badge> : <Badge color="yellow">{j.attempts ? `Retrying (try ${j.attempts + 1})` : 'Waiting'}</Badge>}{j.lastError && <span className="block max-w-xs text-xs text-rose-600">{j.lastError}</span>}</td>
              <td className="px-5 py-2.5 text-xs tabular-nums">{ms(j.tookMs)}</td>
              <td className="px-5 py-2.5 text-right">{j.status === 'FAILED' && j.kind !== 'OPEN_DOOR' && <Button size="sm" variant="ghost" disabled={busy === j.id} onClick={() => void retry(j)}><RefreshCw size={14} /> Retry</Button>}</td>
            </tr>
          ))}
        </DataTable>
        {data && <TablePager page={page} pageSize={size} total={data.total} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(0); }} noun="jobs" />}
      </Panel>
    </GateShell>
  );
}

// ─── BioStar check ──────────────────────────────────────────────────────────────────────────────

interface Diff { type: string; biostarUserId: string; identityId: string | null; name: string | null; detail: string }
const DIFF: Record<string, string> = { ONLY_IN_BIOSTAR: 'In BioStar only', MISSING_IN_BIOSTAR: 'Missing from BioStar', ACCESS_DIFFERS: 'Access differs', CARDS_DIFFER: 'Codes differ', FINGERPRINT_DIFFERS: 'Fingerprint differs' };

export function GateCheckPage() {
  const { data, refetch } = useApi<{ job: { id: string; status: string; createdAt: string; doneAt?: string; usersChecked?: number; error?: string } | null; differences: Diff[] }>('/visitors/biostar/reconcile');
  useGateLive(() => void refetch({ silent: true }), ['job']);
  const { busy, error, run } = useAction();
  const running = data?.job && (data.job.status === 'PENDING' || data.job.status === 'CLAIMED');
  return (
    <GateShell title="BioStar check" intro="Compares every BioStar user marked Tcheck with what Tcheck expects: access on or off, codes and fingerprints. Fixing re-sends Tcheck's view; a BioStar user Tcheck doesn't know is switched off."
      actions={<Button disabled={!!running || busy === 'run'} onClick={() => void run('run', async () => { await api.post('/visitors/biostar/reconcile'); await refetch({ silent: true }); })}>{running ? <><Loader2 size={14} className="animate-spin" /> Checking…</> : 'Run the check'}</Button>}>
      <ErrorLine error={error} />
      {!data?.job && <Panel title="Not run yet"><p className="text-sm text-slate-500">Run the check after setting up, and whenever BioStar was changed by hand.</p></Panel>}
      {data?.job && (
        <Panel title={data.job.status === 'DONE' ? `${data.differences.length} difference(s)` : 'Check in progress'} hint={`Started ${stamp(data.job.createdAt)}${data.job.usersChecked != null ? ` · ${data.job.usersChecked} BioStar user(s) checked` : ''}`}
          actions={data.differences.length ? <Button size="sm" variant="secondary" disabled={busy === 'fix'} onClick={() => void run('fix', async () => { await api.post('/visitors/biostar/reconcile/fix', {}); await refetch({ silent: true }); })}>Fix all</Button> : null}>
          {data.job.status === 'FAILED' && <p className="text-sm text-rose-600">{data.job.error}</p>}
          {data.job.status === 'DONE' && !data.differences.length && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><ShieldCheck size={16} />BioStar matches Tcheck.</p>}
          {!!data.differences.length && (
            <DataTable head={['Difference', 'Person', 'BioStar user', 'Detail']}>
              {data.differences.map((d) => (
                <tr key={`${d.type}-${d.biostarUserId}`}>
                  <td className="px-5 py-2.5"><Badge color={d.type === 'ONLY_IN_BIOSTAR' || d.type === 'ACCESS_DIFFERS' ? 'red' : 'yellow'}>{DIFF[d.type] ?? d.type}</Badge></td>
                  <td className="px-5 py-2.5">{d.identityId ? <Link to={`/visitors/gate/people/${d.identityId}`} className="hover:underline">{d.name}</Link> : '—'}</td>
                  <td className="px-5 py-2.5 font-mono text-xs">{d.biostarUserId}</td>
                  <td className="px-5 py-2.5 text-xs">{d.detail}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}
    </GateShell>
  );
}

// ─── Reports and audit ──────────────────────────────────────────────────────────────────────────

interface Report {
  totals: { entries: number; exits: number; refusals: number };
  days: { day: string; entries: number; exits: number; refusals: number; visitors: number; people: number }[];
  hours: { hour: number; entries: number }[];
  doors: { door: string; entries: number; exits: number; refusals: number }[];
  credentials: { type: string; count: number }[];
  refusalReasons: { reason: string; count: number }[];
  fingerprints: { enrolled: number; enrolledInRange: number; deletedInRange: number };
}
interface Audit { total: number; entries: { id: string; at: string; action: string; actor: string; actorRole: string; entityType: string; after: Record<string, unknown> | null }[] }
const ACTION: Record<string, string> = {
  'gate.doorOpened': 'Opened a barrier', 'gate.accessSuspended': 'Suspended access', 'gate.accessResumed': 'Resumed access', 'gate.credentialRevoked': 'Revoked a code',
  'gate.alertResolved': 'Resolved an alert', 'gate.biometricConsent': 'Fingerprint consent', 'gate.biometricConsentWithdrawn': 'Consent withdrawn', 'gate.biometricEnrolStarted': 'Started fingerprint enrolment',
  'gate.biometricEnrolled': 'Fingerprint enrolled', 'gate.biometricDeleteRequested': 'Fingerprint deletion requested', 'gate.biometricDeleted': 'Fingerprint deleted',
  'gate.readerChanged': 'Changed a reader or lane', 'gate.tabletDoorLinked': 'Linked a tablet to a lane', 'gate.reconcileFixed': 'Fixed BioStar differences',
  'gate.platformDisabled': 'Tcheck support switched the link off', 'gate.platformEnabled': 'Tcheck support switched the link on',
  'biostar.tokenGenerated': 'New connector token', 'biostar.settingsChanged': 'Changed flap barrier settings', 'visitor.passDeviceReset': 'Moved a visitor pass to another phone',
};
const BLUE = '#3B82F6';
const AXIS = { fontSize: 11, fill: '#94a3b8' } as const;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function GateReportsPage() {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 6 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const range = useMemo(() => `from=${encodeURIComponent(new Date(`${from}T00:00:00`).toISOString())}&to=${encodeURIComponent(new Date(`${to}T23:59:59`).toISOString())}`, [from, to]);
  const { data: r, loading, error } = useApi<Report>(`/visitors/biostar/reports?${range}`);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const { data: audit } = useApi<Audit>(`/visitors/biostar/audit?page=${page + 1}&pageSize=${size}`);
  const csv = () => {
    if (!r) return;
    const lines = ['Day,Entries,Exits,Refused,Visitors,Delegates and staff', ...r.days.map((d) => [d.day, d.entries, d.exits, d.refusals, d.visitors, d.people].join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `flap-barrier-report-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <GateShell title="Reports and audit" intro="Passages through your flap barriers, refusals and fingerprints for a period, and every change made (who, when, why)."
      actions={<Button variant="secondary" size="sm" onClick={csv} disabled={!r}>Download CSV</Button>}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">From<input id="rep-from" type="date" className={`${inputCls} mt-1`} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-slate-500">To<input id="rep-to" type="date" className={`${inputCls} mt-1`} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <ErrorLine error={error} />
      {loading && !r && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading…</p>}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label="Entries" value={r.totals.entries} /><Tile label="Exits" value={r.totals.exits} /><Tile label="Refused" value={r.totals.refusals} />
            <Tile label="Fingerprints enrolled" value={r.fingerprints.enrolled} sub={`+${r.fingerprints.enrolledInRange} in period`} />
            <Tile label="Fingerprints deleted" value={r.fingerprints.deletedInRange} sub="in period" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Passages in per day">
              <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.days} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} /><XAxis dataKey="day" tick={AXIS} tickFormatter={(d: string) => d.slice(5)} /><YAxis tick={AXIS} allowDecimals={false} /><Tooltip /><Bar dataKey="entries" name="Entries" fill={BLUE} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Busiest hours" hint="Entries by hour of day">
              <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.hours} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} /><XAxis dataKey="hour" tick={AXIS} tickFormatter={(h: number) => String(h).padStart(2, '0')} /><YAxis tick={AXIS} allowDecimals={false} /><Tooltip labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`} /><Bar dataKey="entries" name="Entries" fill={BLUE} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="By lane">
              <DataTable head={['Lane', 'Passages in', 'Passages out', 'Refused']} empty={!r.doors.length ? 'No scans in this period.' : false}>
                {r.doors.map((d) => <tr key={d.door}><td className="px-5 py-2">{d.door}</td><td className="px-5 py-2 tabular-nums">{d.entries}</td><td className="px-5 py-2 tabular-nums">{d.exits}</td><td className="px-5 py-2 tabular-nums">{d.refusals}</td></tr>)}
              </DataTable>
            </Panel>
            <Panel title="How people got in, and why scans were refused">
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <ul className="space-y-1">{r.credentials.map((c) => <li key={c.type} className="flex justify-between"><span>{CREDENTIAL[c.type] ?? c.type}</span><span className="tabular-nums">{c.count}</span></li>)}{!r.credentials.length && <li className="text-slate-500">None</li>}</ul>
                <ul className="space-y-1">{r.refusalReasons.map((c) => <li key={c.reason} className="flex justify-between"><span>{REASON[c.reason] ?? c.reason.toLowerCase().replace(/_/g, ' ')}</span><span className="tabular-nums">{c.count}</span></li>)}{!r.refusalReasons.length && <li className="text-slate-500">No refusals</li>}</ul>
              </div>
            </Panel>
          </div>
        </>
      )}
      <Panel title="Flap barrier audit log" hint="Every barrier opened from Tcheck, code revoked, access suspended, fingerprint enrolled or deleted, and setting changed.">
        <DataTable head={['When', 'Who', 'What', 'Detail']} empty={audit && !audit.entries.length ? 'Nothing yet.' : false}>
          {audit?.entries.map((e) => (
            <tr key={e.id}>
              <td className="px-5 py-2 text-xs tabular-nums">{stamp(e.at)}</td>
              <td className="px-5 py-2 text-xs">{e.actor}</td>
              <td className="px-5 py-2 text-xs">{ACTION[e.action] ?? e.action}</td>
              <td className="px-5 py-2 text-xs text-slate-500">{e.after ? Object.entries(e.after).filter(([, v]) => v != null && typeof v !== 'object').slice(0, 4).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') : ''}</td>
            </tr>
          ))}
        </DataTable>
        {audit && <TablePager page={page} pageSize={size} total={audit.total} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(0); }} noun="entries" />}
      </Panel>
    </GateShell>
  );
}
