import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Fingerprint, Loader2, XCircle } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { TablePager } from '../../../components/ui/TablePager';
import { GateShell, Panel, DataTable, ErrorLine, Tile } from './gateShared';
import { useGateLive, useAction, inputCls, selectCls } from './gateLib';
import { stamp } from '../visitorsApi';

/**
 * Gate access → Fingerprints (2026-11-20). Who has a fingerprint at the gates, consent (in the app
 * or at the desk), quality, which reader, who enrolled them and when it will be deleted. Enrolment
 * runs on a BioStar reader with the person present: the screen follows each step live. The
 * fingerprint itself is stored only in BioStar — there is nothing biometric in Tcheck to show.
 */
interface Row { id: string; userId: string; name: string | null; email: string | null; role: string | null; status: string; fingers: number; quality: number | null; reader: string | null; enrolledBy: string | null; consentAt: string; consentSource: string; consentVersion: string; enrolledAt: string | null; deleteAfter: string | null; failureReason: string | null; identityId: string | null }
interface Page { total: number; page: number; pageSize: number; counts: Record<string, number>; enrolments: Row[] }
interface Candidate { id: string; name: string; email: string; role: string; fingerprint: string }
interface Reader { id: string; name: string; readsFinger: boolean; online: boolean; missingSince: string | null }
interface Doors { doors: { readers: Reader[] }[]; unassignedReaders: Reader[] }
interface Status { status: string; fingers: number; failureReason: string | null; job: { status: string; steps: { step: string; ok: boolean; at: string }[]; error: string | null } | null }

const STATUS: Record<string, ['green' | 'blue' | 'red' | 'purple' | 'gray' | 'yellow', string]> = {
  CONSENTED: ['blue', 'Agreed, not enrolled'], ENROLLING: ['yellow', 'Enrolling'], ENROLLED: ['green', 'Enrolled'], FAILED: ['red', 'Failed'], DELETING: ['yellow', 'Deleting'], DELETED: ['gray', 'Deleted'],
};

export function GateFingerprintsPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const qs = useMemo(() => { const p = new URLSearchParams({ page: String(page + 1), pageSize: String(size) }); if (status) p.set('status', status); if (search) p.set('search', search); return p.toString(); }, [page, size, status, search]);
  const { data, refetch } = useApi<Page>(`/visitors/biometrics?${qs}`);
  useGateLive(() => void refetch({ silent: true }), ['identity', 'job']);
  const { busy, error, run } = useAction();
  const [enrolOpen, setEnrolOpen] = useState(false);
  const remove = (r: Row) => run(`del-${r.userId}`, async () => { await api.delete(`/visitors/biometrics/${r.userId}`); await refetch({ silent: true }); });

  return (
    <GateShell title="Fingerprints" intro="Fingerprints open the gates only on a person's programme days. They are stored on your BioStar server, never in Tcheck, and deleted after the programme ends."
      actions={<Button onClick={() => setEnrolOpen(true)}><Fingerprint size={16} /> Enrol a fingerprint</Button>}>
      <ErrorLine error={error} />
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Enrolled" value={data.counts.ENROLLED ?? 0} />
          <Tile label="Agreed, not enrolled yet" value={data.counts.CONSENTED ?? 0} />
          <Tile label="Being enrolled or deleted" value={(data.counts.ENROLLING ?? 0) + (data.counts.DELETING ?? 0)} />
          <Tile label="Deleted" value={data.counts.DELETED ?? 0} sub="after the programme, on request or by ICT" />
        </div>
      )}
      <Panel title="People">
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500">Status<select id="fp-status" className={`${selectCls} mt-1 w-full`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">All but deleted</option>{Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-xs text-slate-500">Name or email<input id="fp-search" className={`${inputCls} mt-1`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label>
        </div>
        <DataTable head={['Person', 'Status', 'Fingers', 'Consent', 'Enrolled', 'Deleted after', '']} empty={data && !data.enrolments.length ? 'No one yet.' : false}>
          {data?.enrolments.map((r) => {
            const [c, l] = STATUS[r.status] ?? ['gray', r.status];
            return (
              <tr key={r.id}>
                <td className="px-5 py-2.5">{r.identityId ? <Link to={`/visitors/gate/people/${r.identityId}`} className="font-medium hover:underline">{r.name}</Link> : <span className="font-medium">{r.name}</span>}<span className="block text-xs text-slate-500">{r.email} · {r.role?.toLowerCase().replace(/_/g, ' ')}</span></td>
                <td className="px-5 py-2.5"><Badge color={c}>{l}</Badge>{r.failureReason && <span className="block max-w-xs text-xs text-rose-600">{r.failureReason}</span>}</td>
                <td className="px-5 py-2.5 text-xs">{r.status === 'ENROLLED' ? `${r.fingers}${r.quality != null ? ` · quality ${r.quality}` : ''}` : '—'}</td>
                <td className="px-5 py-2.5 text-xs">{stamp(r.consentAt)}<span className="block text-slate-500">{r.consentSource === 'APP' ? 'in the app' : 'at the desk'} · {r.consentVersion}</span></td>
                <td className="px-5 py-2.5 text-xs">{r.enrolledAt ? stamp(r.enrolledAt) : '—'}<span className="block text-slate-500">{[r.reader, r.enrolledBy].filter(Boolean).join(' · ')}</span></td>
                <td className="px-5 py-2.5 text-xs">{r.deleteAfter ? stamp(r.deleteAfter) : '—'}</td>
                <td className="px-5 py-2.5 text-right">{r.status !== 'DELETED' && r.status !== 'DELETING' && <Button size="sm" variant="ghost" disabled={busy === `del-${r.userId}`} onClick={() => void remove(r)}>Delete</Button>}</td>
              </tr>
            );
          })}
        </DataTable>
        {data && <TablePager page={page} pageSize={size} total={data.total} onPage={setPage} onPageSize={(n) => { setSize(n); setPage(0); }} noun="people" />}
      </Panel>
      {enrolOpen && <EnrolModal open onClose={() => { setEnrolOpen(false); void refetch({ silent: true }); }} />}
    </GateShell>
  );
}

