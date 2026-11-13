import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Circle, Copy, KeyRound, Loader2, Play, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { stamp } from './visitorsApi';

/**
 * BioStar 2 link (2026-11-13) — ICT connects the school's BioStar 2 barrier: a connector inside the
 * school's network calls out to Tcheck with a token generated here, reports BioStar's access groups
 * and readers, and from then on visitor QR codes (and delegate passes) open the barrier and barrier
 * scans check people in and out. A guided setup, a self-test against the real BioStar, the live
 * gate feed and the queue's health.
 */

interface Named { id: string; name: string }
interface Status {
  configured: boolean;
  online: boolean;
  integration: null | {
    enabled: boolean; visitorAccessGroupId: string | null; delegateAccessGroupId: string | null; userGroupId: string | null;
    qrCardType: 6 | 7; syncWalkInTags: boolean; entryDeviceIds: string[]; exitDeviceIds: string[];
    lastSeenAt: string | null; agentVersion: string | null; biostarVersion: string | null; lastEventAt: string | null; agentTokenCreatedAt: string | null;
    inventory: null | { accessGroups?: Named[]; userGroups?: Named[]; devices?: Named[] };
  };
  jobs: Partial<Record<'PENDING' | 'CLAIMED' | 'DONE' | 'FAILED', number>>;
  failedJobs: { id: string; kind: string; attempts: number; lastError: string | null; createdAt: string }[];
  recentEvents: { id: string; occurredAt: string; deviceId: string | null; eventName: string | null; kind: string; outcome: string; matchedType: string | null }[];
  selfTest: null | { id: string; status: string; lastError: string | null; createdAt: string; doneAt: string | null; result: null | { steps?: { step: string; ok: boolean; detail: string | null }[] } };
}

const OUTCOME: Record<string, ['green' | 'blue' | 'red' | 'purple' | 'gray' | 'yellow', string]> = {
  CHECKED_IN: ['green', 'Checked in'], CHECKED_OUT: ['blue', 'Checked out'], DELEGATE: ['purple', 'Delegate'],
  NO_MATCH: ['gray', 'Not a Tcheck pass'], IGNORED: ['gray', 'Recorded'],
};
const JOB_LABEL: Record<string, string> = { GRANT_VISITOR: 'Give a visitor access', GRANT_WALKIN: 'Give a walk-in tag access', GRANT_DELEGATE: 'Give a delegate access', REVOKE: 'Remove access', SELF_TEST: 'Self-test' };

function ago(iso: string | null) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : stamp(iso);
}

function Step({ n, title, done, children, active }: { n: number; title: string; done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <li className={`relative pl-10 pb-7 last:pb-0 ${active || done ? '' : 'opacity-60'}`}>
      <span className="absolute left-[13px] top-7 bottom-0 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
      <span className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
        {done ? <CheckCircle2 size={16} /> : n}
      </span>
      <p className="font-semibold text-slate-950 dark:text-white leading-7">{title}</p>
      <div className="mt-2 space-y-3 text-sm text-slate-600 dark:text-slate-400">{children}</div>
    </li>
  );
}

