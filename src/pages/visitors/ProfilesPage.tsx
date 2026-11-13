import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Users, ShieldOff, ShieldCheck, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SearchInput } from '../../components/ui/SearchInput';
import { stamp, guestFrom, type VisitorProfile } from './visitorsApi';

/**
 * Visitors (2026-11-13) — returning visitors and the blocked list (ICT Admin, School Admin). A
 * blocked visitor can't be checked in at the gate or invited; blocking and unblocking are audited.
 */
export function ProfilesPage() {
  const [search, setSearch] = useState('');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [blocking, setBlocking] = useState<VisitorProfile | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const params = new URLSearchParams();
  if (search.trim().length >= 2) params.set('search', search.trim());
  if (blockedOnly) params.set('blocked', 'true');
  const { data, loading, refetch } = useApi<VisitorProfile[]>(`/visitors/profiles?${params.toString()}`);
  const rows = data ?? [];

  const block = async () => {
    if (!blocking) return;
    setBusy(true);
    try { await api.post(`/visitors/profiles/${blocking.id}/block`, { reason: reason || null }); setBlocking(null); setReason(''); await refetch({ silent: true }); } catch { /* shown by the app's error toast */ } finally { setBusy(false); }
  };
  const unblock = async (id: string) => {
    setBusy(true);
    try { await api.post(`/visitors/profiles/${id}/unblock`); await refetch({ silent: true }); } catch { /* shown by the app's error toast */ } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Visitor profiles</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Everyone who has visited or been invited. Block someone to stop them being checked in.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={blockedOnly ? 'primary' : 'secondary'} onClick={() => setBlockedOnly((b) => !b)} aria-pressed={blockedOnly}>Blocked only</Button>
          <div className="w-full sm:w-64"><SearchInput id="profiles-search" aria-label="Search visitors" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or ID" /></div>
        </div>
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={blockedOnly ? 'No one is blocked' : 'No visitors yet'} description={blockedOnly ? 'Blocked visitors show here.' : 'A profile is created the first time someone is invited or checked in.'} />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Visitor</th>
                <th className="px-4 py-3 font-medium">ID number</th>
                <th className="px-4 py-3 font-medium">Invited</th>
                <th className="px-4 py-3 font-medium">Visits</th>
                <th className="px-4 py-3 font-medium">Last visit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((p) => (
                <tr key={p.id} className={p.isBlocked ? 'bg-rose-50/60 dark:bg-red-500/5' : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950 dark:text-white">{p.name} {p.isBlocked && <span className="ml-1 align-middle"><Badge color="red">Blocked</Badge></span>}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{p.phone}{p.email ? ` · ${p.email}` : ''}{p.company ? ` · ${p.company}` : ''}</p>
                    {p.isBlocked && p.blockedReason && <p className="text-xs text-rose-700 dark:text-red-400 mt-0.5">{p.blockedReason}</p>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{p.nationalId ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    <span className="tabular-nums">{p.inviteCount}×</span>
                    {p.lastInvitedAt && <p className="text-xs text-slate-500">last {stamp(p.lastInvitedAt)}{p.lastInvitedBy ? ` by ${p.lastInvitedBy}` : ''}</p>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{p.visitCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{stamp(p.lastVisitAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {!p.isBlocked && p.email && <Button size="sm" variant="secondary" className="mr-2" onClick={() => navigate('/visitors/invite', { state: { prefill: guestFrom(p) } })}><History size={14} className="mr-1.5" />Invite</Button>}
                    {p.isBlocked
                      ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => unblock(p.id)}><ShieldCheck size={14} className="mr-1.5" />Unblock</Button>
                      : <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setBlocking(p); setReason(''); }}><ShieldOff size={14} className="mr-1.5" />Block</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!blocking} onClose={() => setBlocking(null)} title={blocking ? `Block ${blocking.name}?` : ''}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">The guard will see "Entry blocked" and can't check them in, and staff can't invite them. You can unblock them at any time.</p>
          <Input id="block-reason" label="Reason (shown to the guard)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Trespass on 12 Nov" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBlocking(null)}>Keep allowed</Button>
            <Button variant="danger" disabled={busy} onClick={block}>{busy ? 'Blocking…' : 'Block visitor'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