const CONSENT = 'The person is here and agrees that their fingerprint is used to let them through the gates on their programme days. It is stored only on the school\'s door system, never by Tcheck, and deleted after their programme ends or when they withdraw consent.';

function EnrolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [person, setPerson] = useState<Candidate | null>(null);
  const [readerId, setReaderId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [enrolmentId, setEnrolmentId] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const { data: found } = useApi<{ people: Candidate[] }>(q.trim().length >= 2 && !person ? `/visitors/biometrics/candidates?search=${encodeURIComponent(q.trim())}` : null);
  const { data: doors } = useApi<Doors>(open ? '/visitors/biostar/doors' : null);
  const readers = useMemo(() => [...(doors?.doors.flatMap((d) => d.readers) ?? []), ...(doors?.unassignedReaders ?? [])].filter((r) => r.readsFinger && !r.missingSince), [doors]);
  const { data: status, refetch } = useApi<Status>(enrolmentId ? `/visitors/biometrics/enrolments/${enrolmentId}` : null);
  useEffect(() => {
    if (!enrolmentId || status?.status === 'ENROLLED' || status?.job?.status === 'FAILED') return;
    const t = setInterval(() => void refetch({ silent: true }), 800);
    return () => clearInterval(t);
  }, [enrolmentId, status, refetch]);

  const start = () => run('enrol', async () => {
    if (!person) return;
    if (person.fingerprint === 'NONE' || person.fingerprint === 'DELETED') await api.post(`/visitors/biometrics/${person.id}/consent`, { confirmPersonPresent: true });
    const r = await api.post<{ enrolmentId: string }>(`/visitors/biometrics/${person.id}/enrol`, { readerId });
    setEnrolmentId(r.enrolmentId);
  });
  const done = status?.status === 'ENROLLED';
  const failed = status?.job?.status === 'FAILED' || (status?.status === 'CONSENTED' && !!status.failureReason);

  return (
    <Modal open={open} onClose={onClose} title="Enrol a fingerprint">
      <div className="space-y-4 text-sm">
        <ErrorLine error={error} />
        {!enrolmentId && (
          <>
            {!person ? (
              <label className="block">Person (student, delegate or staff)
                <input id="enrol-search" className={`${inputCls} mt-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" autoFocus />
                {found?.people.length ? (
                  <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                    {found.people.map((p) => (
                      <li key={p.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => setPerson(p)}>
                        <span className="font-medium">{p.name}</span> <span className="text-xs text-slate-500">{p.email} · {p.fingerprint === 'ENROLLED' ? 'already enrolled' : p.fingerprint === 'NONE' ? 'no fingerprint' : p.fingerprint.toLowerCase()}</span>
                      </button></li>
                    ))}
                  </ul>
                ) : q.trim().length >= 2 ? <p className="mt-2 text-xs text-slate-500">No one found.</p> : null}
              </label>
            ) : (
              <p className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5"><span><span className="font-medium">{person.name}</span> <span className="text-xs text-slate-500">{person.email}</span></span><button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setPerson(null)}>Change</button></p>
            )}
            <label className="block">Reader the person is standing at
              <select id="enrol-reader" className={`${selectCls} mt-1 w-full`} value={readerId} onChange={(e) => setReaderId(e.target.value)}>
                <option value="">Choose a fingerprint reader</option>
                {readers.map((r) => <option key={r.id} value={r.id} disabled={!r.online}>{r.name}{r.online ? '' : ' (offline)'}</option>)}
              </select>
              {doors && !readers.length && <span className="mt-1 block text-xs text-amber-600">No reader that reads fingerprints has been found in BioStar.</span>}
            </label>
            <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <input id="enrol-consent" type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{CONSENT}</span>
            </label>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!person || !readerId || !agreed || busy === 'enrol'} onClick={() => void start()}>{busy === 'enrol' ? 'Starting…' : 'Start enrolment'}</Button></div>
          </>
        )}
        {enrolmentId && (
          <div className="space-y-3" role="status" aria-live="polite">
            <p className="font-medium">{done ? 'Fingerprint saved.' : failed ? 'Enrolment didn\'t finish.' : 'Ask the person to follow the reader.'}</p>
            <ol className="space-y-2">
              {(status?.job?.steps ?? []).map((s, i) => (
                <li key={i} className="flex items-center gap-2">{s.ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-rose-500" />}{s.step}</li>
              ))}
              {!done && !failed && <li className="flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin" />Waiting for the reader…</li>}
              {!status?.job?.steps?.length && !failed && <li className="flex items-center gap-2 text-slate-400"><Circle size={16} />Sending to BioStar</li>}
            </ol>
            {failed && <p className="text-rose-600">{status?.failureReason ?? status?.job?.error}</p>}
            <div className="flex justify-end gap-2">{failed && <Button variant="secondary" onClick={() => setEnrolmentId(null)}>Try again</Button>}<Button onClick={onClose}>{done ? 'Done' : 'Close'}</Button></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
