import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Pause, Play } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TablePager } from '../../../components/ui/TablePager';
import { GateShell, Panel, DataTable } from './gateShared';
import { useGateLive, time, ms, CREDENTIAL, PERSON_KIND, REASON, inputCls, selectCls } from './gateLib';
import { stamp } from '../visitorsApi';

/**
 * Gate access → Live feed (2026-11-20): every scan at every door, newest first, live. Who, how
 * (QR, fingerprint, card), which door and reader, In or Out, granted or refused and why, and how
 * long BioStar took to tell Tcheck. Filters and CSV export.
 */
export interface GateEvent {
  id: string; at: string; receivedAt: string; delayMs: number; result: 'GRANTED' | 'DENIED' | 'OTHER'; reason: string | null; outcome: string; direction: string | null;
  credentialType: string | null; door: string | null; doorId: string | null; reader: string | null; readerId: string | null;
  person: string | null; personKind: string | null; identityId: string | null; visitId: string | null; eventName: string | null;
}
interface Page { total: number; page: number; pageSize: number; events: GateEvent[] }
interface Doors { doors: { id: string; name: string }[] }

const OUTCOME: Record<string, string> = { CHECKED_IN: 'Checked in', CHECKED_OUT: 'Checked out', PERSON_IN: 'In', PERSON_OUT: 'Out', NO_MATCH: 'Not a Tcheck pass', IGNORED: 'Recorded' };

export function GateLivePage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [f, setF] = useState({ kind: '', credentialType: '', doorId: '', search: '' });
  const [paused, setPaused] = useState(false);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page + 1), pageSize: String(size) });
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    return p.toString();
  }, [page, size, f]);
  const { data, refetch } = useApi<Page>(`/visitors/biostar/events?${qs}`);
  const { data: doors } = useApi<Doors>('/visitors/biostar/doors');
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const ids = data.events.map((e) => e.id);
    const isNew = ids.filter((id) => seen.current.size && !seen.current.has(id));
    ids.forEach((id) => seen.current.add(id));
    if (isNew.length) { setFresh(new Set(isNew)); const t = setTimeout(() => setFresh(new Set()), 4000); return () => clearTimeout(t); }
  }, [data]);
  const live = useCallback(() => { if (page === 0) void refetch({ silent: true }); }, [refetch, page]);
  useGateLive(live, ['event'], paused);
  const set = (k: keyof typeof f, v: string) => { setPage(0); setF((x) => ({ ...x, [k]: v })); };
  const exportCsv = async () => {
    const p = new URLSearchParams(qs); p.delete('page'); p.delete('pageSize');
    const csv = await api.getText(`/visitors/biostar/events/export?${p.toString()}`);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'flap-barrier-scans.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <GateShell
      title="Live feed"
      intro="Every scan at your flap barriers as it happens. Refused scans show BioStar's reason."
      actions={<>
        <Button variant="secondary" size="sm" onClick={() => setPaused((p) => !p)}>{paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</Button>
        <Button variant="secondary" size="sm" onClick={() => void exportCsv()}><Download size={14} /> Export CSV</Button>
      </>}
    >
      <Panel title={data ? `${data.total.toLocaleString()} scan(s)` : 'Scans'} hint={paused ? 'Paused — new scans are not shown until you resume' : 'Updates by itself'}>
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <label className="text-xs text-slate-500">Result<select id="live-kind" className={`${selectCls} mt-1 w-full`} value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="">All</option><option value="GRANTED">Granted</option><option value="DENIED">Refused</option></select></label>
          <label className="text-xs text-slate-500">How<select id="live-cred" className={`${selectCls} mt-1 w-full`} value={f.credentialType} onChange={(e) => set('credentialType', e.target.value)}><option value="">All</option>{['QR', 'FINGER', 'FACE', 'CARD'].map((c) => <option key={c} value={c}>{CREDENTIAL[c]}</option>)}</select></label>
          <label className="text-xs text-slate-500">Lane<select id="live-door" className={`${selectCls} mt-1 w-full`} value={f.doorId} onChange={(e) => set('doorId', e.target.value)}><option value="">All lanes</option>{doors?.doors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="text-xs text-slate-500">Person<input id="live-search" className={`${inputCls} mt-1`} placeholder="Name" value={f.search} onChange={(e) => set('search', e.target.value)} /></label>
        </div>
        <DataTable head={['Time', 'Person', 'How', 'Lane · reader', 'Direction', 'Result', 'Reached Tcheck']} empty={data && !data.events.length ? 'No scans match.' : false}>
          {data?.events.map((e) => (
            <tr key={e.id} className={fresh.has(e.id) ? 'bg-blue-50/60 transition-colors dark:bg-blue-500/10' : ''}>
              <td className="whitespace-nowrap px-5 py-2.5 tabular-nums" title={stamp(e.at)}>{time(e.at)}</td>
              <td className="px-5 py-2.5">
                {e.identityId ? <Link to={`/visitors/gate/people/${e.identityId}`} className="font-medium text-slate-950 hover:underline dark:text-white">{e.person}</Link> : <span className="text-slate-500">Unknown</span>}
                {e.personKind && <span className="block text-xs text-slate-500">{PERSON_KIND[e.personKind]}</span>}
              </td>
              <td className="px-5 py-2.5">{CREDENTIAL[e.credentialType ?? 'UNKNOWN']}</td>
              <td className="px-5 py-2.5">{e.door ?? '—'}<span className="block text-xs text-slate-500">{e.reader}</span></td>
              <td className="px-5 py-2.5">{e.direction === 'IN' ? 'In' : e.direction === 'OUT' ? 'Out' : '—'}</td>
              <td className="px-5 py-2.5">
                {e.result === 'GRANTED' ? <Badge color="green">{OUTCOME[e.outcome] ?? 'Granted'}</Badge> : <Badge color="red">Refused</Badge>}
                {e.reason && <span className="block text-xs text-slate-500">{REASON[e.reason] ?? e.reason.replace(/_/g, ' ').toLowerCase()}</span>}
              </td>
              <td className={`px-5 py-2.5 tabular-nums text-xs ${e.delayMs > 60_000 ? 'text-amber-600' : 'text-slate-500'}`}>{ms(e.delayMs)}</td>
            </tr>
          ))}
        </DataTable>
        {data && <TablePager page={page} pageSize={size} total={data.total} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(0); }} noun="scans" />}
      </Panel>
    </GateShell>
  );
}
