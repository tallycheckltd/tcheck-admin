import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, Clock, Mail, KeyRound, UploadCloud, Building2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

interface OnbRow {
  schoolId: string; name: string; code: string; createdAt: string; completedAt: string | null; windowOpen: boolean;
  windowClosesAt: string; isolated: boolean; institution: { id: string; name: string } | null;
  activation: { roster: number; claimed: number; firstCheckIn: number };
  checklist: { key: string; label: string; done: boolean }[];
}

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/**
 * UAT §5 (2026-09-29) — Onboarding: each new tenant from "created" to "actually used", watched from
 * outside (the platform doesn't open tenant records). Cards grouped by institution; the checklist as a
 * bar with done / missing chips; activation as a funnel with percentages; the setup window as a
 * countdown. Actions: Open setup (window open), Request setup access (window closed → a SETUP support
 * grant the School Admin approves), Nudge admin (tells the School Admins what is still missing).
 * Tenants that need attention first.
 */
export function PlatformOnboardingPage() {
  const { data, refetch } = useApi<{ rows: OnbRow[] }>('/platform/onboarding');
  const [notice, setNotice] = useState('');
  const [grantFor, setGrantFor] = useState<OnbRow | null>(null);

  const groups = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    // Needs attention first: open window with low progress, then the rest; complete last.
    const score = (r: OnbRow) => (r.completedAt ? 3 : r.windowOpen ? 0 : 1) * 1000 + pct(r.checklist.filter((c) => c.done).length, r.checklist.length);
    rows.sort((a, b) => score(a) - score(b));
    const by = new Map<string, { name: string; rows: OnbRow[] }>();
    for (const r of rows) {
      const key = r.institution?.id ?? `solo:${r.schoolId}`;
      const g = by.get(key) ?? { name: r.institution?.name ?? r.name, rows: [] };
      g.rows.push(r);
      by.set(key, g);
    }
    return [...by.values()];
  }, [data]);

  const nudge = async (r: OnbRow) => {
    try {
      const res = await api.post<{ notified: number }>(`/platform/onboarding/${r.schoolId}/nudge`, {});
      setNotice(`Reminded ${res.notified} School Admin${res.notified === 1 ? '' : 's'} at ${r.name}.`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not send the reminder'); }
    setTimeout(() => setNotice(''), 5000);
  };

  return (
    <div className="space-y-6" data-testid="platform-onboarding">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Onboarding</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Each tenant's setup and how its students are taking it up. The platform can open a tenant's Institution Setup only during its first 30 days; after that, the School Admin approves a setup access request.</p>
      </div>
      {notice && <p className="text-sm rounded-lg px-3 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300">{notice}</p>}

      {groups.map((g) => (
        <section key={g.name} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2"><Building2 size={14} /> {g.name}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {g.rows.map((r) => {
              const done = r.checklist.filter((c) => c.done).length;
              const progress = pct(done, r.checklist.length);
              const left = daysLeft(r.windowClosesAt);
              const a = r.activation;
              return (
                <article key={r.schoolId} className="glass-card p-5 space-y-4" data-testid="onboarding-card">
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{r.name} <span className="text-xs font-normal text-gray-400">{r.code}</span></p>
                      <p className="text-xs text-gray-500">Created {new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    {r.completedAt ? <Badge color="green">Setup complete</Badge>
                      : r.windowOpen ? <Badge color={left <= 7 ? 'red' : 'blue'}><Clock size={11} className="inline mr-1" />Window closes in {left} day{left === 1 ? '' : 's'}</Badge>
                        : <Badge color="gray">Window closed</Badge>}
                  </header>

                  {r.isolated ? (
                    <p className="text-sm text-gray-500">Isolated deployment — its setup and students live in its own database, not connected to the platform yet.</p>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1"><span>Setup checklist</span><span>{done} of {r.checklist.length}</span></div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden"><div className={`h-2 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} /></div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {r.checklist.map((c) => (
                            <span key={c.key} className={`text-[11px] rounded-full px-2 py-0.5 flex items-center gap-1 ${c.done ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                              {c.done ? <Check size={10} /> : <Circle size={10} />} {c.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">Students taking it up</p>
                        {([['On the roster', a.roster, a.roster], ['Signed in', a.claimed, a.roster], ['First check-in', a.firstCheckIn, a.roster]] as const).map(([label, n, of]) => (
                          <div key={label} className="flex items-center gap-2 text-xs mb-1">
                            <span className="w-28 text-gray-600 dark:text-gray-300">{label}</span>
                            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden"><div className="h-2 bg-violet-500" style={{ width: `${of ? Math.min(100, pct(n, of)) : 0}%` }} /></div>
                            <span className="w-20 text-right text-gray-700 dark:text-gray-200">{n}{label !== 'On the roster' && of ? ` · ${pct(n, of)}%` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {!r.completedAt && !r.isolated && (
                    <footer className="flex flex-wrap gap-2 pt-1">
                      {r.windowOpen
                        ? <Link to={`/platform/setup/${r.schoolId}`}><Button size="sm"><UploadCloud size={14} className="mr-1.5" />Open setup</Button></Link>
                        : <Button size="sm" variant="secondary" onClick={() => setGrantFor(r)}><KeyRound size={14} className="mr-1.5" />Request setup access</Button>}
                      {done < r.checklist.length && <Button size="sm" variant="secondary" onClick={() => void nudge(r)}><Mail size={14} className="mr-1.5" />Nudge admin</Button>}
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {data && !data.rows.length && <p className="glass-card p-6 text-sm text-gray-500 text-center">No tenants yet.</p>}
      {grantFor && <SetupGrantModal row={grantFor} onClose={() => setGrantFor(null)} onDone={(m) => { setGrantFor(null); setNotice(m); refetch(); }} />}
    </div>
  );
}

function SetupGrantModal({ row, onClose, onDone }: { row: OnbRow; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('24');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.post('/platform/support-grants', { schoolId: row.schoolId, scope: 'SETUP', reason: reason.trim(), hours: Number(hours) });
      onDone(`Setup access requested — ${row.name}'s School Admins have been asked to approve it.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Request setup access — ${row.name}`}>
      <div className="space-y-3 text-sm">
        <p className="text-gray-500">The School Admin approves (and can shorten) it; everything done under it is recorded and visible to them.</p>
        <label className="block">Why <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-2 py-1.5 dark:bg-white/5" placeholder="e.g. Import the timetable they sent on 28 Sept" /></label>
        <label className="block">For how long <select value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1 rounded-lg border px-2 py-1.5 dark:bg-white/5">{[4, 8, 24, 48, 72].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></label>
        {error && <p className="text-rose-600">{error}</p>}
        <div className="flex gap-2 justify-end"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy || reason.trim().length < 5} onClick={() => void submit()}>Send request</Button></div>
      </div>
    </Modal>
  );
}
