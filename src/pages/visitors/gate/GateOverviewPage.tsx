import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { Badge } from '../../../components/ui/Badge';
import { GateShell, Panel, Tile } from './gateShared';
import { ago, ms, useGateLive, CREDENTIAL, REASON, JOB_KIND } from './gateLib';

/**
 * Gate access → Overview (2026-11-20). The first thing ICT looks at: is the connector up, is the
 * queue moving, how fast changes reach BioStar, what happened at the gates today, and what needs
 * attention (alerts, doors, offline readers).
 */
export interface Overview {
  connector: { configured: boolean; enabled: boolean; online: boolean; lastSeenAt: string | null; version: string | null; updateRequired: boolean; biostarVersion: string | null; clockDriftMs: number | null; platformDisabledAt: string | null; platformDisabledReason: string | null };
  queue: { pending: number; running: number; oldestWaitingMs: number | null; oldestKind: string | null; failed24h: number };
  today: { entries: number; exits: number; refusals: number; byCredential: { type: string; count: number }[]; refusalsByReason: { reason: string; count: number }[] };
  openAlerts: number; doorsNeedingAttention: number; readersOffline: number; peopleWithAccess: number; liveCodes: number; fingerprints: number;
}
export interface Health {
  sync: { count: number; medianMs: number | null; p95Ms: number | null; worstMs: number | null; pickupMedianMs: number | null };
  doors: { count: number; medianMs: number | null; p95Ms: number | null; worstMs: number | null };
  series: { day: string; medianMs: number | null; p95Ms: number | null; count: number }[];
  failures: { kind: string; count: number }[];
  measured: { addMs?: number[]; removeMs?: number[]; measuredAt?: string } | null;
  clockDriftMs: number | null;
}

const BLUE = '#3B82F6';
const AXIS = { fontSize: 11, fill: '#94a3b8' } as const;

