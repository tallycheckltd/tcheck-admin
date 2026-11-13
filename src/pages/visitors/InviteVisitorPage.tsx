import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { InviteForm } from './InviteForm';
import { STATUS_BADGE, windowLabel, stamp, guestDetailsLabel, type VisitorInvite } from './visitorsApi';

/**
 * Visitors (2026-11-13) — "Invite a visitor", for every staff member the school allows: the form,
 * then the person's own invitations (Active / Past) with Cancel on the ones not yet used.
 */
export function InviteVisitorPage() {
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const { data, refetch, error } = useApi<VisitorInvite[]>(`/visitors/invites/mine?state=${tab}`);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = data ?? [];

  const cancel = async (id: string) => {
    setBusy(id);
    try { await api.post(`/visitors/invites/${id}/cancel`); await refetch({ silent: true }); } catch { /* the API's message is shown by the app's error toast */ } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Invite a visitor</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">The visitor gets an email with a QR code and a six-digit code. You get an email when they arrive.</p>
      </div>

      <InviteForm onCreated={() => { setTab('active'); void refetch({ silent: true }); }} />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">My invitations</h2>
          <div className="flex gap-2">
            <Button size="sm" variant={tab === 'active' ? 'primary' : 'secondary'} onClick={() => setTab('active')}>Active</Button>
            <Button size="sm" variant={tab === 'past' ? 'primary' : 'secondary'} onClick={() => setTab('past')}>Past</Button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {rows.length === 0 ? (
          <EmptyState icon={MailCheck} title={tab === 'active' ? 'No visitors expected' : 'No past invitations'} description={tab === 'active' ? 'Invitations you send show here until the visitor arrives or the visit ends.' : 'Used, cancelled and expired invitations show here.'} />
        ) : (
          <div className="glass-card divide-y divide-gray-100 dark:divide-white/5">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-slate-950 dark:text-white">{r.guestName}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{windowLabel(r.validFrom, r.validUntil)}{r.purpose ? ` · ${r.purpose}` : ''}</p>
                  {guestDetailsLabel(r) && <p className={`text-xs ${guestDetailsLabel(r)!.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{guestDetailsLabel(r)!.text}</p>}
                  <p className="text-xs text-slate-500">
                    {r.status === 'PENDING' ? <>Gate code <span className="font-mono font-semibold tracking-widest">{r.code}</span></> : r.checkInAt ? `Arrived ${stamp(r.checkInAt)}${r.checkOutAt ? ` · left ${stamp(r.checkOutAt)}` : ''}` : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={STATUS_BADGE[r.status][0]}>{STATUS_BADGE[r.status][1]}</Badge>
                  {r.status === 'PENDING' && <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => cancel(r.id)}>Cancel</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