export function BarrierPage({ embedded = false }: { embedded?: boolean } = {}) {
  const Heading = embedded ? 'h2' : 'h1';
  const { data, refetch } = useApi<Status>('/visitors/biostar', { refetchIntervalMs: 8000, refetchWhenVisible: true });
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const integ = data?.integration ?? null;
  const inv = integ?.inventory ?? null;
  const [form, setForm] = useState({ visitorAccessGroupId: '', delegateAccessGroupId: '', userGroupId: '', qrCardType: 6 as 6 | 7, syncWalkInTags: false, entry: [] as string[], exit: [] as string[] });
  const [formFor, setFormFor] = useState<string | null>(null);
  // Load the saved choices once per integration (not on every 8-second refresh, which would undo edits).
  const key = integ ? `${integ.visitorAccessGroupId}|${integ.entryDeviceIds.join()}|${integ.exitDeviceIds.join()}|${integ.agentTokenCreatedAt}` : null;
  useEffect(() => {
    if (!integ || key === formFor) return;
    setFormFor(key);
    setForm({ visitorAccessGroupId: integ.visitorAccessGroupId ?? '', delegateAccessGroupId: integ.delegateAccessGroupId ?? '', userGroupId: integ.userGroupId ?? '', qrCardType: integ.qrCardType, syncWalkInTags: integ.syncWalkInTags, entry: integ.entryDeviceIds, exit: integ.exitDeviceIds });
  }, [integ, key, formFor]);

  const deviceName = useMemo(() => new Map((inv?.devices ?? []).map((d) => [d.id, d.name])), [inv]);
  const run = async (k: string, fn: () => Promise<unknown>) => { setBusy(k); setError(null); try { await fn(); await refetch({ silent: true }); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(null); } };
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1800); } catch { setCopied(null); } };
  const save = (extra: Record<string, unknown> = {}) => run('save', () => api.put('/visitors/biostar/settings', {
    visitorAccessGroupId: form.visitorAccessGroupId || null, delegateAccessGroupId: form.delegateAccessGroupId || null, userGroupId: form.userGroupId || null,
    qrCardType: form.qrCardType, syncWalkInTags: form.syncWalkInTags, entryDeviceIds: form.entry, exitDeviceIds: form.exit, ...extra,
  }));

  const apiUrl = `${window.location.origin}/api`;
  const command = `TCHECK_URL=${apiUrl} \\\nTCHECK_TOKEN=${token ?? '<your token>'} \\\nBIOSTAR_URL=https://<biostar-server> \\\nBIOSTAR_LOGIN_ID=<operator> BIOSTAR_PASSWORD=<password> \\\nnode connector.mjs`;
  const selfSteps = data?.selfTest?.result?.steps ?? [];
  const selfOk = data?.selfTest?.status === 'DONE';
  const choicesDone = !!integ?.visitorAccessGroupId;
  const steps = { token: !!data?.configured, online: !!data?.online, choices: choicesDone, test: selfOk, on: !!integ?.enabled };
  const toggleReader = (id: string, side: 'entry' | 'exit') => setForm((f) => {
    const other = side === 'entry' ? 'exit' : 'entry';
    const has = f[side].includes(id);
    return { ...f, [side]: has ? f[side].filter((x) => x !== id) : [...f[side], id], [other]: f[other].filter((x) => x !== id) };
  });
  const select = 'w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading className={embedded ? 'text-lg font-semibold text-slate-950 dark:text-white' : 'text-2xl font-bold text-slate-950 dark:text-white'}>Barrier (BioStar 2)</Heading>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">Connect your Suprema BioStar 2 barrier: visitors scan the QR code in their email to walk in, and the barrier checks them in and out — no guard needed.</p>
        </div>
        {data && (
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ring-1 ${data.online ? 'bg-emerald-50 ring-emerald-600/20 dark:bg-emerald-500/10' : 'bg-slate-100 ring-slate-500/10 dark:bg-white/5'}`} role="status">
            <span className="relative flex h-2.5 w-2.5">
              {data.online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${data.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-slate-950 dark:text-white">{!data.configured ? 'Not set up' : data.online ? (integ?.enabled ? 'Live at the barrier' : 'Connected · switched off') : 'Connector offline'}</p>
              <p className="text-xs text-slate-500">{data.configured ? `Last heard ${ago(integ?.lastSeenAt ?? null)}${integ?.agentVersion ? ` · connector ${integ.agentVersion}` : ''}` : 'Follow the steps below'}</p>
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-red-500/10 dark:text-red-300"><XCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <ol className="glass-card p-6">
          <Step n={1} title="Create the connector token" done={steps.token && !token} active={!steps.token || !!token}>
            <p>The connector runs on a computer inside your network that can reach the BioStar 2 server, and only ever calls out to Tcheck — you open no firewall port.</p>
            {token ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Copy this token now — it won't be shown again.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 font-mono text-xs text-slate-900 dark:bg-slate-900 dark:text-white">{token}</code>
                  <Button size="sm" variant="secondary" onClick={() => copy(token, 'token')}><Copy size={14} className="mr-1.5" />{copied === 'token' ? 'Copied' : 'Copy'}</Button>
                </div>
              </div>
            ) : null}
            <Button size="sm" variant={steps.token ? 'secondary' : 'primary'} disabled={busy === 'token'} onClick={() => run('token', async () => { const r = await api.post<{ token: string }>('/visitors/biostar/token'); setToken(r.token); })}>
              <KeyRound size={14} className="mr-1.5" />{steps.token ? 'Replace token (disconnects the old connector)' : 'Generate token'}
            </Button>
          </Step>

          <Step n={2} title="Start the connector" done={steps.online} active={steps.token && !steps.online}>
            <p>On that computer (Node.js 22 or newer), run <code className="font-mono text-xs">connector.mjs</code> with your BioStar operator account. It reconnects on its own and catches up on any scans it missed.</p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 pr-20 font-mono text-xs leading-relaxed text-slate-100">{command}</pre>
              <Button size="sm" variant="secondary" className="absolute right-2 top-2" onClick={() => copy(command, 'cmd')}>{copied === 'cmd' ? 'Copied' : 'Copy'}</Button>
            </div>
            {steps.token && !steps.online && <p className="flex items-center gap-2 text-xs"><Loader2 size={14} className="animate-spin" /> Waiting for the connector to check in…</p>}
          </Step>

          <Step n={3} title="Choose access groups and readers" done={steps.choices} active={steps.online && !steps.choices}>
            {!inv?.accessGroups?.length ? <p>Once the connector is running, your BioStar access groups and readers appear here.</p> : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Visitors' access group</span>
                    <select className={select} value={form.visitorAccessGroupId} onChange={(e) => setForm({ ...form, visitorAccessGroupId: e.target.value })}>
                      <option value="">Choose…</option>{inv.accessGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select></label>
                  <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Delegates' access group</span>
                    <select className={select} value={form.delegateAccessGroupId} onChange={(e) => setForm({ ...form, delegateAccessGroupId: e.target.value })}>
                      <option value="">Not yet</option>{inv.accessGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select></label>
                  <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">BioStar user group</span>
                    <select className={select} value={form.userGroupId} onChange={(e) => setForm({ ...form, userGroupId: e.target.value })}>
                      <option value="">All Users</option>{(inv.userGroups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select></label>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Readers — mark which way people go through each one</p>
                  <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                    {(inv.devices ?? []).map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span className="text-slate-800 dark:text-slate-200">{d.name} <span className="text-xs text-slate-400">#{d.id}</span></span>
                        <div className="flex gap-1.5" role="group" aria-label={`Direction for ${d.name}`}>
                          {(['entry', 'exit'] as const).map((side) => (
                            <button key={side} type="button" aria-pressed={form[side].includes(d.id)} onClick={() => toggleReader(d.id, side)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer ${form[side].includes(d.id) ? (side === 'entry' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white') : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                              {side === 'entry' ? 'In' : 'Out'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">Leave all unmarked and the first scan checks a visitor in, the next checks them out.</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2"><span className="text-xs font-medium text-slate-700 dark:text-slate-300">QR type</span>
                    <select className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm" value={form.qrCardType} onChange={(e) => setForm({ ...form, qrCardType: Number(e.target.value) as 6 | 7 })}>
                      <option value={6}>QR/Barcode — Tcheck's own code (recommended)</option><option value={7}>BioStar 2 QR</option>
                    </select></label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={form.syncWalkInTags} onChange={(e) => setForm({ ...form, syncWalkInTags: e.target.checked })} />Walk-in tags open the barrier too</label>
                </div>
                <Button size="sm" disabled={busy === 'save' || !form.visitorAccessGroupId} onClick={() => save()}>{busy === 'save' ? 'Saving…' : 'Save choices'}</Button>
              </>
            )}
          </Step>

          <Step n={4} title="Run the self-test on your BioStar" done={steps.test} active={steps.choices && !steps.test}>
            <p>Creates a throwaway visitor with a QR card on your real BioStar, reads it back, then removes it — so you know it works before anyone reaches the barrier.</p>
            {data?.selfTest && (
              <ul className="space-y-1.5 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                {data.selfTest.status === 'PENDING' || data.selfTest.status === 'CLAIMED'
                  ? <li className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Running on your BioStar…</li>
                  : selfSteps.map((s) => (
                    <li key={s.step} className="flex items-start gap-2">
                      {s.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />}
                      <span><span className="text-slate-900 dark:text-slate-100">{s.step}</span>{s.detail && <span className="block text-xs text-slate-500">{s.detail}</span>}</span>
                    </li>
                  ))}
              </ul>
            )}
            <Button size="sm" variant="secondary" disabled={!steps.online || busy === 'test' || data?.selfTest?.status === 'PENDING' || data?.selfTest?.status === 'CLAIMED'} onClick={() => run('test', () => api.post('/visitors/biostar/self-test'))}>
              <Play size={14} className="mr-1.5" />{data?.selfTest ? 'Run again' : 'Run self-test'}
            </Button>
          </Step>

          <Step n={5} title="Switch on" done={steps.on} active={steps.test && !steps.on}>
            <p>From now on every new invitation becomes a barrier pass, still-valid invitations are added straight away, and a pass stops working when the visit ends or is cancelled.</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" role="switch" className="h-5 w-5 accent-emerald-600" checked={!!integ?.enabled} disabled={!steps.choices || busy === 'save'} onChange={(e) => save({ enabled: e.target.checked })} />
              <span className="font-medium text-slate-900 dark:text-slate-100">{integ?.enabled ? 'On — QR codes open the barrier' : 'Off'}</span>
            </label>
            {!steps.test && steps.choices && <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><ShieldAlert size={14} />Run the self-test first.</p>}
          </Step>
        </ol>

        <div className="space-y-6">
          <section className="glass-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white"><Activity size={16} className="text-blue-500" />Gate activity</h2>
            {!data?.recentEvents.length ? <p className="mt-3 text-sm text-slate-500">Barrier scans appear here as they happen.</p> : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                {data.recentEvents.map((e) => {
                  const [color, label] = e.kind === 'DENIED' ? (['red', 'Denied'] as const) : (OUTCOME[e.outcome] ?? ['gray', e.outcome]);
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-900 dark:text-slate-100">{(e.deviceId && deviceName.get(e.deviceId)) ?? (e.deviceId ? `Reader ${e.deviceId}` : 'BioStar')}</span>
                        <span className="block text-xs text-slate-500">{ago(e.occurredAt)}{e.eventName ? ` · ${e.eventName.replace(/_/g, ' ').toLowerCase()}` : ''}</span>
                      </span>
                      <Badge color={color}>{label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="glass-card p-5">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Sync queue</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
              {([['Waiting', (data?.jobs.PENDING ?? 0) + (data?.jobs.CLAIMED ?? 0)], ['Done', data?.jobs.DONE ?? 0], ['Failed', data?.jobs.FAILED ?? 0]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 py-2 dark:bg-white/5"><dt className="text-xs text-slate-500">{k}</dt><dd className={`text-lg font-semibold tabular-nums ${k === 'Failed' && v ? 'text-rose-600' : 'text-slate-950 dark:text-white'}`}>{v}</dd></div>
              ))}
            </dl>
            {data?.failedJobs.length ? (
              <ul className="mt-3 space-y-2">
                {data.failedJobs.map((j) => (
                  <li key={j.id} className="rounded-xl border border-rose-200 p-3 text-sm dark:border-red-500/20">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-slate-100">{JOB_LABEL[j.kind] ?? j.kind}</span>
                      <Button size="sm" variant="secondary" disabled={busy === j.id} onClick={() => run(j.id, () => api.post(`/visitors/biostar/jobs/${j.id}/retry`))}><RefreshCw size={13} className="mr-1.5" />Retry</Button></div>
                    <p className="mt-1 text-xs text-rose-700 dark:text-red-400">{j.lastError}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Circle size={10} className="fill-emerald-500 text-emerald-500" />Nothing stuck.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