export function GateOverviewPage() {
  const { data: o, refetch, loading } = useApi<Overview>('/visitors/biostar/overview', { refetchIntervalMs: 30_000, refetchWhenVisible: true });
  const { data: h, refetch: refetchHealth } = useApi<Health>('/visitors/biostar/health', { refetchIntervalMs: 120_000 });
  useGateLive(() => { void refetch({ silent: true }); void refetchHealth({ silent: true }); });
  const c = o?.connector;
  const status = !c ? null : c.platformDisabledAt ? ['red', 'Switched off by Tcheck support'] : !c.configured ? ['gray', 'Not set up'] : !c.online ? ['red', 'Connector offline'] : !c.enabled ? ['yellow', 'Connected, link switched off'] : ['green', 'Live'];
  const drift = c?.clockDriftMs != null && Math.abs(c.clockDriftMs) > 60_000;

  return (
    <GateShell title="Overview" intro="Your BioStar 2 gates at a glance. QR codes and fingerprints open the doors through BioStar; this shows whether Tcheck and BioStar are in step and what happened today.">
      {loading && !o && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading…</p>}
      {o && c && (
        <>
          {(c.platformDisabledAt || c.updateRequired || drift || !c.online) && c.configured && (
            <div role="status" className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                {c.platformDisabledAt && <p>Tcheck support switched this link off: {c.platformDisabledReason}. Contact them to switch it back on.</p>}
                {!c.online && !c.platformDisabledAt && <p>The connector last called in {ago(c.lastSeenAt)}. New codes and Out scans are not reaching BioStar. BioStar still ends every code by the end of its day.</p>}
                {c.updateRequired && <p>The connector is version {c.version}. Install 1.2.0 or newer: older versions can't run doors, fingerprints or daily codes.</p>}
                {drift && <p>The connector's clock is {Math.round(Math.abs(c.clockDriftMs!) / 1000)} s {c.clockDriftMs! > 0 ? 'ahead' : 'behind'}. Set the computer's time automatically.</p>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Connector" value={status ? <Badge color={status[0] as 'green'}>{status[1]}</Badge> : '—'} sub={`${c.version ? `v${c.version}` : 'no version'} · BioStar ${c.biostarVersion ?? '?'} · ${ago(c.lastSeenAt)}`} tone={c.online ? 'good' : c.configured ? 'bad' : 'default'} />
            <Tile label="Waiting to reach BioStar" value={o.queue.pending + o.queue.running} sub={o.queue.oldestWaitingMs ? `oldest ${ms(o.queue.oldestWaitingMs)} (${JOB_KIND[o.queue.oldestKind ?? ''] ?? o.queue.oldestKind})` : 'nothing waiting'} tone={(o.queue.oldestWaitingMs ?? 0) > 300_000 ? 'warn' : 'default'} />
            <Tile label="Time to reach BioStar" value={ms(h?.sync.medianMs)} sub={h ? `p95 ${ms(h.sync.p95Ms)} · worst ${ms(h.sync.worstMs)} (7 days)` : '—'} />
            <Tile label="Failed in 24 hours" value={o.queue.failed24h} sub={<Link to="/visitors/gate/jobs?status=FAILED" className="text-blue-600 hover:underline dark:text-blue-400">See sync jobs</Link>} tone={o.queue.failed24h ? 'bad' : 'default'} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Tile label="Entries today" value={o.today.entries} />
            <Tile label="Exits today" value={o.today.exits} />
            <Tile label="Refused today" value={o.today.refusals} tone={o.today.refusals ? 'warn' : 'default'} />
            <Tile label="Open alerts" value={<Link to="/visitors/gate/alerts" className="hover:underline">{o.openAlerts}</Link>} tone={o.openAlerts ? 'bad' : 'default'} />
            <Tile label="Doors needing attention" value={<Link to="/visitors/gate/doors" className="hover:underline">{o.doorsNeedingAttention}</Link>} sub={`${o.readersOffline} reader(s) offline`} tone={o.doorsNeedingAttention || o.readersOffline ? 'bad' : 'default'} />
            <Tile label="People with access now" value={o.peopleWithAccess} sub={`${o.liveCodes} live code(s) · ${o.fingerprints} fingerprint(s)`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="How people got in today" hint="Granted scans by credential">
              {o.today.byCredential.length ? (
                <ul className="space-y-2 text-sm">
                  {o.today.byCredential.map((b) => {
                    const max = Math.max(...o.today.byCredential.map((x) => x.count));
                    return (
                      <li key={b.type}>
                        <div className="flex justify-between"><span>{CREDENTIAL[b.type] ?? b.type}</span><span className="tabular-nums font-medium">{b.count}</span></div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(b.count / max) * 100}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm text-slate-500">No one through the gates yet today.</p>}
            </Panel>
            <Panel title="Why scans were refused today">
              {o.today.refusalsByReason.length ? (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                  {o.today.refusalsByReason.map((r) => <li key={r.reason} className="flex justify-between py-1.5"><span>{REASON[r.reason] ?? r.reason.replace(/_/g, ' ').toLowerCase()}</span><span className="tabular-nums font-medium">{r.count}</span></li>)}
                </ul>
              ) : <p className="text-sm text-slate-500">No refusals today.</p>}
            </Panel>
            <Panel title="Time to reach BioStar, by day" hint="Median of every change, last 7 days">
              {h?.series.length ? (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={h.series} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                      <XAxis dataKey="day" tick={AXIS} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={AXIS} tickFormatter={(v: number) => (v < 1000 ? `${v}` : `${(v / 1000).toFixed(0)}s`)} />
                      <Tooltip formatter={(v) => ms(typeof v === 'number' ? v : null)} />
                      <Area dataKey="medianMs" name="Median" stroke={BLUE} fill={BLUE} fillOpacity={0.15} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-slate-500">No changes sent to BioStar yet.</p>}
              {h?.failures.length ? <p className="mt-2 text-xs text-slate-500">Failures: {h.failures.map((f) => `${JOB_KIND[f.kind] ?? f.kind} ${f.count}`).join(' · ')}</p> : null}
            </Panel>
          </div>
        </>
      )}
    </GateShell>
  );
}
