import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, Check, CheckCircle2, ChevronDown, Copy, Download, KeyRound, Loader2, Play, Plug, Radio, ScanLine, ShieldAlert, Webhook, XCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { stamp } from './visitorsApi';
import { ms, useGateLive } from './gate/gateLib';

/**
 * Flap barriers (2026-11-13; guided setup 2026-11-21) — ICT connects the school's flap barriers through
 * Suprema BioStar 2 in seven steps, each showing its real state: a connector key, the connector
 * running next to BioStar (download plus a ready-made command), the lanes BioStar reported, who goes
 * through (access groups suggested by name), the self-test, a live lane test (a test QR on this screen
 * scanned at a real flap barrier, timed), and switching on. Beside it: flap barrier settings, sending
 * barrier events to another system, and recent activity.
 *
 * 2026-11-21: "Your BioStar" (connector 1.3.0's server check: version, platform, time handling, QR
 * reading per reader) with plain warnings; fingerprints folded into an optional section, since most
 * schools start with visitors only.
 */

interface Named { id: string; name: string }
interface Status {
  configured: boolean;
  online: boolean;
  connectorUpdateRequired?: boolean;
  minConnectorVersion?: string;
  integration: null | {
    enabled: boolean; visitorAccessGroupId: string | null; delegateAccessGroupId: string | null; staffAccessGroupId?: string | null; userGroupId: string | null;
    graceSeconds?: number; biometricsEnabled?: boolean; biometricRetentionDays?: number; openDoorOnCodeCheckIn?: boolean;
    qrCardType: 6 | 7; syncWalkInTags: boolean; lastSeenAt: string | null; agentVersion: string | null; biostarVersion: string | null; agentTokenCreatedAt: string | null;
    inventory: null | { accessGroups?: Named[]; userGroups?: Named[] };
    webhookUrl?: string | null; webhookLastAt?: string | null; webhookLastStatus?: string | null;
  };
  jobs: Partial<Record<'PENDING' | 'CLAIMED' | 'DONE' | 'FAILED', number>>;
  failedJobs: { id: string; kind: string; attempts: number; lastError: string | null; createdAt: string }[];
  recentEvents: { id: string; occurredAt: string; eventName: string | null; kind: string; outcome: string }[];
  selfTest: null | { id: string; status: string; lastError: string | null; result: null | { steps?: { step: string; ok: boolean; detail: string | null }[] } };
}
interface Setup {
  steps: { key: string; done: boolean; title: string }[];
  next: string | null;
  connector: { online: boolean; lastSeenAt: string | null; version: string | null; minVersion: string; biostarVersion: string | null; biostarSupportsQr: boolean };
  found: { lanes: number; readers: number; qrReaders: number; fingerReaders: number; inReaders: number; outReaders: number; offlineReaders: number; accessGroups: number };
  suggestions: { visitorAccessGroupId: string | null; delegateAccessGroupId: string | null; staffAccessGroupId: string | null };
  server?: { version: string | null; platform: string | null; checkedAt: string | null; timeShiftMinutes: number; timeCheck: string | null; qrReadersOff: string[]; warnings: { level: 'error' | 'warn' | 'info'; code: string; text: string }[] };
}
interface Lanes { doors: { id: string; name: string; readers: { id: string; name: string; direction: string; readsQr: boolean; readsFinger: boolean; online: boolean }[] }[] }
interface LaneTest { state: 'SENDING' | 'LIVE' | 'ENDED'; reachedBioStarMs: number | null; error: string | null; validUntil: string | null; scans: { at: string; result: string; reason: string | null; direction: string | null; reader: string | null; lane: string | null; reachedTcheckMs: number }[] }

const field = 'w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-white';
const OUTCOME: Record<string, ['green' | 'blue' | 'red' | 'purple' | 'gray', string]> = {
  CHECKED_IN: ['green', 'Visitor in'], CHECKED_OUT: ['blue', 'Visitor out'], PERSON_IN: ['purple', 'In'], PERSON_OUT: ['purple', 'Out'],
  LANE_TEST: ['blue', 'Lane test'], NO_MATCH: ['gray', 'Not a Tcheck pass'], IGNORED: ['gray', 'Recorded'],
};
const GROUP_FIELDS = [['visitorAccessGroupId', 'Visitors', true], ['delegateAccessGroupId', 'Delegates and students', false], ['staffAccessGroupId', 'Staff', false]] as const;

