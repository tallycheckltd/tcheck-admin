import { useState } from 'react';
import { clsx } from 'clsx';
import { Check, DoorOpen, Search, X } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

/**
 * F11 (10-22) — TALI campus concierge, staff side. Students book a room by asking TALI in the app.
 * First come, first served (owner, 10-22): a free room within the rules is booked at once and the
 * student gets a confirmation email with a booking code. Staff see what's booked, can take a booking
 * back with a reason, and choose which rooms students may book, for how long and when. A room marked
 * "Needs approval" (an auditorium, a lab that needs setting up) waits here instead.
 */

interface Booking {
  id: string; code: string; room: string | null; studentName: string | null; studentNumber: string | null;
  startsAt: string; endsAt: string; purpose: string; status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'FAILED';
  declineNote: string | null; createdAt: string;
}
interface RoomSetting { roomId: string; name: string; bookable: boolean; maxMinutes: number; openFrom: string; openTo: string; needsApproval: boolean }
interface Rooms { provider: string; connected: boolean; rooms: RoomSetting[] }

const muted = 'text-slate-600 dark:text-slate-400';
const strong = 'text-slate-950 dark:text-white';
const input = 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-sm text-slate-950 dark:text-white';
const when = (s: string, e: string) => {
  const a = new Date(s); const b = new Date(e);
  return `${a.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${a.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${b.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};
const STATUS = { PENDING: ['yellow', 'Waiting'], CONFIRMED: ['green', 'Booked'], DECLINED: ['red', 'Declined'], CANCELLED: ['gray', 'Cancelled'], FAILED: ['gray', 'Failed'] } as const;
type View = 'UPCOMING' | 'PENDING' | 'ALL';

export function RoomBookingsTab() {
  const [view, setView] = useState<View>('UPCOMING');
  const { data, refetch } = useApi<{ bookings: Booking[] }>(`/insights/campus/bookings${view === 'ALL' ? '' : `?status=${view}`}`);
  const { data: waiting, refetch: refetchWaiting } = useApi<{ bookings: Booking[] }>('/insights/campus/bookings?status=PENDING');
  const { data: rooms, refetch: refetchRooms } = useApi<Rooms>('/insights/campus/rooms');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [find, setFind] = useState('');

  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id); setMsg(null);
    try { await fn(); setMsg(done); setCancelling(null); await Promise.all([refetch({ silent: true }), refetchWaiting({ silent: true })]); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(null); }
  };
  const saveRoom = async (r: RoomSetting, patch: Partial<RoomSetting>) => {
    setBusy(r.roomId); setMsg(null);
    const next = { ...r, ...patch };
    try {
      await api.put(`/insights/campus/rooms/${r.roomId}`, { bookable: next.bookable, maxMinutes: next.maxMinutes, openFrom: next.openFrom, openTo: next.openTo, needsApproval: next.needsApproval });
      await refetchRooms({ silent: true });
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(null); }
  };

  const q = find.trim().toLowerCase();
  const list = (data?.bookings ?? []).filter((b) => !q || [b.code, b.room, b.studentName, b.studentNumber, b.purpose].some((x) => x?.toLowerCase().includes(q)));
  const waitingCount = waiting?.bookings.length ?? 0;
  const tabs: { key: View; label: string }[] = [{ key: 'UPCOMING', label: 'Booked' }, ...(waitingCount || view === 'PENDING' ? [{ key: 'PENDING' as View, label: `Waiting${waitingCount ? ` (${waitingCount})` : ''}` }] : []), { key: 'ALL', label: 'Last 30 days' }];

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className={clsx('font-semibold', strong)}>Room bookings</h2>
            <p className={clsx('text-sm', muted)}>Students book by asking TALI in the app. First come, first served: a free room is booked at once and the student is emailed a confirmation with its code.</p>
          </div>
          <div role="tablist" className="inline-flex gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={view === t.key} onClick={() => setView(t.key)}
                className={clsx('rounded-lg px-3 py-1.5 text-sm cursor-pointer', view === t.key ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm' : muted)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="relative block mb-3 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a code, room or student" aria-label="Find a booking" className={clsx(input, 'w-full pl-8')} />
        </label>
        {msg && <p role="status" className="text-sm text-slate-700 dark:text-slate-300 mb-2">{msg}</p>}
        {list.length === 0 ? (
          <EmptyState size="sm" icon={DoorOpen} title={q ? 'Nothing matches' : view === 'PENDING' ? 'Nothing waiting' : 'No bookings yet'} description={q ? 'Try the booking code from the email, e.g. BK-4F7Q2A.' : 'When a student books a room through TALI, it shows here.'} />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {list.map((b) => (
              <div key={b.id} className="py-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className={clsx('font-medium', strong)}>{b.room ?? 'Room'} · {when(b.startsAt, b.endsAt)}</p>
                    <p className={clsx('text-sm', muted)}>{b.studentName ?? 'A student'}{b.studentNumber ? ` (${b.studentNumber})` : ''}{b.purpose ? ` — ${b.purpose}` : ''}</p>
                    <p className="text-xs text-slate-500 font-mono">{b.code}</p>
                  </div>
                  <Badge color={STATUS[b.status][0]}>{STATUS[b.status][1]}</Badge>
                </div>
                {(b.status === 'DECLINED' || b.status === 'CANCELLED') && b.declineNote && <p className={clsx('text-xs', muted)}>{b.declineNote}</p>}
                {b.status === 'PENDING' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={notes[b.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))} maxLength={200}
                      placeholder="Note if you decline (optional)" aria-label="Note to the student" className={clsx(input, 'flex-1 min-w-[12rem]')} />
                    <Button size="sm" onClick={() => act(b.id, () => api.post(`/insights/campus/bookings/${b.id}/decision`, { decision: 'approve' }), 'Approved — the student has been emailed.')} disabled={busy === b.id}><Check size={14} className="mr-1" /> Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => act(b.id, () => api.post(`/insights/campus/bookings/${b.id}/decision`, { decision: 'decline', note: notes[b.id]?.trim() || undefined }), 'Declined — the student has been told.')} disabled={busy === b.id}><X size={14} className="mr-1" /> Decline</Button>
                  </div>
                )}
                {b.status === 'CONFIRMED' && new Date(b.endsAt) > new Date() && (cancelling === b.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input autoFocus value={notes[b.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))} maxLength={200}
                      placeholder="Why (the student sees this)" aria-label="Reason for cancelling" className={clsx(input, 'flex-1 min-w-[12rem]')} />
                    <Button size="sm" variant="danger" disabled={busy === b.id || !notes[b.id]?.trim()} onClick={() => act(b.id, () => api.post(`/insights/campus/bookings/${b.id}/cancel`, { note: notes[b.id]!.trim() }), 'Cancelled — the student has been told and emailed.')}>Cancel booking</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCancelling(null)}>Keep it</Button>
                  </div>
                ) : (
                  <button onClick={() => setCancelling(b.id)} className="text-xs text-rose-600 dark:text-red-400 font-medium cursor-pointer">Cancel this booking</button>
                ))}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className={clsx('font-semibold', strong)}>Rooms students can book</h2>
        <p className={clsx('text-sm mb-3', muted)}>Every room starts closed. Open the ones students may book and set how long and between which hours. Bookings are instant; tick “Needs approval” only for rooms someone must check first. Up to 3 upcoming bookings per student, up to 7 days ahead.</p>
        {!rooms?.rooms.length ? (
          <EmptyState size="sm" icon={DoorOpen} title="No rooms yet" description="Add rooms in Institution Setup first." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm gradient-table">
              <thead><tr><th>Room</th><th>Students can book</th><th>Longest booking</th><th>Bookable between</th><th>Needs approval</th></tr></thead>
              <tbody className="text-slate-800 dark:text-gray-300">
                {rooms.rooms.map((r) => (
                  <tr key={r.roomId}>
                    <td className={clsx('font-medium', strong)}>{r.name}</td>
                    <td>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={r.bookable} disabled={busy === r.roomId} onChange={(e) => saveRoom(r, { bookable: e.target.checked })} aria-label={`Students can book ${r.name}`} />
                        {r.bookable ? 'Open' : 'Closed'}
                      </label>
                    </td>
                    <td>
                      <select value={r.maxMinutes} disabled={busy === r.roomId} onChange={(e) => saveRoom(r, { maxMinutes: Number(e.target.value) })} aria-label={`Longest booking for ${r.name}`}
                        className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1">
                        {[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
                      </select>
                    </td>
                    <td className="whitespace-nowrap">
                      <input type="time" value={r.openFrom} disabled={busy === r.roomId} onChange={(e) => e.target.value && saveRoom(r, { openFrom: e.target.value })} aria-label={`Bookable from, ${r.name}`} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1" />
                      {' – '}
                      <input type="time" value={r.openTo} disabled={busy === r.roomId} onChange={(e) => e.target.value && saveRoom(r, { openTo: e.target.value })} aria-label={`Bookable until, ${r.name}`} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1" />
                    </td>
                    <td>
                      <input type="checkbox" checked={r.needsApproval} disabled={busy === r.roomId || !r.bookable} onChange={(e) => saveRoom(r, { needsApproval: e.target.checked })} aria-label={`${r.name} needs approval`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
