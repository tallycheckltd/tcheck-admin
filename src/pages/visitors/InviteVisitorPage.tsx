import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { History, MailCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { InviteForm } from './InviteForm';
import { GuestPicker } from './GuestPicker';
import { STATUS_BADGE, windowLabel, stamp, guestFrom, type GuestEntry, type VisitorInvite } from './visitorsApi';

/**
 * Visitors (2026-11-13) — "Invite a visitor", for every staff member the school allows and every
 * admin: the form, "Invite again" (past guests: one tap fills the form, or several invited together),
 * and the person's own invitations (Active / Past) with Cancel and Invite again.
 */
const ADMIN_ROLES = ['SCHOOL_ADMIN', 'ICT_ADMIN'];

export function InviteVisitorPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const admin = ADMIN_ROLES.includes(user?.role ?? '');
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const { data, refetch, error } = useApi<VisitorInvite[]>(`/visitors/invites/mine?state=${tab}`);
  const guests = useApi<GuestEntry[]>('/visitors/guests?limit=200');
  const [busy, setBusy] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<GuestEntry | null>(null);
  const rows = data ?? [];

  // "Invite again" from another page (admin Invites, Visitor profiles) arrives as router state.
  useEffect(() => {
    const p = (location.state as { prefill?: GuestEntry } | null)?.prefill;
    if (p) { setPrefill({ ...p }); navigate(location.pathname, { replace: true, state: null }); }
  }, [location.state, location.pathname, navigate]);

  const again = (r: VisitorInvite) => {
    const known = guests.data?.find((g) => g.visitorId === r.visitorId);
    const g = known ?? guestFrom(r);
    if (g) setPrefill({ ...g, lastValidFrom: r.validFrom, lastValidUntil: r.validUntil, lastPurpose: r.purpose });
  };
  const cancel = async (id: string) => {
    setBusy(id);
    try { await api.post(`/visitors/invites/${id}/cancel`); await refetch({ silent: true }); } catch { /* the API's message is shown by the app's error toast */ } finally { setBusy(null); }
  };
  const refreshAll = () => { void refetch({ silent: true }); void guests.refetch({ silent: true }); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Invite a visitor</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">The visitor gets an email with a QR code and a six-digit code, valid only for the time you choose. You get an email when they arrive.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <InviteForm prefill={prefill} guests={guests.data ?? []} onClearPrefill={() => setPrefill(null)} onCreated={() => { setTab('active'); refreshAll(); }} />
        <GuestPicker guests={guests.data ?? []} loading={guests.loading} admin={admin} onPick={(g) => setPrefill({ ...g })} onGroupDone={refreshAll} />
      </div>

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
          <EmptyState icon={MailCheck} title={tab === 'active' ? 'No visitors expected' : 'No past invitations'} description={tab === 'active' ? 'Invitations you send show here until the visitor arrives or the visit ends.' : 'Used, cancelled and expired invitations show here — invite anyone again in one tap.'} />
        ) : (
          <div className="glass-card divide-y divide-gray-100 dark:divide-white/5">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-slate-950 dark:text-white">{r.guestName}{r.guestCompany && <span className="font-normal text-slate-500"> · {r.guestCompany}</span>}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{windowLabel(r.validFrom, r.validUntil)}{r.purpose ? ` · ${r.purpose}` : ''}</p>
                  <p className="text-xs text-slate-500">
                    {r.status === 'PENDING' ? <>Gate code <span className="font-mono font-semibold tracking-widest">{r.code}</span></> : r.checkInAt ? `Arrived ${stamp(r.checkInAt)}${r.checkOutAt ? ` · left ${stamp(r.checkOutAt)}` : ''}` : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={STATUS_BADGE[r.status][0]}>{STATUS_BADGE[r.status][1]}</Badge>
                  {r.visitorId && <Button size="sm" variant="ghost" onClick={() => again(r)}><History size={14} className="mr-1.5" />Invite again</Button>}
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