function CopyBox({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { setDone(false); } };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 pr-24 font-mono text-xs leading-relaxed text-slate-100" aria-label={label}>{text}</pre>
      <Button size="sm" variant="secondary" className="absolute right-2 top-2" onClick={() => void copy()}>{done ? <><Check size={14} className="mr-1" />Copied</> : <><Copy size={14} className="mr-1" />Copy</>}</Button>
    </div>
  );
}

function StepCard({ n, title, done, open, onToggle, children, summary }: { n: number; title: string; done: boolean; open: boolean; onToggle: () => void; children: React.ReactNode; summary?: React.ReactNode }) {
  return (
    <li className={`rounded-2xl border transition-colors ${open ? 'border-blue-200 bg-white shadow-sm dark:border-blue-400/30 dark:bg-white/[0.04]' : 'border-slate-200 bg-white/60 dark:border-white/10 dark:bg-white/[0.02]'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-emerald-500 text-white' : open ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
          {done ? <Check size={16} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-950 dark:text-white">{title}</span>
          {summary && !open && <span className="block truncate text-xs text-slate-500">{summary}</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-3 border-t border-slate-100 px-4 py-4 text-sm text-slate-600 dark:border-white/5 dark:text-slate-400">{children}</div>}
    </li>
  );
}

export function BarrierPage({ embedded = false }: { embedded?: boolean } = {}) {
  const Heading = embedded ? 'h2' : 'h1';
  const { data, refetch } = useApi<Status>('/visitors/biostar', { refetchIntervalMs: 10_000, refetchWhenVisible: true });
  const { data: setup, refetch: refetchSetup } = useApi<Setup>('/visitors/biostar/setup', { refetchIntervalMs: 5000, refetchWhenVisible: true });
  const { data: lanes } = useApi<Lanes>(setup?.found.lanes ? '/visitors/biostar/doors' : null);
  useGateLive(() => { void refetch({ silent: true }); void refetchSetup({ silent: true }); });
  const [open, setOpen] = useState<string | null>(null);
  const current = open ?? setup?.next ?? 'on';
  const toggle = (k: string) => setOpen(current === k ? '__none' : k);
  const [token, setToken] = useState<string | null>(null);
  const [os, setOs] = useState<'windows' | 'linux'>('windows');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const integ = data?.integration ?? null;
  const groups = integ?.inventory?.accessGroups ?? [];
  const [edited, setEdited] = useState<Partial<Record<(typeof GROUP_FIELDS)[number][0], string>>>({});
  // Saved choice, else the group whose name matches, else nothing — until ICT picks something.
  const form = Object.fromEntries(GROUP_FIELDS.map(([k]) => [k, edited[k] ?? integ?.[k] ?? setup?.suggestions[k] ?? ''])) as Record<(typeof GROUP_FIELDS)[number][0], string>;

  const run = async (k: string, fn: () => Promise<unknown>) => {
    setBusy(k); setError(null);
    try { await fn(); await Promise.all([refetch({ silent: true }), refetchSetup({ silent: true })]); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(null); }
  };
  const apiUrl = `${window.location.origin}/api`;
  const key = token ?? '<your connector key>';
  const downloads = `${window.location.origin}/downloads`;
  const commands = useMemo(() => ({
    // The installer asks for the key and the BioStar password itself (never on the command line).
    windows: `# PowerShell "Run as administrator", on the BioStar server, in the folder with the installer:\npowershell -ExecutionPolicy Bypass -File .\\Install-TcheckConnector.ps1 -TcheckUrl "${apiUrl}" -DownloadBase "${downloads}"`,
    linux: `# 1. BioStar's certificate (run on the BioStar server, or check the fingerprint with ICT):\nBIOSTAR_URL=https://<BioStar server address> node tcheck-biostar-connector.mjs --print-cert\n# 2. Settings file, readable by the connector's user only (chmod 600):\ncat > /etc/tcheck-connector.conf <<'CONF'\nTCHECK_URL=${apiUrl}\nTCHECK_TOKEN=${key}\nBIOSTAR_URL=https://<BioStar server address>\nBIOSTAR_LOGIN_ID=<operator>\nBIOSTAR_PASSWORD=<password>\nBIOSTAR_CERT_SHA256=<fingerprint from step 1>\nCONF\n# 3. Test every link, then run:\nnode tcheck-biostar-connector.mjs --config /etc/tcheck-connector.conf --check\nnode tcheck-biostar-connector.mjs --config /etc/tcheck-connector.conf`,
  }), [apiUrl, key, downloads]);
  const service = '# /etc/systemd/system/tcheck-connector.service → [Service] User=tcheck ExecStart=/usr/bin/node /opt/tcheck/tcheck-biostar-connector.mjs --config /etc/tcheck-connector.conf Restart=always\nsudo systemctl enable --now tcheck-connector';
  const done = (k: string) => !!setup?.steps.find((s) => s.key === k)?.done;
  const selfSteps = data?.selfTest?.result?.steps ?? [];
  const groupName = (id: string | null | undefined) => groups.find((g) => g.id === id)?.name ?? null;
  const progress = setup ? setup.steps.filter((s) => s.done).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-300">Flap barriers · Suprema BioStar 2</p>
          <Heading className={embedded ? 'text-lg font-semibold text-slate-950 dark:text-white' : 'text-2xl font-bold text-slate-950 dark:text-white'}>Connect your flap barriers</Heading>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Seven short steps. Visitors scan a QR on their phone, delegates scan their daily campus pass, and the flap opens in under a second. Day to day, use <Link to="/visitors/gate" className="text-blue-600 hover:underline dark:text-blue-400">Flap barriers</Link>.</p>
        </div>
        {setup && (
          <div className="min-w-[220px] rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10" role="status">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-950 dark:text-white">{progress === 7 ? 'All set' : `${progress} of 7 done`}</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${setup.connector.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />{setup.connector.online ? 'Connector online' : 'Connector offline'}</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${(progress / 7) * 100}%` }} /></div>
          </div>
        )}
      </div>

      {data?.connectorUpdateRequired && <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><ShieldAlert size={16} className="mt-0.5 shrink-0" />Your connector is {integ?.agentVersion}. Download the new one in step 2 and restart it.</p>}
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-red-500/10 dark:text-red-300"><XCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <ol className="space-y-3">
          <StepCard n={1} title="Create a connector key" done={done('token')} open={current === 'token'} onToggle={() => toggle('token')} summary={integ?.agentTokenCreatedAt ? `Created ${stamp(integ.agentTokenCreatedAt)}` : undefined}>
            <p>The connector is a small program that runs on a computer next to your BioStar server. It only ever calls out to Tcheck, so you open no firewall port. The key tells Tcheck it's your school.</p>
            {token && (
              <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Copy this key now. It won't be shown again. You'll paste it into the installer in step 2.</p>
                <CopyBox text={token} label="Connector key" />
              </div>
            )}
            <Button size="sm" variant={done('token') ? 'secondary' : 'primary'} disabled={busy === 'token'} onClick={() => void run('token', async () => { const r = await api.post<{ token: string }>('/visitors/biostar/token'); setToken(r.token); setOpen('connector'); })}>
              <KeyRound size={14} className="mr-1.5" />{done('token') ? 'Create a new key (disconnects the old connector)' : 'Create the key'}
            </Button>
          </StepCard>

          <StepCard n={2} title="Run the connector next to BioStar" done={done('connector')} open={current === 'connector'} onToggle={() => toggle('connector')}
            summary={setup?.connector.online ? `Online · connector ${setup.connector.version} · BioStar ${setup.connector.biostarVersion ?? '?'}` : undefined}>
            <div className="flex gap-1" role="tablist" aria-label="Computer">
              {(['windows', 'linux'] as const).map((o) => <button key={o} type="button" role="tab" aria-selected={os === o} onClick={() => setOs(o)} className={`rounded-lg px-3 py-1 text-xs font-medium ${os === o ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{o === 'windows' ? 'Windows' : 'Linux / Mac'}</button>)}
            </div>
            {os === 'windows' ? (
              <ol className="list-decimal space-y-2 pl-5">
                <li>On the <b>BioStar server</b>, <a href="/downloads/Install-TcheckConnector.ps1" download className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"><Download size={14} />download the installer</a> (<a href="/downloads/Install-TcheckConnector.ps1.sha256" className="text-blue-600 hover:underline dark:text-blue-400">SHA-256</a>). It is a readable PowerShell script.</li>
                <li>Open PowerShell with <b>Run as administrator</b> in that folder and run the command below.</li>
                <li>Paste the connector key when asked, then a BioStar operator login and password. It shows BioStar's certificate to trust, tests every link, and installs the connector as a background service.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5">
                <li>Install <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">Node.js 22 or newer</a> on a computer that can reach BioStar and the internet.</li>
                <li><a href="/downloads/tcheck-biostar-connector.mjs" download className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"><Download size={14} />Download the connector</a> (<a href="/downloads/tcheck-biostar-connector.mjs.sha256" className="text-blue-600 hover:underline dark:text-blue-400">SHA-256</a>), then:</li>
              </ol>
            )}
            <CopyBox text={commands[os]} label={os === 'windows' ? 'Command to run the installer' : 'Commands to set up the connector'} />
            {os === 'linux' && <details className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5"><summary className="cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">Keep it running after a restart</summary><div className="mt-2"><CopyBox text={service} label="Run as a service" /></div></details>}
            <p className="flex items-start gap-1.5 text-xs text-slate-500"><ShieldAlert size={14} className="mt-0.5 shrink-0" />Security: the connector only calls out (HTTPS); no firewall port opens. It trusts BioStar's exact certificate only, checks Tcheck's normally, and runs as a low-privilege account. Revoke it any time with a new key in step 1.</p>
            <p className="flex items-center gap-2 text-xs" role="status">
              {setup?.connector.online
                ? <><CheckCircle2 size={14} className="text-emerald-600" />Connected: connector {setup.connector.version}, BioStar {setup.connector.biostarVersion ?? 'version not reported'}{setup.connector.biostarSupportsQr ? '' : ' — QR codes need BioStar 2.8.11 or newer'}</>
                : <><Loader2 size={14} className="animate-spin" />Waiting for the connector to call in…</>}
            </p>
            {setup?.server?.checkedAt && <ServerPanel server={setup.server} />}
          </StepCard>

          <StepCard n={3} title="Check your flap barrier lanes" done={done('lanes')} open={current === 'lanes'} onToggle={() => toggle('lanes')}
            summary={setup ? `${setup.found.lanes} lane(s) · ${setup.found.qrReaders} QR reader(s)${setup.server?.qrReadersOff.length ? ` · ${setup.server.qrReadersOff.length} with QR reading off` : ''}${integ?.biometricsEnabled ? ` · ${setup.found.fingerReaders} fingerprint reader(s)` : ''}` : undefined}>
            <p>Each flap barrier lane is a door in BioStar with an entry and an exit reader. Tcheck reads them from BioStar and marks the entry reader In and the exit reader Out.</p>
            {setup && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([['Lanes', setup.found.lanes, false], ['QR readers', setup.found.qrReaders, false], ['QR reading off', setup.server?.qrReadersOff.length ?? 0, true], ['Offline', setup.found.offlineReaders, true]] as const).map(([k, v, bad]) => (
                  <div key={k} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5"><p className="text-xs text-slate-500">{k}</p><p className={`text-lg font-semibold tabular-nums ${bad && v ? 'text-rose-600' : 'text-slate-950 dark:text-white'}`}>{v}</p></div>
                ))}
              </div>
            )}
            {!!lanes?.doors.length && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                {lanes.doors.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                    <span className="flex flex-wrap gap-1.5">{d.readers.map((r) => <Badge key={r.id} color={!r.online ? 'red' : r.direction === 'IN' ? 'green' : r.direction === 'OUT' ? 'blue' : 'gray'}>{r.name} · {r.direction === 'NONE' ? 'not set' : r.direction}</Badge>)}</span>
                  </li>
                ))}
              </ul>
            )}
            {!!setup?.server?.qrReadersOff.length && <p className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300"><ShieldAlert size={14} className="mt-0.5 shrink-0" />QR reading is off on {setup.server.qrReadersOff.join(', ')}. In BioStar: Device → the reader → Barcode/QR → Use, then save. Visitors' QR codes won't be read until then.</p>}
            {setup && !setup.found.lanes && <p className="text-xs text-amber-700 dark:text-amber-400">No lanes yet. In BioStar, set each flap barrier lane up as a door with its entry and exit reader; it appears here within a minute.</p>}
            <Link to="/visitors/gate/doors" className="inline-flex text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">Change readers and directions on the Lanes page →</Link>
          </StepCard>

          <StepCard n={4} title="Choose who goes through" done={done('groups')} open={current === 'groups'} onToggle={() => toggle('groups')}
            summary={integ?.visitorAccessGroupId ? `Visitors: ${groupName(integ.visitorAccessGroupId)}` : undefined}>
            <p>Pick the BioStar access group for each kind of person. The group decides which lanes they can use and when; your BioStar setup stays as it is. Groups whose names match are pre-selected.</p>
            {!groups.length ? <p className="text-xs">Access groups appear here once the connector is running.</p> : (
              <div className="grid gap-3 sm:grid-cols-3">
                {GROUP_FIELDS.map(([k, label, req]) => (
                  <label key={k} className="block"><span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">{label}{req ? '' : ' (optional)'}</span>
                    <select id={`grp-${k}`} className={field} value={form[k]} onChange={(e) => setEdited({ ...edited, [k]: e.target.value })}>
                      <option value="">{req ? 'Choose…' : 'Not used'}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    {!integ?.[k] && !edited[k] && setup?.suggestions[k] && <span className="mt-1 block text-[11px] text-blue-600 dark:text-blue-400">Suggested from its name</span>}
                  </label>
                ))}
              </div>
            )}
            <Button size="sm" disabled={busy === 'groups' || !form.visitorAccessGroupId} onClick={() => void run('groups', () => api.put('/visitors/biostar/settings', { visitorAccessGroupId: form.visitorAccessGroupId || null, delegateAccessGroupId: form.delegateAccessGroupId || null, staffAccessGroupId: form.staffAccessGroupId || null }))}>
              {busy === 'groups' ? 'Saving…' : 'Save'}
            </Button>
          </StepCard>

          <StepCard n={5} title="Run the self-test" done={done('selftest')} open={current === 'selftest'} onToggle={() => toggle('selftest')} summary={data?.selfTest?.status === 'DONE' ? 'Passed' : data?.selfTest?.status === 'FAILED' ? 'Failed — open to see why' : undefined}>
            <p>Creates a throwaway user with a QR on your real BioStar, reads it back and removes it, and reads your lanes and their status. It proves the account's rights and your BioStar version.</p>
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
            <Button size="sm" variant="secondary" disabled={!data?.online || busy === 'test' || data?.selfTest?.status === 'PENDING' || data?.selfTest?.status === 'CLAIMED'} onClick={() => void run('test', () => api.post('/visitors/biostar/self-test'))}>
              <Play size={14} className="mr-1.5" />{data?.selfTest ? 'Run again' : 'Run the self-test'}
            </Button>
          </StepCard>

          <StepCard n={6} title="Scan a test QR at a flap barrier" done={done('lanetest')} open={current === 'lanetest'} onToggle={() => toggle('lanetest')} summary={done('lanetest') ? 'A test QR opened a flap barrier' : undefined}>
            <LaneTestPanel canStart={!!integ?.visitorAccessGroupId && !!data?.online} onDone={() => void refetchSetup({ silent: true })} />
          </StepCard>

          <StepCard n={7} title="Switch on" done={done('on')} open={current === 'on'} onToggle={() => toggle('on')} summary={integ?.enabled ? 'On' : undefined}>
            <p>From now on a visitor's QR is made on the day for their phone and removed when they scan out, delegates' campus codes change every day, and everyone's access ends by the end of their day even if the internet goes down.</p>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" role="switch" className="h-5 w-5 accent-emerald-600" checked={!!integ?.enabled} disabled={!integ?.visitorAccessGroupId || busy === 'on'} onChange={(e) => void run('on', () => api.put('/visitors/biostar/settings', { enabled: e.target.checked }))} />
              <span className="font-medium text-slate-900 dark:text-slate-100">{integ?.enabled ? `On: QR codes${integ.biometricsEnabled ? ' and fingerprints' : ''} open the flap barriers` : 'Off'}</span>
            </label>
            {!done('lanetest') && <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><ShieldAlert size={14} />Scan a test QR at a flap barrier first (step 6).</p>}
          </StepCard>
        </ol>

        <div className="space-y-6">
          {integ && <GateSettings integ={integ} busy={busy === 'gate'} onSave={(patch) => void run('gate', () => api.put('/visitors/biostar/settings', patch))} />}
          {integ && <WebhookCard integ={integ} onChanged={() => void refetch({ silent: true })} />}
          <section className="glass-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white"><Activity size={16} className="text-blue-500" />Flap barrier activity</h2>
            {!data?.recentEvents.length ? <p className="mt-3 text-sm text-slate-500">Scans appear here as they happen.</p> : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                {data.recentEvents.slice(0, 8).map((e) => {
                  const [color, label] = e.kind === 'DENIED' ? (['red', 'Refused'] as const) : (OUTCOME[e.outcome] ?? ['gray', e.outcome]);
                  return <li key={e.id} className="flex items-center justify-between gap-3 py-2"><span className="text-xs text-slate-500">{stamp(e.occurredAt)}</span><Badge color={color}>{label}</Badge></li>;
                })}
              </ul>
            )}
            <Link to="/visitors/gate/live" className="mt-3 inline-flex text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">Open the live feed →</Link>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Step 6: a short-lived test QR on this screen. Scan it at any flap barrier; the result appears here. */
function LaneTestPanel({ canStart, onDone }: { canStart: boolean; onDone: () => void }) {
  const [test, setTest] = useState<{ testId: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, refetch } = useApi<LaneTest>(test ? `/visitors/biostar/lane-test/${test.testId}` : null);
  useEffect(() => {
    if (!test) return;
    const t = setInterval(() => void refetch({ silent: true }), 700);
    return () => clearInterval(t);
  }, [test, refetch]);
  const granted = data?.scans.find((s) => s.result === 'GRANTED');
  useEffect(() => { if (granted) onDone(); }, [granted, onDone]);
  const start = async () => { setError(null); try { setTest(await api.post<{ testId: string; value: string }>('/visitors/biostar/lane-test')); } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the test'); } };
  const end = async () => { if (test) await api.post(`/visitors/biostar/lane-test/${test.testId}/end`).catch(() => null); setTest(null); };
  return (
    <div className="space-y-3">
      <p>A test QR appears here. Take this screen (or a phone showing it) to a flap barrier and scan it at the entry reader. The flap should open, and this panel shows the passage with how long each step took. The test QR stops working after 15 minutes.</p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!test ? (
        <Button size="sm" disabled={!canStart} onClick={() => void start()}><ScanLine size={14} className="mr-1.5" />Show a test QR</Button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className={`self-start rounded-2xl bg-white p-3 ring-1 ring-slate-200 ${data?.state === 'LIVE' ? '' : 'opacity-40'}`}>
            <QRCodeSVG value={test.value} size={180} level="M" marginSize={1} title="Lane test QR code" />
          </div>
          <ol className="space-y-2 text-sm" aria-live="polite">
            <li className="flex items-center gap-2">{data?.state === 'LIVE' || data?.state === 'ENDED' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Loader2 size={16} className="animate-spin" />}
              {data?.state === 'LIVE' || data?.state === 'ENDED' ? <>On BioStar in {ms(data.reachedBioStarMs)}</> : 'Sending to BioStar…'}</li>
            {data?.error && <li className="text-rose-600">{data.error}</li>}
            <li className="flex items-center gap-2">{granted ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Radio size={16} className="text-slate-400" />}
              {granted ? <span>Flap opened at <b>{granted.lane ?? granted.reader}</b> ({granted.direction === 'OUT' ? 'out' : 'in'}); Tcheck heard in {ms(granted.reachedTcheckMs)}</span> : data?.state === 'LIVE' ? 'Scan it at a flap barrier now' : 'Waiting'}</li>
            {data?.scans.filter((s) => s.result !== 'GRANTED').map((s, i) => <li key={i} className="text-xs text-rose-600">Refused at {s.lane ?? s.reader}: {s.reason?.replace(/_/g, ' ').toLowerCase() ?? 'no reason given'}</li>)}
            {!granted && data?.scans.some((s) => s.result !== 'GRANTED' && /INVALID|EXPIRED|TIME|PERIOD/i.test(s.reason ?? '')) && <li className="text-xs text-slate-600 dark:text-slate-300">Tcheck has just adjusted for how your BioStar reads times. Scan the same QR again.</li>}
            <li className="pt-1"><Button size="sm" variant="secondary" onClick={() => void end()}>{granted ? 'Done' : 'Stop the test'}</Button></li>
          </ol>
        </div>
      )}
    </div>
  );
}

/** Barrier events to another system (the school's own guest or security system), signed. */
function WebhookCard({ integ, onChanged }: { integ: NonNullable<Status['integration']>; onChanged: () => void }) {
  const [url, setUrl] = useState(integ.webhookUrl ?? '');
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (value: string | null) => {
    setBusy(true); setMsg(null);
    try { const r = await api.put<{ secret: string | null }>('/visitors/biostar/webhook', { url: value }); setSecret(r.secret); onChanged(); setMsg(value ? 'Saved. Copy the signing secret below.' : 'Removed.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api.post<{ status: string; ok: boolean }>('/visitors/biostar/webhook/test'); setMsg(r.ok ? `Delivered (HTTP ${r.status}).` : `Not delivered: ${r.status}.`); onChanged(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not send'); } finally { setBusy(false); }
  };
  return (
    <section className="glass-card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white"><Webhook size={16} className="text-blue-500" />Connect another system</h2>
      <p className="text-xs text-slate-500">Send every passage, refusal, check-in and check-out to your own guest or security system as it happens (HTTPS POST, JSON, signed with HMAC-SHA256).</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void save(url.trim() || null); }}>
        <input id="webhook-url" aria-label="Webhook address" className={field} placeholder="https://your-system.example/tcheck-events" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button size="sm" disabled={busy}>Save</Button>
      </form>
      {secret && <div><p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-400">Signing secret (shown once):</p><CopyBox text={secret} label="Webhook signing secret" /></div>}
      {integ.webhookUrl && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void test()}><Plug size={14} className="mr-1" />Send a test event</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setUrl(''); void save(null); }}>Remove</Button>
          {integ.webhookLastAt && <span>Last delivery {stamp(integ.webhookLastAt)}: {integ.webhookLastStatus}</span>}
        </div>
      )}
      {msg && <p className="text-xs text-slate-600 dark:text-slate-300" role="status">{msg}</p>}
      <details className="text-xs"><summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">What your system receives</summary>
        <div className="mt-2"><CopyBox label="Example event" text={`POST <your address>\nX-Tcheck-Event: barrier.passage\nX-Tcheck-Timestamp: 1763712000\nX-Tcheck-Signature: sha256=<HMAC-SHA256 of "<timestamp>.<body>" with your secret>\n\n{"event":"barrier.passage","schoolId":"…","sentAt":"2026-11-21T08:00:01Z",\n "data":{"at":"2026-11-21T08:00:00Z","lane":"Lane 1","reader":"Lane 1 In","direction":"IN",\n  "credential":"QR","person":"Grace Wanjiru","personType":"VISITOR","reason":null,"outcome":"CHECKED_IN"}}\n\nEvents: barrier.passage, barrier.refused, visitor.checked_in, visitor.checked_out, test`} /></div>
      </details>
    </section>
  );
}

/** Fingerprints, tablet lanes and the campus-code grace period. */
function GateSettings({ integ, busy, onSave }: { integ: NonNullable<Status['integration']>; busy: boolean; onSave: (patch: Record<string, unknown>) => void }) {
  const [retention, setRetention] = useState(String(integ.biometricRetentionDays ?? 7));
  const [grace, setGrace] = useState(String(Math.round((integ.graceSeconds ?? 300) / 60)));
  return (
    <section className="glass-card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Flap barrier settings</h2>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" role="switch" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={integ.openDoorOnCodeCheckIn !== false} disabled={busy} onChange={(e) => onSave({ openDoorOnCodeCheckIn: e.target.checked })} />
        <span><span className="font-medium text-slate-900 dark:text-slate-100">A code check-in at a tablet opens its flap barrier</span><span className="block text-xs text-slate-500">Link each tablet to its lane on the Lanes page.</span></span>
      </label>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onSave({ graceSeconds: Math.max(1, Number(grace)) * 60 }); }}>
        <label className="text-xs text-slate-600 dark:text-slate-400">Minutes yesterday's campus code still works after midnight
          <input id="grace-min" type="number" min={1} max={60} className="mt-1 w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-white/5" value={grace} onChange={(e) => setGrace(e.target.value)} /></label>
        <Button size="sm" variant="secondary" disabled={busy}>Save</Button>
      </form>
      {/* Optional: not needed for visitors. Folded away unless already on. */}
      <details className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5" open={!!integ.biometricsEnabled}>
        <summary className="cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">Fingerprints for delegates and staff (optional{integ.biometricsEnabled ? ', on' : ', off'})</summary>
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" role="switch" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={!!integ.biometricsEnabled} disabled={busy} onChange={(e) => onSave({ biometricsEnabled: e.target.checked })} />
            <span><span className="font-medium text-slate-900 dark:text-slate-100">Fingerprints at the flap barriers</span><span className="block text-xs text-slate-500">Not used for visitors. People who agree can enrol a finger at a reader; it then opens the flap barriers on their programme days. It is stored only in BioStar. Switch on only after your data protection officer has approved it.</span></span>
          </label>
          {integ.biometricsEnabled && (
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onSave({ biometricRetentionDays: Number(retention) }); }}>
              <label className="text-xs text-slate-600 dark:text-slate-400">Delete fingerprints this many days after a person's last programme
                <input id="bio-retention" type="number" min={0} max={365} className="mt-1 w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-white/5" value={retention} onChange={(e) => setRetention(e.target.value)} /></label>
              <Button size="sm" variant="secondary" disabled={busy}>Save</Button>
            </form>
          )}
        </div>
      </details>
    </section>
  );
}

/** "Your BioStar": the connector's server check, in plain words, with what to fix before go-live. */
function ServerPanel({ server }: { server: NonNullable<Setup['server']> }) {
  const tone = { error: 'text-rose-700 dark:text-rose-300', warn: 'text-amber-700 dark:text-amber-300', info: 'text-slate-600 dark:text-slate-300' } as const;
  const time = server.timeCheck === 'LANE_TEST' ? 'proven by a real scan' : server.timeCheck === 'SELF_TEST' ? 'checked with BioStar by the self-test' : server.timeCheck === 'EVENT_CLOCK' ? 'read from BioStar\'s event times' : 'not checked yet';
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/10" aria-label="Your BioStar">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your BioStar</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-slate-500">Server</dt><dd className="text-slate-900 dark:text-slate-100">{server.platform ?? 'BioStar'} {server.version ?? '(version not reported)'}</dd>
        <dt className="text-slate-500">Times</dt><dd className="text-slate-900 dark:text-slate-100">{server.timeShiftMinutes ? `Local time (UTC+${server.timeShiftMinutes / 60}), adjusted` : 'UTC'} · {time}</dd>
      </dl>
      {!!server.warnings.length && (
        <ul className="space-y-1">
          {server.warnings.map((w) => <li key={w.code + w.text} className={`flex items-start gap-1.5 text-xs ${tone[w.level]}`}>{w.level === 'info' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <ShieldAlert size={14} className="mt-0.5 shrink-0" />}{w.text}</li>)}
        </ul>
      )}
    </div>
  );
}
