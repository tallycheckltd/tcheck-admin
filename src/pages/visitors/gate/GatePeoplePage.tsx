import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Loader2, RefreshCw } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TablePager } from '../../../components/ui/TablePager';
import { GateShell, Panel, DataTable, ErrorLine } from './gateShared';
import { useGateLive, useAction, ago, time, PERSON_KIND, CRED_STATE, END_REASON, JOB_KIND, CREDENTIAL, REASON, inputCls, selectCls } from './gateLib';
import { stamp } from '../visitorsApi';

/**
 * Gate access → People (2026-11-20): everyone with a BioStar user from Tcheck — delegates, staff,
 * visitors, walk-ins — whether they can get in now and until when, their live codes (last 4 only),
 * fingerprint, last scan and whether BioStar is in step. One person's page has the full timeline:
 * codes, scans and every change sent to BioStar. ICT can suspend, resume and re-send.
 */
interface Person {
  id: string; kind: string; name: string; biostarUserId: string; enabled: boolean; expiresAt: string | null; lastScanAt: string | null; lastSyncedAt: string | null; lastSyncError: string | null;
  suspendedAt: string | null; suspendedReason: string | null; pendingSync: boolean; codes: { last4: string; state: string; validUntil: string; kind: string }[]; fingerprint: { status: string; fingers: number } | null;
}
interface PeoplePage { total: number; page: number; pageSize: number; people: Person[] }

function AccessBadge({ p }: { p: Pick<Person, 'enabled' | 'suspendedAt' | 'pendingSync' | 'lastSyncError'> }) {
  if (p.suspendedAt) return <Badge color="red">Suspended</Badge>;
  if (p.lastSyncError) return <Badge color="red">BioStar error</Badge>;
  if (p.pendingSync) return <Badge color="yellow">Updating BioStar</Badge>;
  return p.enabled ? <Badge color="green">Can enter</Badge> : <Badge color="gray">No access now</Badge>;
}

export function GatePeoplePage() {
  const { id } = useParams();
  return id ? <PersonDetail id={id} /> : <PeopleList />;
}

function PeopleList() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [f, setF] = useState({ kind: '', access: '', search: '' });
  const qs = useMemo(() => { const p = new URLSearchParams({ page: String(page + 1), pageSize: String(size) }); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); return p.toString(); }, [page, size, f]);
  const { data, refetch } = useApi<PeoplePage>(`/visitors/biostar/people?${qs}`);
  useGateLive(() => void refetch({ silent: true }), ['identity']);
  const set = (k: keyof typeof f, v: string) => { setPage(0); setF((x) => ({ ...x, [k]: v })); };
  const [grantOpen, setGrantOpen] = useState(false);
  return (
    <GateShell title="People" intro="Everyone Tcheck has put in BioStar. Codes show their last 4 characters only."
      actions={<Button onClick={() => setGrantOpen(true)}><GraduationCap size={16} /> Give a programme access</Button>}>
      {grantOpen && <ProgrammeAccessModal onClose={() => { setGrantOpen(false); void refetch({ silent: true }); }} />}
      <Panel title={data ? `${data.total} people` : 'People'}>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-slate-500">Who<select id="ppl-kind" className={`${selectCls} mt-1 w-full`} value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="">Everyone</option><option value="PERSON">Delegates and staff</option><option value="VISITOR">Visitors</option><option value="WALKIN">Walk-ins</option></select></label>
          <label className="text-xs text-slate-500">Access<select id="ppl-access" className={`${selectCls} mt-1 w-full`} value={f.access} onChange={(e) => set('access', e.target.value)}><option value="">Any</option><option value="on">Can enter now</option><option value="off">No access now</option><option value="suspended">Suspended</option></select></label>
          <label className="text-xs text-slate-500">Name<input id="ppl-search" className={`${inputCls} mt-1`} value={f.search} onChange={(e) => set('search', e.target.value)} placeholder="Search" /></label>
        </div>
        <DataTable head={['Person', 'Access', 'Until', 'Codes', 'Fingerprint', 'Last scan', 'BioStar']} empty={data && !data.people.length ? 'No one yet.' : false}>
          {data?.people.map((p) => (
            <tr key={p.id}>
              <td className="px-5 py-2.5"><Link to={`/visitors/gate/people/${p.id}`} className="font-medium text-slate-950 hover:underline dark:text-white">{p.name}</Link><span className="block text-xs text-slate-500">{PERSON_KIND[p.kind]} · BioStar {p.biostarUserId}</span></td>
              <td className="px-5 py-2.5"><AccessBadge p={p} /></td>
              <td className="px-5 py-2.5 text-xs tabular-nums">{p.enabled && p.expiresAt ? stamp(p.expiresAt) : '—'}</td>
              <td className="px-5 py-2.5 text-xs">{p.codes.length ? p.codes.map((c) => `${c.last4} (${CRED_STATE[c.state]?.[1] ?? c.state})`).join(', ') : '—'}</td>
              <td className="px-5 py-2.5 text-xs">{p.fingerprint?.status === 'ENROLLED' ? `${p.fingerprint.fingers} finger(s)` : p.fingerprint ? p.fingerprint.status.toLowerCase() : '—'}</td>
              <td className="px-5 py-2.5 text-xs">{ago(p.lastScanAt)}</td>
              <td className="px-5 py-2.5 text-xs">{p.lastSyncError ? <span className="text-rose-600">{p.lastSyncError}</span> : p.lastSyncedAt ? `in step ${ago(p.lastSyncedAt)}` : 'not sent yet'}</td>
            </tr>
          ))}
        </DataTable>
        {data && <TablePager page={page} pageSize={size} total={data.total} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(0); }} noun="people" />}
      </Panel>
    </GateShell>
  );
}

