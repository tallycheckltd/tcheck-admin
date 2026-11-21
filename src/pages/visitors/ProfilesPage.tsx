import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Users, ShieldOff, ShieldCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SearchInput } from '../../components/ui/SearchInput';
import { stamp, guestFrom, type VisitorProfile } from './visitorsApi';
import { PageHeader, Segmented, RowList, PersonRow, Pill, ListSkeleton } from './visitorsUi';

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
    <div className="space-y-6">
      <PageHeader title="Visitor profiles" intro="Everyone who has visited or been invited. Block someone to stop them coming in." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Show" value={blockedOnly ? 'blocked' : 'all'} onChange={(k) => setBlockedOnly(k === 'blocked')} options={[{ key: 'all', label: 'Everyone' }, { key: 'blocked', label: 'Blocked' }]} />
        <div className="w-full sm:w-72"><SearchInput id="profiles-search" aria-label="Search visitors" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or ID" /></div>
      </div>

      {loading && !data ? <ListSkeleton /> : rows.length === 0 ? (
        <EmptyState icon={Users} title={blockedOnly ? 'No one is blocked' : 'No visitors yet'} description={blockedOnly ? 'Blocked visitors show here.' : 'A profile is created the first time someone is invited or comes in.'} />
      ) : (
        <RowList caption={`${rows.length} ${blockedOnly ? 'blocked ' : ''}visitor${rows.length === 1 ? '' : 's'}`}>
          {rows.map((p) => (
            <PersonRow key={p.id} name={p.name} highlight={p.isBlocked ? 'bad' : null}
              status={p.isBlocked ? <Pill tone="red">Blocked</Pill> : p.visitCount > 1 ? <Pill tone="violet">Returning</Pill> : null}
              meta={[p.phone, p.email, p.company, p.nationalId && `ID ${p.nationalId}`]}
              details={p.isBlocked && p.blockedReason ? <span className="text-rose-700 dark:text-rose-300">{p.blockedReason}</span> : p.lastInvitedAt ? `Last invited ${stamp(p.lastInvitedAt)}${p.lastInvitedBy ? ` by ${p.lastInvitedBy}` : ''}` : null}
              aside={<><span className="font-semibold tabular-nums text-slate-900 dark:text-white">{p.visitCount} visit{p.visitCount === 1 ? '' : 's'}</span><span className="block text-xs text-slate-500">{p.inviteCount}× invited · last here {stamp(p.lastVisitAt)}</span></>}
              actions={<>
                {!p.isBlocked && p.email && <Button size="sm" variant="secondary" onClick={() => navigate('/visitors/invite', { state: { prefill: guestFrom(p) } })}><History size={14} />Invite</Button>}
                {p.isBlocked
                  ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => unblock(p.id)}><ShieldCheck size={14} />Unblock</Button>
                  : <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setBlocking(p); setReason(''); }}><ShieldOff size={14} />Block</Button>}
              </>}
            />
          ))}
        </RowList>
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
