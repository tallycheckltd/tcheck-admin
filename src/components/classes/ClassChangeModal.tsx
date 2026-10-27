import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Ban, MonitorSmartphone, MoveRight, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { ClassSession } from '../../types';
import { formatClassCalendarDate, formatClassTimeLocal, localCalendarYmd } from '../../utils/classDateDisplay';

/**
 * F4 (10-22) — cancel, move or switch a class online, straight away: whoever can edit classes, and the
 * class's own lecturer (no approvals — owner, 10-22). A lecturer's change tells their HOD, and every
 * change is listed on Class changes.
 */

type Tab = 'move' | 'cancel' | 'online';
interface RoomOption { id: string; name: string; hasBeacon: boolean; busy: 'class' | 'booking' | null; current: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const offsetFor = (ymd: string) => {
  const o = new Date(`${ymd}T12:00:00`).getTimezoneOffset();
  return `${o <= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)}`;
};
const at = (ymd: string, t: string) => `${ymd}T${t}:00${offsetFor(ymd)}`;
const errInfo = (e: unknown) => ({ message: e instanceof Error ? e.message : 'Something went wrong', code: (e as { code?: string })?.code });

export function ClassChangeModal({ cls, asLecturer, onClose, onDone }: {
  cls: ClassSession | null;
  /** A lecturer: same actions on their own class; their HOD is told. */
  asLecturer: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('move');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [roomId, setRoomId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    if (!cls) return;
    setTab(cls.cancelledAt ? 'cancel' : 'move');
    setReason('');
    setError(null);
    setDate(localCalendarYmd(new Date(cls.startTime)));
    setStart(hhmm(cls.startTime));
    setEnd(hhmm(cls.endTime));
    setRoomId(cls.classroomId ?? '');
  }, [cls]);

  // Rooms for the chosen time: free or busy (never whose), and which have a beacon.
  useEffect(() => {
    if (!cls || tab !== 'move' || !date || !start || !end || end <= start) { setRooms(null); return; }
    let live = true;
    const q = `startTime=${encodeURIComponent(at(date, start))}&endTime=${encodeURIComponent(at(date, end))}`;
    api.get<RoomOption[]>(`/classes/${cls.id}/rooms?${q}`).then((r) => { if (live) setRooms(r); }).catch(() => { if (live) setRooms([]); });
    return () => { live = false; };
  }, [cls, tab, date, start, end]);

  if (!cls) return null;
  const ended = new Date(cls.endTime).getTime() <= Date.now();
  const timeChanged = date !== localCalendarYmd(new Date(cls.startTime)) || start !== hhmm(cls.startTime) || end !== hhmm(cls.endTime);
  const roomChanged = roomId !== (cls.classroomId ?? '');
  const picked = rooms?.find((r) => r.id === roomId);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try { onDone(await fn()); } catch (e) { setError(errInfo(e)); } finally { setBusy(false); }
  };

  const moveBody = (override = false) => ({
    ...(timeChanged ? { startTime: at(date, start), endTime: at(date, end) } : {}),
    ...(roomChanged ? { classroomId: roomId || null } : {}),
    ...(override ? { allowBusy: true, allowNoBeacon: true } : {}),
  });
  const told = asLecturer ? 'students and your HOD have been told' : 'students have been told';

  const doMove = (override = false) => run(async () => {
    if (!timeChanged && !roomChanged) throw new Error('Pick a new time or a new room');
    const r = await api.post<{ warnings: string[] }>(`/classes/${cls.id}/move`, moveBody(override));
    return [`Class moved — ${told}.`, ...(r.warnings ?? [])].join(' ');
  });
  const doCancel = () => run(async () => {
    await api.post(`/classes/${cls.id}/cancel`, { reason });
    return `Class cancelled — ${told}.`;
  });
  const doRestore = () => run(async () => {
    await api.post(`/classes/${cls.id}/restore`);
    return `Class is back on — ${told}.`;
  });
  const doOnline = () => run(async () => {
    await api.post(`/classes/${cls.id}/online`, { online: !cls.isOnline });
    return cls.isOnline
      ? `Class is back in person — ${told}.`
      : `Class is now online — ${told}. Students check in with the code on Live Attendance.`;
  });

