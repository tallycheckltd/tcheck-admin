import { useState } from 'react';
import { DoorOpen, Fingerprint, Loader2, QrCode, ScanFace } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { GateShell, Panel, ErrorLine } from './gateShared';
import { useGateLive, useAction, ago, ms, DOOR_STATE, inputCls, selectCls } from './gateLib';

/**
 * Gate access → Doors (2026-11-20): every BioStar door with its live state, its readers (model,
 * firmware, what they read, In/Out), the tablets that admit to it and today's traffic by hour.
 * ICT marks readers In or Out, links tablets, and can open a door (a reason is required; audited).
 */
interface Reader { id: string; name: string; model: string | null; firmware: string | null; ip: string | null; direction: 'IN' | 'OUT' | 'NONE'; readsQr: boolean; readsFinger: boolean; readsFace: boolean; online: boolean; lastSeenAt: string | null; doorId: string | null; missingSince: string | null; userCount: number | null; cardCount: number | null }
interface Door {
  id: string; name: string; state: string; stateAt: string | null; alarm: string | null; online: boolean; lastEventAt: string | null; missingSince: string | null;
  readers: Reader[]; tablets: { id: string; name: string }[]; today: { in: number; out: number; refused: number; byHour: number[] };
}
interface Doors { doors: Door[]; unassignedReaders: Reader[]; tablets: { id: string; name: string; doorId: string | null }[] }

