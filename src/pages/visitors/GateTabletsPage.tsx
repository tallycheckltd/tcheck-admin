import { useEffect, useState } from 'react';
import { Smartphone, Plus, KeyRound, Power, Pencil, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { stamp } from './visitorsApi';

/**
 * Visitors (2026-11-13) — gate tablets (ICT Admin, School Admin). A tablet is named here and
 * activated once with a code typed into the tablet app; nobody signs in on it. Every check-in and
 * check-out then records which tablet did it. Deactivating a tablet stops it at once.
 */
interface GateTablet {
  id: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
  codeExpired: boolean;
  activationExpiresAt: string | null;
  activatedAt: string | null;
  lastSeenAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
}
interface TabletList { terminals: GateTablet[]; codeMinutes: number }
interface IssuedCode { terminal: GateTablet; activationCode: string; expiresAt: string }

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function statusBadge(t: GateTablet) {
  if (t.status === 'ACTIVE') return <Badge color="green">Active</Badge>;
  if (t.status === 'DEACTIVATED') return <Badge color="gray">Deactivated</Badge>;
  return t.codeExpired ? <Badge color="red">Code expired</Badge> : <Badge color="blue">Waiting for code</Badge>;
}

/** "3 min ago" for a tablet seen recently; the date and time otherwise. */
function lastSeen(iso: string | null): string {
  if (!iso) return '—';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 2) return 'Just now';
  if (min < 60) return `${min} min ago`;
  return stamp(iso);
}

export function GateTabletsPage() {
  const { data, loading, refetch } = useApi<TabletList>('/visitors/terminals');
  const rows = data?.terminals ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<GateTablet | null>(null);
  const [stopping, setStopping] = useState<GateTablet | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // While a code is on screen: count it down, and watch for the tablet using it.
  useEffect(() => {
    if (!issued) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(issued.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const clock = setInterval(tick, 1000);
    const poll = setInterval(() => { void refetch({ silent: true }); }, 4000);
    return () => { clearInterval(clock); clearInterval(poll); };
  }, [issued, refetch]);
  const issuedNow = issued ? rows.find((t) => t.id === issued.terminal.id) : undefined;
  const activated = !!issued && issuedNow?.status === 'ACTIVE';

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true); setError(null);
    try { await fn(); await refetch({ silent: true }); } catch (e) { setError(errorText(e, fallback)); } finally { setBusy(false); }
  };
  const add = () => run(async () => {
    const res = await api.post<IssuedCode>('/visitors/terminals', { name });
    setAdding(false); setName(''); setIssued(res);
  }, 'Could not add the tablet. Try again.');
  const newCode = (t: GateTablet) => run(async () => {
    const res = await api.post<IssuedCode>(`/visitors/terminals/${t.id}/code`);
    setIssued(res);
  }, 'Could not issue a code. Try again.');
  const rename = () => run(async () => {
    if (!renaming) return;
    await api.post(`/visitors/terminals/${renaming.id}/rename`, { name });
    setRenaming(null); setName('');
  }, 'Could not rename the tablet. Try again.');
  const deactivate = () => run(async () => {
    if (!stopping) return;
    await api.post(`/visitors/terminals/${stopping.id}/deactivate`);
    setStopping(null);
  }, 'Could not deactivate the tablet. Try again.');

  const code = issued?.activationCode ?? '';
  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Gate tablets</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Name each tablet, then type its activation code into the Tcheck Visitors app once. Nobody signs in on the tablet, and every check-in records which tablet did it.
          </p>
        </div>
        <Button onClick={() => { setName(''); setError(null); setAdding(true); }}><Plus size={16} className="mr-1.5" />Add tablet</Button>
      </div>

      {error && !adding && !renaming && !stopping && <p role="alert" className="text-sm text-rose-700 dark:text-red-400">{error}</p>}

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Smartphone} title="No tablets yet" description='Add one for each gate or front desk, for example "Main Gate" or "Reception".' />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Tablet</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Activated</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((t) => (
                <tr key={t.id} className={t.status === 'DEACTIVATED' ? 'opacity-60' : undefined}>
                  <td className="px-4 py-3 font-medium text-slate-950 dark:text-white">{t.name}</td>
                  <td className="px-4 py-3">{statusBadge(t)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{stamp(t.activatedAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{t.status === 'ACTIVE' ? lastSeen(t.lastSeenAt) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setName(t.name); setError(null); setRenaming(t); }}><Pencil size={14} className="mr-1.5" />Rename</Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => newCode(t)}>
                        <KeyRound size={14} className="mr-1.5" />{t.status === 'DEACTIVATED' ? 'Reactivate' : 'New code'}
                      </Button>
                      {t.status !== 'DEACTIVATED' && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setError(null); setStopping(t); }}><Power size={14} className="mr-1.5" />Deactivate</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a tablet">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) void add(); }}>
          <Input id="tablet-name" label="Where is this tablet?" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Main Gate" autoFocus />
          <p className="text-sm text-slate-600 dark:text-slate-400">This name shows on the tablet and beside every check-in it makes.</p>
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || name.trim().length < 2}>{busy ? 'Adding…' : 'Add and show code'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!issued} onClose={() => setIssued(null)} title={issued ? `Activate ${issued.terminal.name}` : ''}>
        {issued && (activated ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{issued.terminal.name} is active</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">The tablet is ready to check visitors in.</p>
            <div className="flex justify-center"><Button onClick={() => setIssued(null)}>Done</Button></div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">Open the Tcheck Visitors app on the tablet and type this code.</p>
            <p className="font-mono text-4xl font-bold tracking-[0.2em] text-slate-950 dark:text-white select-all" aria-label="Activation code">
              {code.slice(0, 4)} {code.slice(4)}
            </p>
            {secondsLeft > 0
              ? <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">Expires in {mm}:{ss}. It works once.</p>
              : <p className="text-sm text-rose-700 dark:text-red-400">This code has expired. Close this and choose New code.</p>}
            <p className="text-xs text-slate-500">The code is shown only here. This box closes by itself when the tablet uses it.</p>
            <div className="flex justify-center"><Button variant="secondary" onClick={() => setIssued(null)}>Close</Button></div>
          </div>
        ))}
      </Modal>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title={renaming ? `Rename ${renaming.name}` : ''}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) void rename(); }}>
          <Input id="tablet-rename" label="New name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          <p className="text-sm text-slate-600 dark:text-slate-400">Past check-ins keep the name the tablet had at the time.</p>
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={busy || name.trim().length < 2}>{busy ? 'Saving…' : 'Save name'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!stopping} onClose={() => setStopping(null)} title={stopping ? `Deactivate ${stopping.name}?` : ''}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">The tablet stops working straight away and goes back to the activation screen. Use this if it is lost, stolen or retired. You can reactivate it later with a new code.</p>
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStopping(null)}>Keep active</Button>
            <Button variant="danger" disabled={busy} onClick={deactivate}>{busy ? 'Deactivating…' : 'Deactivate tablet'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