  const tabs: { key: Tab; label: string; icon: typeof Ban }[] = [
    { key: 'move', label: 'Move', icon: MoveRight },
    { key: 'cancel', label: 'Cancel', icon: Ban },
    { key: 'online', label: cls.isOnline ? 'In person' : 'Online', icon: MonitorSmartphone },
  ];
  const overridable = error?.code === 'ROOM_BUSY' || error?.code === 'NO_BEACON';

  return (
    <Modal open={!!cls} onClose={onClose} title="Change class">
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 text-sm">
          <p className="font-medium text-slate-950 dark:text-white">{cls.course?.code} · {cls.title}</p>
          <p className="text-slate-600 dark:text-slate-400">
            {formatClassCalendarDate(cls.date)} · {formatClassTimeLocal(cls.startTime)} – {formatClassTimeLocal(cls.endTime)} · {cls.isOnline ? 'Online' : cls.room || 'No room'}
          </p>
          <div className="flex gap-1.5 mt-1.5">
            {cls.cancelledAt && <Badge color="red">Cancelled</Badge>}
            {cls.movedAt && !cls.cancelledAt && <Badge color="yellow">Moved</Badge>}
            {cls.isOnline && <Badge color="purple">Online</Badge>}
          </div>
        </div>

        {ended ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">This class has ended, so it can't be changed.</p>
        ) : cls.cancelledAt ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">Cancelled: {cls.cancelReason}</p>
            <Button onClick={doRestore} disabled={busy}><RotateCcw size={15} className="mr-1" /> Put it back on</Button>
          </div>
        ) : (
          <>
            <div role="tablist" className="flex gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1">
              {tabs.map((t) => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setError(null); }}
                  className={clsx('flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer',
                    tab === t.key ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400')}>
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            {tab === 'move' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <Input label="Start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                  <Input label="End" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                {!cls.isOnline && (
                  <label className="block text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Room</span>
                    <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Room"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-slate-950 dark:text-white">
                      {!cls.classroomId && <option value="">{cls.room ? `${cls.room} (not in the room list)` : 'No room'}</option>}
                      {(rooms ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.current ? ' (now)' : ''} — {r.busy === 'class' ? 'busy: another class' : r.busy === 'booking' ? 'busy: booked' : 'free'}{r.hasBeacon ? '' : ' · no beacon'}
                        </option>
                      ))}
                    </select>
                    {rooms === null && <span className="text-xs text-slate-500">Pick a time to see which rooms are free.</span>}
                  </label>
                )}
                {picked && roomChanged && !picked.hasBeacon && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{picked.name} has no beacon: students would check in by QR or manually. Pair one in Aura Sensors, or switch the class to online.</p>
                )}
                {picked?.busy && <p className="text-xs text-amber-700 dark:text-amber-400">{picked.name} is taken then.</p>}
                <Button onClick={() => doMove()} disabled={busy}>Move class</Button>
              </div>
            )}

            {tab === 'cancel' && (
              <div className="space-y-3">
                <Input label={asLecturer ? 'Reason (students and your HOD see this)' : 'Reason (students see this)'} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Lecturer at a conference" />
                <p className="text-xs text-slate-500">The class stays on record as cancelled. Nobody can check in, and it doesn't count towards anyone's attendance.</p>
                <Button variant="danger" onClick={doCancel} disabled={busy || !reason.trim()}>Cancel class</Button>
              </div>
            )}

            {tab === 'online' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {cls.isOnline
                    ? 'Back to the room: students check in with the beacon again.'
                    : 'Students check in with the 60-second code you show on Live Attendance — no beacon needed.'}
                  {asLecturer ? ' Your HOD is told.' : ''}
                </p>
                <Button onClick={doOnline} disabled={busy}>{cls.isOnline ? 'Switch back to in person' : 'Switch to online'}</Button>
              </div>
            )}
          </>
        )}

        {error && (
          <div role="alert" className="rounded-xl bg-rose-50 dark:bg-red-500/10 p-3 text-sm text-rose-700 dark:text-red-400 space-y-2">
            <p>{error.message}</p>
            {overridable && <Button size="sm" variant="secondary" onClick={() => doMove(true)} disabled={busy}>Move it anyway</Button>}
          </div>
        )}
      </div>
    </Modal>
  );
}