interface Detail {
  identity: Person & { userId: string | null; inviteId: string | null; displayName: string; accessGroupId: string | null; lastSyncQueuedAt: string | null };
  user: { firstName: string; lastName: string; email: string; role: string; status: string } | null;
  invite: { guestName: string; validFrom: string; validUntil: string; status: string; deviceBoundAt: string | null } | null;
  credentials: { id: string; last4: string; kind: string; state: string; forDay: string | null; validFrom: string; validUntil: string; graceUntil: string | null; issuedAt: string; liveAt: string | null; endedAt: string | null; removedAt: string | null; endReason: string | null }[];
  events: { id: string; at: string; result: string; reason: string | null; credentialType: string | null; door: string | null; reader: string | null; direction: string | null }[];
  jobs: { id: string; kind: string; status: string; reason: string | null; summary: string | null; createdAt: string; tookMs: number | null; lastError: string | null }[];
  fingerprint: { status: string; fingers: number; quality: number | null; consentAt: string; consentSource: string; enrolledAt: string | null; deleteAfter: string | null; failureReason: string | null } | null;
}

function PersonDetail({ id }: { id: string }) {
  const { data, refetch, loading } = useApi<Detail>(`/visitors/biostar/people/${id}`);
  useGateLive(() => void refetch({ silent: true }), ['identity', 'event', 'job']);
  const { busy, error, run } = useAction();
  const [reason, setReason] = useState('');
  const i = data?.identity;
  const act = (k: string, fn: () => Promise<unknown>) => run(k, async () => { await fn(); await refetch({ silent: true }); });
  return (
    <GateShell title={i?.displayName ?? 'Person'} intro={i ? `${PERSON_KIND[i.kind]} · BioStar user ${i.biostarUserId}` : undefined}
      actions={<Link to="/visitors/gate/people" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"><ArrowLeft size={14} /> All people</Link>}>
      <ErrorLine error={error} />
      {loading && !data && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading…</p>}
      {data && i && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Access now">
              <div className="space-y-2 text-sm">
                <p><AccessBadge p={i} /></p>
                <p className="text-slate-600 dark:text-slate-400">{i.enabled && i.expiresAt ? `Until ${stamp(i.expiresAt)} (BioStar ends it by itself then)` : 'The flap barriers will refuse this person now.'}</p>
                {i.suspendedAt && <p className="text-rose-600">Suspended {ago(i.suspendedAt)}: {i.suspendedReason}</p>}
                <p className="text-xs text-slate-500">Last change sent {ago(i.lastSyncQueuedAt)} · in step with BioStar {ago(i.lastSyncedAt)}{i.lastSyncError ? ` · error: ${i.lastSyncError}` : ''}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => void act('resync', () => api.post(`/visitors/biostar/people/${id}/resync`))}><RefreshCw size={14} /> Send to BioStar again</Button>
                  {i.suspendedAt
                    ? <Button size="sm" disabled={!!busy} onClick={() => void act('resume', () => api.post(`/visitors/biostar/people/${id}/resume`))}>Resume access</Button>
                    : <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void act('suspend', () => api.post(`/visitors/biostar/people/${id}/suspend`, { reason })); }}>
                        <input id="suspend-reason" aria-label="Reason to suspend" className={inputCls} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                        <Button size="sm" variant="danger" disabled={reason.trim().length < 3 || !!busy}>Suspend</Button>
                      </form>}
                </div>
              </div>
            </Panel>
            <Panel title="Who">
              {data.user && <dl className="space-y-1 text-sm"><div><dt className="inline text-slate-500">Name: </dt><dd className="inline">{data.user.firstName} {data.user.lastName}</dd></div><div><dt className="inline text-slate-500">Email: </dt><dd className="inline">{data.user.email}</dd></div><div><dt className="inline text-slate-500">Role: </dt><dd className="inline">{data.user.role.toLowerCase().replace(/_/g, ' ')}</dd></div><div><dt className="inline text-slate-500">Account: </dt><dd className="inline">{data.user.status.toLowerCase()}</dd></div></dl>}
              {data.invite && <dl className="space-y-1 text-sm"><div><dt className="inline text-slate-500">Visit: </dt><dd className="inline">{stamp(data.invite.validFrom)} – {stamp(data.invite.validUntil)}</dd></div><div><dt className="inline text-slate-500">Invite: </dt><dd className="inline">{data.invite.status.toLowerCase()}</dd></div><div><dt className="inline text-slate-500">Pass locked to a phone: </dt><dd className="inline">{data.invite.deviceBoundAt ? stamp(data.invite.deviceBoundAt) : 'not opened yet'}</dd></div></dl>}
              {!data.user && !data.invite && <p className="text-sm text-slate-500">Walk-in visitor.</p>}
            </Panel>
            <Panel title="Fingerprint">
              {data.fingerprint ? (
                <dl className="space-y-1 text-sm">
                  <div><dt className="inline text-slate-500">Status: </dt><dd className="inline">{data.fingerprint.status.toLowerCase()}{data.fingerprint.status === 'ENROLLED' ? `, ${data.fingerprint.fingers} finger(s)` : ''}</dd></div>
                  {data.fingerprint.quality != null && <div><dt className="inline text-slate-500">Quality: </dt><dd className="inline">{data.fingerprint.quality}</dd></div>}
                  <div><dt className="inline text-slate-500">Consent: </dt><dd className="inline">{stamp(data.fingerprint.consentAt)} ({data.fingerprint.consentSource === 'APP' ? 'in the app' : 'at the desk'})</dd></div>
                  {data.fingerprint.deleteAfter && <div><dt className="inline text-slate-500">Deleted after: </dt><dd className="inline">{stamp(data.fingerprint.deleteAfter)}</dd></div>}
                  {data.fingerprint.failureReason && <div className="text-rose-600">{data.fingerprint.failureReason}</div>}
                </dl>
              ) : <p className="text-sm text-slate-500">None. <Link to="/visitors/gate/fingerprints" className="text-blue-600 hover:underline dark:text-blue-400">Enrol on the Fingerprints page</Link>.</p>}
            </Panel>
          </div>
          <Panel title="Codes" hint="Every code this person has had. BioStar reads the code; the last 4 characters are shown here.">
            <DataTable head={['Code', 'For', 'State', 'Valid', 'Reached BioStar', 'Ended']} empty={!data.credentials.length ? 'No codes.' : false}>
              {data.credentials.map((c) => {
                const [color, label] = CRED_STATE[c.state] ?? ['gray', c.state];
                return (
                  <tr key={c.id}>
                    <td className="px-5 py-2 font-mono text-xs">{c.last4}{c.kind === 'CSN' ? ' (tag)' : ''}</td>
                    <td className="px-5 py-2 text-xs">{c.forDay ?? '—'}</td>
                    <td className="px-5 py-2"><Badge color={color}>{label}</Badge></td>
                    <td className="px-5 py-2 text-xs tabular-nums">{time(c.validFrom)} – {time(c.validUntil)}{c.graceUntil ? ` (+grace to ${time(c.graceUntil)})` : ''}</td>
                    <td className="px-5 py-2 text-xs">{c.liveAt ? stamp(c.liveAt) : 'not yet'}</td>
                    <td className="px-5 py-2 text-xs">{c.endedAt ? `${END_REASON[c.endReason ?? ''] ?? c.endReason} · ${stamp(c.endedAt)}${c.removedAt ? ' · removed' : ''}` : '—'}</td>
                  </tr>
                );
              })}
            </DataTable>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Scans">
              <DataTable head={['Time', 'How', 'Lane', 'Result']} empty={!data.events.length ? 'No scans yet.' : false}>
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-2 text-xs tabular-nums">{stamp(e.at)}</td>
                    <td className="px-5 py-2 text-xs">{CREDENTIAL[e.credentialType ?? 'UNKNOWN']}</td>
                    <td className="px-5 py-2 text-xs">{e.door ?? e.reader ?? '—'} {e.direction === 'IN' ? '(in)' : e.direction === 'OUT' ? '(out)' : ''}</td>
                    <td className="px-5 py-2">{e.result === 'GRANTED' ? <Badge color="green">Granted</Badge> : <Badge color="red">{REASON[e.reason ?? ''] ?? 'Refused'}</Badge>}</td>
                  </tr>
                ))}
              </DataTable>
            </Panel>
            <Panel title="Changes sent to BioStar">
              <DataTable head={['When', 'What', 'Result']} empty={!data.jobs.length ? 'None.' : false}>
                {data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="px-5 py-2 text-xs tabular-nums">{stamp(j.createdAt)}</td>
                    <td className="px-5 py-2 text-xs">{JOB_KIND[j.kind] ?? j.kind}{j.summary ? ` · ${j.summary}` : ''}{j.reason ? <span className="block text-slate-500">{j.reason.toLowerCase().replace(/_/g, ' ')}</span> : null}</td>
                    <td className="px-5 py-2 text-xs">{j.status === 'DONE' ? <span className="text-emerald-600">Done{j.tookMs != null ? ` in ${j.tookMs < 1000 ? `${j.tookMs} ms` : `${(j.tookMs / 1000).toFixed(1)} s`}` : ''}</span> : j.status === 'FAILED' ? <span className="text-rose-600">Failed: {j.lastError}</span> : j.status.toLowerCase()}</td>
                  </tr>
                ))}
              </DataTable>
            </Panel>
          </div>
        </>
      )}
    </GateShell>
  );
}

