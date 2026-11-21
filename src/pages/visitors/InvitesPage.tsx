import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, MailCheck, Plus, X } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { InviteForm } from './InviteForm';
import { windowLabel, stamp, guestFrom, type InviteStatus, type VisitorInvite } from './visitorsApi';
import { PageHeader, Segmented, RowList, PersonRow, Pill, ListSkeleton } from './visitorsUi';

const STATUS_PILL: Record<InviteStatus, ['green' | 'blue' | 'amber' | 'red' | 'gray', string]> = { PENDING: ['blue', 'Expected'], USED: ['green', 'Arrived'], EXPIRED: ['gray', 'Expired'], CANCELLED: ['red', 'Cancelled'] };

/**
 * Visitors (2026-11-13) — every invitation at the school (ICT Admin, School Admin): who invited
 * whom, for when, and what happened. Admins invite from here too, and can cancel any pending one.
 */
const FILTERS: { key: '' | InviteStatus; label: string }[] = [
  { key: '', label: 'All' }, { key: 'PENDING', label: 'Expected' }, { key: 'USED', label: 'Arrived' },
  { key: 'EXPIRED', label: 'Expired' }, { key: 'CANCELLED', label: 'Cancelled' },
];

export function InvitesPage() {
  const [status, setStatus] = useState<'' | InviteStatus>('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();
  const again = (r: VisitorInvite) => navigate('/visitors/invite', { state: { prefill: guestFrom(r) } });
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search.trim().length >= 2) params.set('search', search.trim());
  const { data, loading, refetch } = useApi<VisitorInvite[]>(`/visitors/invites?${params.toString()}`, { refetchIntervalMs: 15_000, refetchWhenVisible: true });
  const rows = data ?? [];

  const cancel = async (id: string) => {
    setBusy(id);
    try { await api.post(`/visitors/invites/${id}/cancel`); await refetch({ silent: true }); } catch { /* shown by the app's error toast */ } finally { setBusy(null); }
  };
  // Gate access (2026-11-20): the visitor changed phone — unlock the pass and send the email again.
  const resetDevice = async (id: string) => {
    setBusy(id);
    try { await api.post(`/visitors/invites/${id}/reset-device`); await refetch({ silent: true }); } catch { /* shown by the app's error toast */ } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invitations" intro="Every visitor invited by staff at your school, and what happened."
        actions={<Button onClick={() => setShowForm((x) => !x)} variant={showForm ? 'secondary' : 'primary'}>{showForm ? <><X size={16} />Close</> : <><Plus size={16} />Invite a visitor</>}</Button>} />

      {showForm && <InviteForm onCreated={() => void refetch({ silent: true })} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filter by status" value={status || 'ALL'} onChange={(k) => setStatus(k === 'ALL' ? '' : k as InviteStatus)}
          options={FILTERS.map((f) => ({ key: f.key || 'ALL', label: f.label, count: f.key ? undefined : rows.length }))} />
        <div className="w-full sm:w-72"><SearchInput id="invites-search" aria-label="Search invitations" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest, phone, email or code" /></div>
      </div>

      {loading && !data ? <ListSkeleton /> : rows.length === 0 ? (
        <EmptyState icon={MailCheck} title="No invitations" description={status || search ? 'Nothing matches this filter.' : 'When staff invite a visitor, the invitation shows here.'} />
      ) : (
        <RowList caption={`${rows.length} invitation${rows.length === 1 ? '' : 's'}`}>
          {rows.map((r) => (
            <PersonRow key={r.id} name={r.guestName}
              status={<><Pill tone={STATUS_PILL[r.status][0]}>{STATUS_PILL[r.status][1]}</Pill>{r.status === 'PENDING' && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-slate-600 dark:bg-white/10 dark:text-slate-300">{r.code}</span>}</>}
              meta={[r.guestPhone, r.guestEmail, r.guestCompany]}
              details={<>Invited by <span className="font-medium text-slate-700 dark:text-slate-300">{r.hostName ?? '—'}</span>{r.purpose ? ` · ${r.purpose}` : ''} · sent {stamp(r.createdAt)}</>}
              aside={<><span className="font-medium text-slate-900 dark:text-white">{windowLabel(r.validFrom, r.validUntil)}</span>{r.checkInAt && <span className="block text-xs text-slate-500">arrived {stamp(r.checkInAt)}</span>}</>}
              actions={<>
                {r.visitorId && <Button size="sm" variant="ghost" onClick={() => again(r)}><History size={14} />Invite again</Button>}
                {r.status === 'PENDING' && <Button size="sm" variant="ghost" disabled={busy === r.id} title="The visitor changed phone: unlock the pass and email it again" onClick={() => resetDevice(r.id)}>Reset device</Button>}
                {r.status === 'PENDING' && <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => cancel(r.id)}>Cancel</Button>}
              </>}
            />
          ))}
        </RowList>
      )}
    </div>
  );
}