function ReaderRow({ r, doors, onChange, busy }: { r: Reader; doors: Door[]; onChange: (patch: Record<string, unknown>) => void; busy: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
      <div className="min-w-[180px] flex-1">
        <p className="font-medium text-slate-950 dark:text-white">{r.name} {!r.online && <Badge color="red">Offline</Badge>} {r.missingSince && <Badge color="gray">Gone from BioStar</Badge>}</p>
        <p className="text-xs text-slate-500">{r.model ?? 'Unknown model'}{r.firmware ? ` · firmware ${r.firmware}` : ''}{r.ip ? ` · ${r.ip}` : ''} · seen {ago(r.lastSeenAt)}</p>
      </div>
      <div className="flex gap-1.5 text-slate-500" aria-label="Reads">
        {r.readsQr && <span title="Reads QR codes" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10"><QrCode size={12} /> QR</span>}
        {r.readsFinger && <span title="Reads fingerprints" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10"><Fingerprint size={12} /> Finger</span>}
        {r.readsFace && <span title="Reads faces" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10"><ScanFace size={12} /> Face</span>}
      </div>
      <label className="text-xs text-slate-500">Direction
        <select id={`dir-${r.id}`} className={`${selectCls} ml-2`} value={r.direction} disabled={busy} onChange={(e) => onChange({ direction: e.target.value })}>
          <option value="IN">In</option><option value="OUT">Out</option><option value="NONE">Not set</option>
        </select>
      </label>
      <label className="text-xs text-slate-500">Door
        <select id={`door-${r.id}`} className={`${selectCls} ml-2`} value={r.doorId ?? ''} disabled={busy} onChange={(e) => onChange({ doorId: e.target.value || null })}>
          <option value="">None</option>{doors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
    </li>
  );
}

export function GateDoorsPage() {
  const { data, refetch, loading } = useApi<Doors>('/visitors/biostar/doors', { refetchIntervalMs: 30_000, refetchWhenVisible: true });
  useGateLive(() => void refetch({ silent: true }), ['door', 'event']);
  const { busy, error, run } = useAction();
  const [openFor, setOpenFor] = useState<Door | null>(null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const patchReader = (id: string, patch: Record<string, unknown>) => run(`r-${id}`, async () => { await api.put(`/visitors/biostar/readers/${id}`, patch); await refetch({ silent: true }); });
  const linkTablet = (id: string, doorId: string | null) => run(`t-${id}`, async () => { await api.put(`/visitors/biostar/tablets/${id}/door`, { doorId }); await refetch({ silent: true }); });
  const openDoor = () => run('open', async () => {
    if (!openFor) return;
    setResult('Asking BioStar to open the door…');
    const r = await api.post<{ jobId: string }>(`/visitors/biostar/doors/${openFor.id}/open`, { reason });
    for (let i = 0; i < 40; i += 1) {
      await new Promise((ok) => setTimeout(ok, 500));
      const s = await api.get<{ status: string; error: string | null; tookMs: number | null }>(`/visitors/biostar/door-jobs/${r.jobId}`);
      if (s.status === 'OPENED') { setResult(`Opened in ${ms(s.tookMs)}. It locks again on its own.`); return; }
      if (s.status === 'FAILED') { setResult(`Didn't open: ${s.error ?? 'BioStar refused'}. Use the manual release.`); return; }
    }
    setResult('No answer from the connector within 20 seconds. Use the manual release.');
  });

  return (
    <GateShell title="Doors" intro="Doors and readers come from BioStar. Mark each reader In or Out so scans check people in and out. Opening a door from here needs a reason and is recorded.">
      <ErrorLine error={error} />
      {loading && !data && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading…</p>}
      {data && !data.doors.length && <p className="text-sm text-slate-500">No doors yet. They appear once the connector is running and BioStar has doors set up.</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {data?.doors.map((d) => {
          const [color, label] = DOOR_STATE[d.state] ?? DOOR_STATE.UNKNOWN!;
          const max = Math.max(1, ...d.today.byHour);
          return (
            <Panel key={d.id} title={d.name} hint={`${d.missingSince ? 'No longer in BioStar · ' : ''}last scan ${ago(d.lastEventAt)}`}
              actions={<div className="flex items-center gap-2"><Badge color={color}>{label}</Badge>{!d.online && <Badge color="red">Offline</Badge>}<Button size="sm" variant="secondary" onClick={() => { setOpenFor(d); setReason(''); setResult(null); }} disabled={!!d.missingSince}><DoorOpen size={14} /> Open door</Button></div>}>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div><p className="text-xs text-slate-500">In today</p><p className="text-lg font-semibold tabular-nums">{d.today.in}</p></div>
                <div><p className="text-xs text-slate-500">Out today</p><p className="text-lg font-semibold tabular-nums">{d.today.out}</p></div>
                <div><p className="text-xs text-slate-500">Refused</p><p className={`text-lg font-semibold tabular-nums ${d.today.refused ? 'text-rose-600' : ''}`}>{d.today.refused}</p></div>
              </div>
              <div className="mt-3 flex h-12 items-end gap-0.5" role="img" aria-label="Entries by hour today">
                {d.today.byHour.map((n, h) => <div key={h} title={`${String(h).padStart(2, '0')}:00 — ${n}`} className="flex-1 rounded-t bg-blue-500/80" style={{ height: `${Math.max(2, (n / max) * 100)}%`, opacity: n ? 1 : 0.15 }} />)}
              </div>
              <p className="mt-1 flex justify-between text-[10px] text-slate-400"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></p>
              {d.alarm && <p className="mt-2 text-xs text-rose-600">Alarm: {d.alarm}</p>}
              <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Readers</h3>
              <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                {d.readers.map((r) => <ReaderRow key={r.id} r={r} doors={data.doors} busy={busy === `r-${r.id}`} onChange={(p) => void patchReader(r.id, p)} />)}
                {!d.readers.length && <li className="py-2 text-slate-500">No readers on this door.</li>}
              </ul>
              <p className="mt-3 text-xs text-slate-500">Tablets admitting to this door: {d.tablets.length ? d.tablets.map((t) => t.name).join(', ') : 'none'}</p>
            </Panel>
          );
        })}
      </div>
      {!!data?.unassignedReaders.length && (
        <Panel title="Readers not on a door" hint="Give each a door and a direction, or leave it (an enrolment reader at a desk needs neither).">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">{data.unassignedReaders.map((r) => <ReaderRow key={r.id} r={r} doors={data.doors} busy={busy === `r-${r.id}`} onChange={(p) => void patchReader(r.id, p)} />)}</ul>
        </Panel>
      )}
      {!!data?.tablets.length && (
        <Panel title="Gate tablets" hint="A visitor checked in with a six-digit code at a tablet goes through the door the tablet is linked to.">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-white/5">
            {data.tablets.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium">{t.name}</span>
                <select id={`tab-${t.id}`} aria-label={`Door for ${t.name}`} className={selectCls} value={t.doorId ?? ''} disabled={busy === `t-${t.id}`} onChange={(e) => void linkTablet(t.id, e.target.value || null)}>
                  <option value="">No door (code check-in only)</option>{data.doors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Modal open={!!openFor} onClose={() => setOpenFor(null)} title={`Open ${openFor?.name ?? 'door'}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void openDoor(); }}>
          <p className="text-sm text-slate-600 dark:text-slate-400">BioStar opens the door once; it locks again on its own timer. This is recorded with your name and reason.</p>
          <label className="block text-sm">Reason<input id="open-reason" className={`${inputCls} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Delivery van at the main gate" required minLength={3} /></label>
          {result && <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">{result}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpenFor(null)}>Close</Button><Button type="submit" disabled={reason.trim().length < 3 || busy === 'open'}>{busy === 'open' ? 'Opening…' : 'Open door'}</Button></div>
        </form>
      </Modal>
    </GateShell>
  );
}
