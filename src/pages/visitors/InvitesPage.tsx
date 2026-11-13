import { useState } from 'react';
import { MailCheck, Plus, X, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { InviteForm } from './InviteForm';
import { STATUS_BADGE, windowLabel, stamp, type InviteStatus, type VisitorInvite } from './visitorsApi';

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
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search.trim().length >= 2) params.set('search', search.trim());
  const { data, loading, refetch } = useApi<VisitorInvite[]>(`/visitors/invites?${params.toString()}`);
  const rows = data ?? [];

  const cancel = async (id: string) => {
    setBusy(id);
    try { await api.post(`/visitors/invites/${id}/cancel`); await refetch({ silent: true }); } catch { /* shown by the app's error toast */ } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Invitations</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Every visitor invited by staff at your school.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? <><X size={16} className="mr-2" />Close</> : <><Plus size={16} className="mr-2" />Invite a visitor</>}
        </Button>
      </div>

      {showForm && <InviteForm onCreated={() => void refetch({ silent: true })} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Button key={f.key || 'all'} size="sm" role="tab" aria-selected={status === f.key} variant={status === f.key ? 'primary' : 'secondary'} onClick={() => setStatus(f.key)}>{f.label}</Button>
          ))}
        </div>
        <div className="w-full sm:w-72"><SearchInput id="invites-search" aria-label="Search invitations" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest, phone, email or code" /></div>
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={MailCheck} title="No invitations" description={status || search ? 'Nothing matches this filter.' : 'When staff invite a visitor, the invitation shows here.'} />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Invited by</th>
                <th className="px-4 py-3 font-medium">Visit window</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950 dark:text-white">{r.guestName}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{r.guestPhone} · {r.guestEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.hostName ?? '—'}{r.purpose && <p className="text-xs text-slate-500">{r.purpose}</p>}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{windowLabel(r.validFrom, r.validUntil)}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_BADGE[r.status][0]}>{STATUS_BADGE[r.status][1]}</Badge>
                    {r.checkInAt && <p className="mt-1 text-xs text-slate-500">at {stamp(r.checkInAt)}</p>}
                    {r.status === 'PENDING' && <p className="mt-1 font-mono text-xs tracking-widest text-slate-500">{r.code}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{stamp(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'PENDING' && <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => cancel(r.id)}>Cancel</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