interface Programme { id: string; name: string; startDate: string; endDate: string; members: number; withAccess: number; opensAt: string }

/** Every active member of a programme gets the flap barrier pass and today's code at once. */
function ProgrammeAccessModal({ onClose }: { onClose: () => void }) {
  const { data, refetch } = useApi<{ programmes: Programme[] }>('/visitors/biostar/programmes');
  const { busy, error, run } = useAction();
  const [result, setResult] = useState<Record<string, string>>({});
  const grant = (p: Programme) => run(p.id, async () => {
    const r = await api.post<{ members: number; ready: number; notOpenYet: number; failed: number }>(`/visitors/biostar/programmes/${p.id}/grant`);
    setResult((x) => ({ ...x, [p.id]: `${r.ready} of ${r.members} ready${r.notOpenYet ? `, ${r.notOpenYet} open on ${stamp(p.opensAt)}` : ''}${r.failed ? `, ${r.failed} failed` : ''}` }));
    await refetch({ silent: true });
  });
  return (
    <Modal open onClose={onClose} title="Give a programme access">
      <div className="space-y-4 text-sm">
        <p className="text-slate-600 dark:text-slate-400">Everyone in the programme gets their campus pass and today's code on the flap barriers straight away, so the first scan works even before they open the app. Passes open one day before the programme starts.</p>
        <ErrorLine error={error} />
        {!data && <p className="flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin" />Loading programmes…</p>}
        {data && !data.programmes.length && <p className="text-slate-500">No current or upcoming programmes with dates.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {data?.programmes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-950 dark:text-white">{p.name}</p>
                <p className="text-xs text-slate-500">{stamp(p.startDate).split(' ')[0]} – {stamp(p.endDate).split(' ')[0]} · {p.members} member(s) · {p.withAccess} with access</p>
                {result[p.id] && <p className="text-xs text-emerald-700 dark:text-emerald-400">{result[p.id]}</p>}
              </div>
              <Button size="sm" variant={p.withAccess >= p.members ? 'secondary' : 'primary'} disabled={busy === p.id || !p.members} onClick={() => void grant(p)}>
                {busy === p.id ? 'Giving access…' : p.withAccess >= p.members ? 'Refresh access' : 'Give access'}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  );
}
