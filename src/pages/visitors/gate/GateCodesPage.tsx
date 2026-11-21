import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { TablePager } from '../../../components/ui/TablePager';
import { GateShell, Panel, DataTable, ErrorLine } from './gateShared';
import { useGateLive, useAction, ms, time, PERSON_KIND, CRED_STATE, END_REASON, inputCls, selectCls } from './gateLib';
import { stamp } from '../visitorsApi';

/**
 * Gate access → Codes (2026-11-20): every code BioStar reads that Tcheck issued — visitor day codes,
 * daily campus codes, walk-in tags — with its holder, window, when it reached BioStar, when and why it
 * ended. Shown by its last 4 characters only. ICT can revoke a live code (reason required).
 */
interface Cred { id: string; last4: string; kind: string; state: string; holder: string; holderKind: string; identityId: string; forDay: string | null; validFrom: string; validUntil: string; graceUntil: string | null; issuedAt: string; liveAt: string | null; endedAt: string | null; removedAt: string | null; endReason: string | null; reachedBioStarMs: number | null }
interface Page { total: number; page: number; pageSize: number; counts: Record<string, number>; credentials: Cred[] }

export function GateCodesPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [f, setF] = useState({ state: '', kind: '', search: '' });
  const qs = useMemo(() => { const p = new URLSearchParams({ page: String(page + 1), pageSize: String(size) }); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); return p.toString(); }, [page, size, f]);
  const { data, refetch } = useApi<Page>(`/visitors/biostar/credentials?${qs}`);
  useGateLive(() => void refetch({ silent: true }), ['identity']);
  const { busy, error, run } = useAction();
  const [revoke, setRevoke] = useState<Cred | null>(null);
  const [reason, setReason] = useState('');
  const set = (k: keyof typeof f, v: string) => { setPage(0); setF((x) => ({ ...x, [k]: v })); };
  const doRevoke = () => run('revoke', async () => { if (!revoke) return; await api.post(`/visitors/biostar/credentials/${revoke.id}/revoke`, { reason }); setRevoke(null); setReason(''); await refetch({ silent: true }); });

  return (
    <GateShell title="Codes" intro="Every code your flap barrier readers accept comes from here. A visitor's code is made when their phone opens the pass on the day; a delegate's changes every day.">
      <ErrorLine error={error} />
      {data && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(CRED_STATE).map(([k, [c, l]]) => <button key={k} type="button" onClick={() => set('state', f.state === k ? '' : k)} className={`rounded-full ${f.state === k ? 'ring-2 ring-blue-500' : ''}`}><Badge color={c}>{l} {data.counts[k] ?? 0}</Badge></button>)}
        </div>
      )}
      <Panel title={data ? `${data.total} code(s)` : 'Codes'}>
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500">Type<select id="codes-kind" className={`${selectCls} mt-1 w-full`} value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="">QR codes and tags</option><option value="QR">QR codes</option><option value="CSN">Walk-in tags</option></select></label>
          <label className="text-xs text-slate-500">Holder<input id="codes-search" className={`${inputCls} mt-1`} value={f.search} onChange={(e) => set('search', e.target.value)} placeholder="Name" /></label>
        </div>
        <DataTable head={['Code', 'Holder', 'State', 'Valid', 'Reached BioStar', 'Ended', '']} empty={data && !data.credentials.length ? 'No codes.' : false}>
          {data?.credentials.map((c) => {
            const [color, label] = CRED_STATE[c.state] ?? ['gray', c.state];
            return (
              <tr key={c.id}>
                <td className="px-5 py-2.5 font-mono text-xs">{c.last4}<span className="block font-sans text-slate-500">{c.kind === 'CSN' ? 'tag' : c.forDay ?? 'QR'}</span></td>
                <td className="px-5 py-2.5"><Link to={`/visitors/gate/people/${c.identityId}`} className="font-medium hover:underline">{c.holder}</Link><span className="block text-xs text-slate-500">{PERSON_KIND[c.holderKind]}</span></td>
                <td className="px-5 py-2.5"><Badge color={color}>{label}</Badge></td>
                <td className="px-5 py-2.5 text-xs tabular-nums">{stamp(c.validFrom)} – {time(c.validUntil)}</td>
                <td className="px-5 py-2.5 text-xs">{c.liveAt ? `after ${ms(c.reachedBioStarMs)}` : 'not yet'}</td>
                <td className="px-5 py-2.5 text-xs">{c.endedAt ? `${END_REASON[c.endReason ?? ''] ?? c.endReason}, ${stamp(c.endedAt)}` : '—'}</td>
                <td className="px-5 py-2.5 text-right">{['ISSUED', 'LIVE', 'GRACE'].includes(c.state) && <Button size="sm" variant="ghost" onClick={() => setRevoke(c)}>Revoke</Button>}</td>
              </tr>
            );
          })}
        </DataTable>
        {data && <TablePager page={page} pageSize={size} total={data.total} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(0); }} noun="codes" />}
      </Panel>
      <Modal open={!!revoke} onClose={() => setRevoke(null)} title={`Revoke code ${revoke?.last4 ?? ''}`}>
        <form className="space-y-4 text-sm" onSubmit={(e) => { e.preventDefault(); void doRevoke(); }}>
          <p className="text-slate-600 dark:text-slate-400">The code stops working at the flap barriers within seconds. {revoke?.holder} needs a new one (a visitor's phone gets one when they open the pass again).</p>
          <label className="block">Reason<input id="revoke-reason" className={`${inputCls} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setRevoke(null)}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 3 || busy === 'revoke'}>Revoke</Button></div>
        </form>
      </Modal>
    </GateShell>
  );
}
